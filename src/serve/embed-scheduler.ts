/**
 * Debounced embedding scheduler for web UI.
 * Accumulates docIds from sync operations and runs embedding after debounce.
 *
 * @module src/serve/embed-scheduler
 */

import type { Database } from "bun:sqlite";

import type { EmbeddingPort } from "../llm/types";
import type { BacklogItem, VectorIndexPort, VectorRow } from "../store/vector";

import { formatDocForEmbedding } from "../pipeline/contextual";
import { createVectorStatsPort } from "../store/vector";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 30_000; // 30 seconds
const MAX_WAIT_MS = 300_000; // 5 minutes
const BATCH_SIZE = 32;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbedSchedulerState {
  pendingDocCount: number;
  running: boolean;
  nextRunAt?: number;
}

export interface EmbedResult {
  embedded: number;
  errors: number;
}

export interface EmbedSchedulerDeps {
  db: Database;
  embedPort: EmbeddingPort | null;
  vectorIndex: VectorIndexPort | null;
  modelUri: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbedScheduler {
  /** Called after sync with list of changed doc IDs (docid not id) */
  notifySyncComplete(docIds: string[]): void;

  /** Force immediate embed (for Cmd+S). Returns null if no embedPort. */
  triggerNow(): Promise<EmbedResult | null>;

  /** Get current state (for debugging/status) */
  getState(): EmbedSchedulerState;

  /** Cleanup on server shutdown */
  dispose(): void;
}

/**
 * Create an embed scheduler for debounced background embedding.
 * Returns null if no embedding port available.
 */
export function createEmbedScheduler(deps: EmbedSchedulerDeps): EmbedScheduler {
  const { db, embedPort, vectorIndex, modelUri } = deps;

  // State
  const pendingDocIds = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let needsRerun = false;
  let firstPendingAt: number | null = null;
  let disposed = false;

  const stats = createVectorStatsPort(db);

  /**
   * Run embedding for pending docs.
   * Uses global backlog - we don't filter by docIds since:
   * 1. Backlog query is already efficient (only unembedded chunks)
   * 2. Filtering by docId would require joining through documents table
   * 3. Simpler to just embed all backlog when triggered
   */
  async function runEmbed(): Promise<EmbedResult> {
    if (!embedPort || !vectorIndex) {
      return { embedded: 0, errors: 0 };
    }

    let embedded = 0;
    let errors = 0;
    let cursor: { mirrorHash: string; seq: number } | undefined;

    try {
      // Process all backlog in batches
      while (true) {
        const batchResult = await stats.getBacklog(modelUri, {
          limit: BATCH_SIZE,
          after: cursor,
        });

        if (!batchResult.ok) {
          console.error(
            "[embed-scheduler] Backlog query failed:",
            batchResult.error.message
          );
          break;
        }

        const batch = batchResult.value;
        if (batch.length === 0) {
          break;
        }

        // Advance cursor
        const lastItem = batch.at(-1);
        if (lastItem) {
          cursor = { mirrorHash: lastItem.mirrorHash, seq: lastItem.seq };
        }

        // Embed batch
        const embedResult = await embedPort.embedBatch(
          batch.map((b: BacklogItem) =>
            formatDocForEmbedding(b.text, b.title ?? undefined)
          )
        );

        if (!embedResult.ok) {
          console.error(
            "[embed-scheduler] Embed failed:",
            embedResult.error.message
          );
          errors += batch.length;
          continue;
        }

        const embeddings = embedResult.value;
        if (embeddings.length !== batch.length) {
          errors += batch.length;
          continue;
        }

        // Store vectors
        const vectors: VectorRow[] = batch.map(
          (b: BacklogItem, idx: number) => ({
            mirrorHash: b.mirrorHash,
            seq: b.seq,
            model: modelUri,
            embedding: new Float32Array(embeddings[idx] as number[]),
            embeddedAt: new Date().toISOString(),
          })
        );

        const storeResult = await vectorIndex.upsertVectors(vectors);
        if (!storeResult.ok) {
          console.error(
            "[embed-scheduler] Store failed:",
            storeResult.error.message
          );
          errors += batch.length;
          continue;
        }

        embedded += batch.length;
      }
    } catch (e) {
      console.error("[embed-scheduler] Unexpected error:", e);
    }

    return { embedded, errors };
  }

  /**
   * Schedule or reschedule the debounced embed run.
   */
  function scheduleRun(): void {
    if (disposed || running) {
      return;
    }

    // Calculate delay
    const now = Date.now();
    let delay = DEBOUNCE_MS;

    // Check max-wait
    if (firstPendingAt !== null) {
      const elapsed = now - firstPendingAt;
      if (elapsed >= MAX_WAIT_MS) {
        // Max wait reached, run immediately
        delay = 0;
      } else {
        // Don't exceed max wait
        delay = Math.min(delay, MAX_WAIT_MS - elapsed);
      }
    }

    // Clear existing timer
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      void executeRun();
    }, delay);
  }

  /**
   * Execute the embed run with concurrency guard.
   */
  async function executeRun(): Promise<EmbedResult | null> {
    if (disposed || running) {
      needsRerun = true;
      return null;
    }

    running = true;
    timer = null;

    try {
      const result = await runEmbed();

      // Clear pending state
      pendingDocIds.clear();
      firstPendingAt = null;

      // Check if we need to rerun (more docs added while running)
      if (needsRerun && !disposed) {
        needsRerun = false;
        // Schedule another run
        if (pendingDocIds.size > 0) {
          scheduleRun();
        }
      }

      return result;
    } finally {
      running = false;
    }
  }

  return {
    notifySyncComplete(docIds: string[]): void {
      if (disposed || !embedPort) {
        return;
      }

      // Track first pending time for max-wait
      if (pendingDocIds.size === 0) {
        firstPendingAt = Date.now();
      }

      // Add to pending set
      for (const id of docIds) {
        pendingDocIds.add(id);
      }

      // Schedule/reschedule debounced run
      scheduleRun();
    },

    async triggerNow(): Promise<EmbedResult | null> {
      if (disposed || !embedPort) {
        return null;
      }

      // Cancel pending timer
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      // If already running, mark for rerun
      if (running) {
        needsRerun = true;
        return { embedded: 0, errors: 0 };
      }

      return executeRun();
    },

    getState(): EmbedSchedulerState {
      const state: EmbedSchedulerState = {
        pendingDocCount: pendingDocIds.size,
        running,
      };

      if (timer && firstPendingAt !== null) {
        const elapsed = Date.now() - firstPendingAt;
        const remaining = Math.min(DEBOUNCE_MS, MAX_WAIT_MS - elapsed);
        state.nextRunAt = Date.now() + Math.max(0, remaining);
      }

      return state;
    },

    dispose(): void {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
