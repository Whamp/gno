/**
 * Tests for embed-scheduler.
 *
 * @module test/serve/embed-scheduler
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { EmbeddingPort } from "../../src/llm/types";
import type { VectorIndexPort } from "../../src/store/vector";

import { createEmbedScheduler } from "../../src/serve/embed-scheduler";

// Mock database
function createMockDb() {
  return {
    prepare: () => ({
      all: () => [],
      get: () => ({ count: 0 }),
    }),
  } as never;
}

// Mock embedding port
function createMockEmbedPort(embeddings: number[][] = [[0.1, 0.2, 0.3]]) {
  return {
    embed: mock(() => Promise.resolve({ ok: true, value: embeddings[0] })),
    embedBatch: mock((texts: string[]) =>
      Promise.resolve({
        ok: true,
        value: texts.map(() => embeddings[0]),
      })
    ),
    dimensions: () => 3,
    init: () => Promise.resolve({ ok: true }),
    dispose: () => Promise.resolve(),
  } as unknown as EmbeddingPort;
}

// Mock vector index port
function createMockVectorIndex() {
  return {
    searchAvailable: true,
    model: "test-model",
    dimensions: 3,
    upsertVectors: mock(() => Promise.resolve({ ok: true })),
    deleteVectorsForMirror: mock(() => Promise.resolve({ ok: true })),
    searchNearest: mock(() => Promise.resolve({ ok: true, value: [] })),
    rebuildVecIndex: mock(() => Promise.resolve({ ok: true })),
    syncVecIndex: mock(() =>
      Promise.resolve({ ok: true, value: { added: 0, removed: 0 } })
    ),
  } as unknown as VectorIndexPort;
}

describe("EmbedScheduler", () => {
  let originalTimers: typeof globalThis.setTimeout;

  beforeEach(() => {
    originalTimers = globalThis.setTimeout;
  });

  afterEach(() => {
    globalThis.setTimeout = originalTimers;
  });

  test("getState returns initial state", () => {
    const scheduler = createEmbedScheduler({
      db: createMockDb(),
      embedPort: createMockEmbedPort(),
      vectorIndex: createMockVectorIndex(),
      modelUri: "test-model",
    });

    const state = scheduler.getState();
    expect(state.pendingDocCount).toBe(0);
    expect(state.running).toBe(false);
    expect(state.nextRunAt).toBeUndefined();

    scheduler.dispose();
  });

  test("notifySyncComplete adds docIds to pending", () => {
    const scheduler = createEmbedScheduler({
      db: createMockDb(),
      embedPort: createMockEmbedPort(),
      vectorIndex: createMockVectorIndex(),
      modelUri: "test-model",
    });

    scheduler.notifySyncComplete(["doc1", "doc2"]);

    const state = scheduler.getState();
    expect(state.pendingDocCount).toBe(2);

    scheduler.dispose();
  });

  test("notifySyncComplete deduplicates docIds", () => {
    const scheduler = createEmbedScheduler({
      db: createMockDb(),
      embedPort: createMockEmbedPort(),
      vectorIndex: createMockVectorIndex(),
      modelUri: "test-model",
    });

    scheduler.notifySyncComplete(["doc1", "doc2"]);
    scheduler.notifySyncComplete(["doc2", "doc3"]);

    const state = scheduler.getState();
    expect(state.pendingDocCount).toBe(3);

    scheduler.dispose();
  });

  test("triggerNow returns result immediately", async () => {
    const scheduler = createEmbedScheduler({
      db: createMockDb(),
      embedPort: createMockEmbedPort(),
      vectorIndex: createMockVectorIndex(),
      modelUri: "test-model",
    });

    scheduler.notifySyncComplete(["doc1"]);
    const result = await scheduler.triggerNow();

    expect(result).not.toBeNull();
    expect(result?.embedded).toBe(0); // No actual backlog in mock
    expect(result?.errors).toBe(0);

    // Pending should be cleared
    const state = scheduler.getState();
    expect(state.pendingDocCount).toBe(0);

    scheduler.dispose();
  });

  test("triggerNow returns null without embedPort", async () => {
    const scheduler = createEmbedScheduler({
      db: createMockDb(),
      embedPort: null,
      vectorIndex: null,
      modelUri: "test-model",
    });

    const result = await scheduler.triggerNow();
    expect(result).toBeNull();

    scheduler.dispose();
  });

  test("notifySyncComplete does nothing without embedPort", () => {
    const scheduler = createEmbedScheduler({
      db: createMockDb(),
      embedPort: null,
      vectorIndex: null,
      modelUri: "test-model",
    });

    scheduler.notifySyncComplete(["doc1"]);

    const state = scheduler.getState();
    expect(state.pendingDocCount).toBe(0);

    scheduler.dispose();
  });

  test("dispose clears pending state", async () => {
    const scheduler = createEmbedScheduler({
      db: createMockDb(),
      embedPort: createMockEmbedPort(),
      vectorIndex: createMockVectorIndex(),
      modelUri: "test-model",
    });

    scheduler.notifySyncComplete(["doc1", "doc2"]);
    scheduler.dispose();

    // After dispose, notifySyncComplete should be no-op
    scheduler.notifySyncComplete(["doc3"]);
    const state = scheduler.getState();
    expect(state.pendingDocCount).toBe(2); // Still 2 from before dispose
  });

  test("scheduler reports nextRunAt when timer is set", () => {
    const scheduler = createEmbedScheduler({
      db: createMockDb(),
      embedPort: createMockEmbedPort(),
      vectorIndex: createMockVectorIndex(),
      modelUri: "test-model",
    });

    scheduler.notifySyncComplete(["doc1"]);

    const state = scheduler.getState();
    expect(state.nextRunAt).toBeDefined();
    expect(state.nextRunAt).toBeGreaterThan(Date.now());

    scheduler.dispose();
  });
});
