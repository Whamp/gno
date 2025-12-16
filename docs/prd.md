## Product Requirements Document (MVP)

### Project name: **Gno**

### Binary command: **`gno`**

> **Naming rationale:** “Gno” (from *gnosis*, knowledge) is short, memorable, and clearly tied to personal knowledge + productivity.

**Other short alternatives (if you later decide to rename):**

* `kno` (know/knowledge)
* `lex` (lexicon)
* `mn` / `mnem` (mnemonics; command would be longer for uniqueness)
* `syn` (sync/synapse)
* `idx` (index)
* `kb` (knowledge base)

For the rest of this PRD, the working product name is **Gno** and the CLI is **`gno`**.

---

## 1. Summary

**Gno** is a local-first, on-device search engine for your “things you need to remember”: markdown notes, meeting transcripts, documentation, and *non-markdown files* (Word/Excel/PowerPoint/PDF/etc.) via conversion to a **Markdown mirror** for indexing.

It provides:

* **Keyword search** (BM25 via SQLite FTS5)
* **Semantic search** (vector embeddings via Ollama `/api/embed`, stored in SQLite via `sqlite-vec`)
* **Hybrid search** with **query expansion + reranking** (local models via Ollama), optimized for agentic workflows (JSON/files output + MCP server)

Key improvement vs. typical markdown-only tools:

* **Multi-format ingest** using **MarkItDown** (Microsoft) to convert common file types to structured Markdown while maintaining a stable pointer to the **original source file**. MarkItDown supports Word/Excel/PowerPoint/PDF/HTML/images/audio/archives/etc. ([GitHub][1])
* **Correct file referencing**: results always reference the *original* file path/URI (e.g., `.docx`), while content returned to LLMs is the *converted markdown mirror*.

---

## 2. Goals and Non-goals

### 2.1 Goals (MVP)

1. **Local-first hybrid retrieval** over a personal corpus:

   * FTS5 BM25 over chunk text
   * Vector search over chunk embeddings
   * Fusion + rerank for best-quality `gno query`
2. **Index multiple file formats**:

   * Native: `.md`, `.txt`
   * Converted: `.docx`, `.pptx`, `.xlsx`, `.pdf` (and additional types supported by MarkItDown as “best effort”) ([GitHub][1])
3. **Stable source referencing**:

   * Always output results keyed to the original file path/URI
   * Store markdown mirror and link it to original
4. **Agent-ready outputs**:

   * `--json`, `--files`, `--md`, `--xml`, `--csv`
   * MCP server exposing core tools
5. **World-class engineering baseline**:

   * Clean architecture boundaries
   * Idiomatic TypeScript + Bun
   * High test coverage for deterministic components
   * Reproducible evals for stochastic LLM stages using **Evalite v1** (`.eval.ts`, built on Vitest) ([Evalite][2])

### 2.2 Non-goals (MVP)

* Cross-device sync of the index DB itself (future). MVP focuses on **rebuildable local index** derived from source files.
* Full-fidelity document conversion for human publishing (MarkItDown output is intended for LLM/text analysis, not perfect rendering). ([GitHub][1])
* A GUI. (CLI + MCP only in MVP.)
* Multi-user / server-hosted search service.

---

## 3. Personas and Use Cases

### Personas

* **Knowledge-worker / operator** with large local notes + docs + meeting transcripts.
* **Engineer** with repo docs, architecture notes, ADRs, PDFs, decks.
* **Agentic workflows**: “my Claude/agent needs the top N relevant files + content.”

### Core use cases

1. “Find the doc where we decided X” (keyword exactness matters)
2. “How do we deploy Y?” (semantic search + rerank)
3. “Give my agent the top 20 relevant files above threshold” (structured output)
4. “Search within a subset (collection)” (e.g., only work docs)
5. “Retrieve full content for a given path/id” (with original file reference)

---

## 4. Requirements

## 4.1 Functional Requirements

### FR1 — Collections and indexing

* User can add directories and/or glob patterns as **collections**:

  * `gno add <path-or-glob> [--name <collectionName>] [--drop]`
* Each collection has:

  * `collectionId` (stable)
  * root path / glob
  * optional human context label (e.g., “Work docs”)

### FR2 — Context descriptions

* `gno context set <pathPrefix> "<description>" [--collection <id>]`
* Applied to files whose *source path* matches prefix.
* Context is returned with search results.

### FR3 — Multi-format ingestion (Markdown mirror)

* Ingestion pipeline:

  1. Scan file list
  2. Determine converter based on extension/MIME
  3. Convert to Markdown **mirror**
  4. Chunk mirror markdown
  5. Store doc + chunks + FTS index

**Converter requirements**

* Built-in pass-through converter for `.md`/`.txt`
* **MarkItDown converter** for:

  * `.docx`, `.pptx`, `.xlsx`, `.pdf` (MVP)
  * and “best effort” additional formats supported by MarkItDown ([GitHub][1])
* MarkItDown integration via subprocess call (Python). MarkItDown is a Python CLI utility. ([GitHub][1])

**Critical: source vs derived**

* Store:

  * `sourcePath` (original file path)
  * `sourceType` (extension)
  * `sourceSha256` (bytes hash)
  * `derivedMarkdown` (mirror content) OR `derivedPath` (artifact store)
* Search results reference `sourcePath`; content retrieval returns `derivedMarkdown` plus the source reference.

### FR4 — Embeddings (semantic index)

* `gno embed [--force] [--collection <id>]`
* Uses Ollama `/api/embed` (vectors are L2-normalized per docs) ([Ollama Docs][3])
* Stores embeddings per chunk.

### FR5 — Search

Provide three search modes:

1. `gno search "<query>"`

   * BM25-only (fast, deterministic)
2. `gno vsearch "<query>"`

   * vector-only (semantic)
3. `gno query "<query>"`

   * hybrid retrieval + query expansion + reranking

Common flags:

* `-n, --limit <number>`
* `-c, --collection <id>`
* `--min-score <0..1>`
* `--all` (return all results passing threshold)
* `--full` (include full derived markdown in output)
* Output formats:

  * `--json`, `--files`, `--csv`, `--md`, `--xml`

### FR6 — Get / multi-get

* `gno get <pathOrFuzzyId> [--full] [--source] [--derived]`

  * Default: returns derived markdown snippet + metadata referencing source
  * `--source`: prints source path/URI and metadata only
  * `--derived`: prints full derived markdown
* `gno multi-get <glob|commaList> [--max-bytes N] [--max-files N] [--json|--files|...]`

### FR7 — Status / doctor / cleanup

* `gno status`

  * index path, counts, collections, model config, last ingest/embed time
* `gno doctor`

  * validates:

    * Ollama reachable
    * required models installed/pullable
    * Python available
    * MarkItDown available
    * sqlite extensions loadable on this OS
* `gno cleanup`

  * removes orphaned artifacts, old caches, and stale embeddings

### FR8 — MCP server

* `gno mcp`
* Exposes tools:

  * `gno_search`
  * `gno_vsearch`
  * `gno_query`
  * `gno_get`
  * `gno_multi_get`
  * `gno_status`

Tools must mirror CLI outputs with strict JSON schema.

---

## 4.2 Non-functional Requirements

### NFR1 — Local-first & privacy

* No external network calls by default except to local Ollama and local Python conversion tools.
* All data stored in user cache directory.

### NFR2 — Performance

* Incremental indexing (only reprocess changed files).
* Embedding batching.
* Concurrency limits for conversion + embeddings + LLM calls.

### NFR3 — Reliability

* Crash-safe ingestion (transactions, journaling).
* Idempotent commands.

### NFR4 — Engineering quality

* Strict TypeScript
* Lint + format + CI gating
* High unit test coverage on deterministic logic
* Evals tracked and runnable in CI

---

## 5. Model Strategy (current, multilingual, local)

### 5.1 Default model set (MVP)

All models must be configurable via CLI flags and config file; defaults should target **multilingual** performance.

**Embedding model (default): `qwen3-embedding`**

* Available in multiple sizes (0.6B / 4B / 8B) with large context windows ([Ollama][4])
* Supports **100+ languages** and is designed for retrieval use cases ([Ollama][4])
* Recommended by Ollama docs as an embedding model ([Ollama Docs][3])

**Reranker model (default): Qwen3-Reranker family**

* Qwen explicitly publishes reranking models (0.6B/4B/8B) and reports benchmark results; reranker is a cross-encoder producing relevance scores ([Qwen][5])
* In Ollama, these may appear as community/ported models; `gno doctor` must verify pullability and fall back if missing (see below). ([Ollama][6])

**Query expansion model (default): `qwen3:1.7b`**

* Qwen3 is described as the latest generation of Qwen models and supports 100+ languages/dialects ([Ollama][7])
* Use non-thinking mode by default (speed), with deterministic settings.

### 5.2 Fallbacks

If reranker model is unavailable:

* Fallback reranking mode: use `qwen3:1.7b` with deterministic prompting to output a numeric score (0..1) for each candidate.
  If embedding model is unavailable:
* Fallback embedding: `bge-m3` (100+ languages) ([Ollama][8]) or `embeddinggemma` (Ollama recommended) ([Ollama Docs][3])

### 5.3 Model configuration requirements

* Config file + env vars:

  * `GNO_OLLAMA_URL` (default `http://localhost:11434`)
  * `GNO_EMBED_MODEL`
  * `GNO_RERANK_MODEL`
  * `GNO_EXPAND_MODEL`
* Store model name + parameters used in DB metadata for reproducibility.

---

## 6. Syncing and Correct File Referencing

### Problem statement

If we index non-markdown files by converting them to Markdown, we must:

1. Keep the derived markdown in sync with the source
2. Always reference the correct original file in outputs

### MVP design

**Source-of-truth = original file**
**Index-of-truth = derived markdown mirror**

#### 6.1 File identity

For each indexed file store:

* `sourceUri`: `file:///abs/path` (canonical reference)
* `sourcePathAbs`
* `sourcePathRel` (relative to collection root when possible)
* `sourceSha256` (hash of bytes)
* `sourceMtimeMs`, `sourceSizeBytes`

#### 6.2 Derived markdown artifact store

* Derived markdown stored at:

  * `${XDG_CACHE_HOME}/gno/<index>/artifacts/<sourceSha256>.md`
* DB stores:

  * `derivedSha256` (hash of normalized markdown)
  * `derivedPath`
  * `converterId` + `converterVersion` (e.g., MarkItDown version)
  * `chunkingVersion`

#### 6.3 Incremental updates

On `gno add` or `gno update`:

* If `(mtime,size)` unchanged → skip
* If changed → recompute `sourceSha256`, reconvert, rechunk, re-FTS, mark embeddings stale for affected chunks

#### 6.4 Rename/move handling (MVP-friendly)

If a previously indexed file disappears:

* If a new file in same collection has identical `sourceSha256`, treat as rename:

  * update `sourcePathAbs`, `sourceUri`, `sourcePathRel`
  * keep doc id stable

If no match, mark as deleted.

#### 6.5 Output behavior

All output formats must include:

* `sourcePathAbs` (or `sourceUri`)
* `sourceType`
* optionally `derivedPath` (hidden by default; show with `--debug`)

This ensures that even when content comes from the mirror, the agent/user can open the original file.

---

## 7. System Architecture (TypeScript + Bun)

### 7.1 High-level modules (Clean/Hexagonal)

**Core (pure-ish)**

* `domain/`:

  * entities: `Collection`, `Document`, `Chunk`, `SearchResult`
  * value objects: `DocId`, `ChunkId`, `Sha256`, `Score`
  * policies: chunking, normalization, scoring/fusion
* `usecases/`:

  * `IngestCollection`
  * `EmbedChunks`
  * `SearchBM25`
  * `SearchVector`
  * `SearchHybrid`
  * `GetDocument`
  * `MultiGetDocuments`

**Ports**

* `ports/DocumentConverter.ts`
* `ports/EmbeddingProvider.ts`
* `ports/Reranker.ts`
* `ports/Storage.ts`
* `ports/FileSystem.ts`

**Adapters**

* `adapters/sqlite/` (bun:sqlite + FTS5 + sqlite-vec)
* `adapters/ollama/` (HTTP client for embed/generate)
* `adapters/converters/`:

  * `MarkdownPassthroughConverter`
  * `MarkItDownConverter` (Python subprocess)
* `adapters/cli/` (command parsing + formatters)
* `adapters/mcp/` (MCP server exposing tools)

### 7.2 Storage implementation details

* Use Bun’s `bun:sqlite` driver. ([Bun][9])
* Use `sqlite-vec` extension for vector index; it supports Bun (`bun:sqlite`) via `sqliteVec.load()` ([Alex Garcia][10])
* On macOS, loading extensions requires linking a custom SQLite because Apple SQLite disables extension loading; Bun docs explicitly call this out. ([Bun][11])

  * MVP requirement: `gno doctor` checks and prints actionable fix.

### 7.3 Concurrency model

* Use a shared `ConcurrencyLimiter`:

  * conversion: default 2
  * embedding: default 4
  * LLM rerank/expand: default 2
* All concurrency and timeouts configurable.

---

## 8. Data Model (SQLite)

### 8.1 Tables (proposed)

#### `meta`

* `key TEXT PRIMARY KEY`
* `value TEXT`

Examples:

* schema version
* `embed_model`, `rerank_model`, `expand_model`
* `chunking_version`, `converter_versions_json`

#### `collections`

* `collection_id TEXT PRIMARY KEY`
* `name TEXT`
* `root_path TEXT` (abs)
* `glob TEXT NULL`
* `created_at`, `updated_at`

#### `path_contexts`

* `collection_id TEXT`
* `path_prefix TEXT`
* `description TEXT`
* PK `(collection_id, path_prefix)`

#### `documents`

* `doc_id TEXT PRIMARY KEY` (stable; derived from `collection_id + source_sha256`)
* `collection_id TEXT`
* `source_path_abs TEXT`
* `source_path_rel TEXT`
* `source_uri TEXT`
* `source_type TEXT`
* `source_sha256 TEXT`
* `source_mtime_ms INTEGER`
* `source_size_bytes INTEGER`
* `derived_path TEXT`
* `derived_sha256 TEXT`
* `title TEXT`
* `deleted_at INTEGER NULL`
* `created_at`, `updated_at`

Indexes:

* `(collection_id, source_path_rel)`
* `(collection_id, source_sha256)`
* `(deleted_at)`

#### `chunks`

* `chunk_id TEXT PRIMARY KEY` (`${doc_id}:${seq}`)
* `doc_id TEXT`
* `seq INTEGER`
* `start_char INTEGER`
* `end_char INTEGER`
* `heading_path TEXT NULL`
* `text TEXT`
* `text_sha256 TEXT` (for embedding invalidation)

Index:

* `(doc_id, seq)`

#### `chunks_fts` (FTS5)

* content: `chunks`
* indexed columns: `text`, `title` (via external content or shadow columns)
* tokenizer: `unicode61` (MVP)

#### `chunk_vectors` (sqlite-vec)

A `vec0` virtual table containing vectors keyed by `chunk_id`.

* `chunk_id TEXT` (or stored as metadata column)
* `embedding BLOB` (Float32Array buffer)
* optional metadata columns: `doc_id`, `collection_id`

Implementation uses `sqlite-vec` load + `vec0` tables. ([Alex Garcia][10])

#### `ollama_cache`

* `cache_key TEXT PRIMARY KEY` (sha256 of request)
* `kind TEXT` (`embed|expand|rerank`)
* `model TEXT`
* `request_json TEXT`
* `response_json TEXT`
* `created_at`

Purpose: deterministic re-runs & eval speed.

---

## 9. Indexing and Chunking

### 9.1 Conversion

* For `.md` / `.txt`: read as UTF-8
* For `.docx/.pptx/.xlsx/.pdf`: run MarkItDown to stdout, capture markdown ([GitHub][1])
* Normalize markdown:

  * normalize line endings to `\n`
  * trim trailing whitespace
  * optionally collapse >N blank lines

### 9.2 Chunking (MVP algorithm)

Goal: stable, explainable, and reasonably semantic.

Order:

1. Split by markdown headings (`#`, `##`, `###`) into sections
2. Within section, chunk by character budget (e.g., 4–8KB) with overlap (e.g., 200 chars)
3. Store `heading_path` like `"H1 > H2 > H3"` for context

Chunk stability:

* `chunking_version = "md-heading-v1"`
* Changing chunking version forces re-embed and FTS rebuild.

---

## 10. Retrieval + Ranking Pipeline (Hybrid)

### 10.1 Candidate generation

Given query `q`:

1. Query expansion:

   * Generate `q1..qM` with `expand_model` (default Qwen3) ([Ollama][7])
   * Keep original query with higher weight
2. For each query variant:

   * BM25 retrieve top `K_bm25` chunks using `chunks_fts`
   * Vector retrieve top `K_vec` chunks using embeddings
3. Produce multiple ranked lists (bm25 + vec for each variant)

### 10.2 Fusion

Use **Reciprocal Rank Fusion (RRF)** (rank-based, robust to score scale mismatches):

* `rrf_score(d) = Σ 1 / (k + rank_i(d))`
* Parameters:

  * `k = 60` (MVP default)
  * weight original query lists ×2

### 10.3 Dedup + document aggregation

* Aggregate chunk-level scores into doc-level:

  * doc score = max chunk score (MVP)
  * keep top chunk per doc as “evidence chunk”

### 10.4 Reranking

Rerank top `N` doc candidates (default 30):

* Input to reranker:

  * query
  * doc title
  * best evidence chunk text (plus heading_path)
* Output:

  * numeric score [0..1] (parseable)
* Default reranker family is Qwen3-Reranker (cross-encoder relevance scoring) ([Qwen][5])

### 10.5 Final score blend

Position-aware blending to preserve exact matches:

* ranks 1–3: 0.75 retrieval + 0.25 rerank
* ranks 4–10: 0.60 retrieval + 0.40 rerank
* ranks 11+: 0.40 retrieval + 0.60 rerank

---

## 11. CLI Output Formats (Agent-friendly)

### 11.1 JSON schema (search/query)

Each result object:

* `score: number` (0..1)
* `rank: number`
* `source: { pathAbs, pathRel, uri, type }`
* `collection: { id, name }`
* `title: string`
* `context: string | null` (from path_contexts)
* `evidence: { chunkId, headingPath, snippet, startChar, endChar }`
* `debug?: { rrfScore, bm25Rank?, vecRank?, rerankScore? }` (only with `--debug`)

### 11.2 `--files` format

Line-oriented output designed for tools:

* `score<TAB>source_path_abs<TAB>context<TAB>title`

### 11.3 `get` output

Default:

* header metadata (source reference, title, context, derived hash)
* derived markdown body (or snippet unless `--full`)

---

## 12. MCP Server (MVP)

### 12.1 Transport

* MCP server on stdio (typical Claude Desktop pattern)

### 12.2 Tools

* `gno_search({ query, limit?, collection? }) -> SearchResults`
* `gno_vsearch({ query, limit?, collection? }) -> SearchResults`
* `gno_query({ query, limit?, collection?, minScore?, includeFull? }) -> SearchResults`
* `gno_get({ pathOrId, full? }) -> Document`
* `gno_multi_get({ patternOrList, maxBytes?, maxFiles?, full? }) -> Documents[]`
* `gno_status() -> Status`

---

## 13. Dependency Requirements (MVP)

### Runtime

* **Bun** (required)
* **SQLite extension loading** support for `sqlite-vec`

  * macOS requires custom SQLite linkage per Bun docs ([Bun][11])
* **Ollama** local server

  * Embeddings via `/api/embed` ([Ollama Docs][3])
* **Python 3.10+** + **MarkItDown** installed for conversion ([GitHub][1])

### Dev tooling

* bun test runner for deterministic unit/integration tests
* Evalite v1 (beta) + Vitest for evals ([Evalite][2])

---

## 14. Testing Strategy

### 14.1 Unit tests (bun:test)

* Query parsing and normalization
* Chunking logic (golden snapshots)
* RRF fusion + blending logic
* Path context matching logic
* Output serializers (JSON/files/csv)

### 14.2 Integration tests (bun:test)

* SQLite schema migrations + upserts
* FTS queries return expected items
* sqlite-vec insert + nearest neighbor query (guarded/skipped if extension unavailable)
* Ingestion pipeline with fixtures:

  * `.md` fixtures always
  * (Optional/CI-flagged) MarkItDown conversion tests if Python available

### 14.3 Contract tests for adapters

* Ollama client:

  * request construction
  * caching keys
  * deterministic params (temperature 0, etc.)

---

## 15. Evals (Evalite v1)

### 15.1 Why Evalite

* Evalite is intended as a test runner for AI apps (`.eval.ts`) and is built on Vitest. ([Evalite][2])
* Supports local dev server UI and CI export/threshold workflows. ([Evalite][2])

### 15.2 Setup requirements

* Add dev deps: `evalite`, `vitest` ([Evalite][12])
* Add scripts:

  * `eval:dev`: `evalite watch` ([Evalite][12])
  * `eval:ci`: `evalite run --threshold <...>` (exact flags finalized during build)

### 15.3 Eval suites (MVP)

1. **Retrieval eval (deterministic)**

   * Dataset: (query, expected source path(s))
   * Metrics:

     * Recall@K
     * MRR@K
2. **Hybrid pipeline eval (stochastic)**

   * Dataset includes multilingual queries
   * Evaluate:

     * Improvement vs BM25 baseline
     * Stability across runs (run each eval N times; Evalite supports repeated runs via Vitest config) ([Evalite][13])
   * Must use `ollama_cache` to keep watch-mode fast (Evalite itself recommends caching in watch mode). ([Evalite][14])

### 15.4 Model calling in evals

Option A (recommended): use Vercel AI SDK + Ollama provider for consistent tracing and easy model swaps. The AI SDK has an Ollama community provider and supports embeddings too. ([AI SDK][15])
(If you prefer not to adopt AI SDK, evals can call your internal Ollama client directly; keep the cache layer either way.)

---

## 16. Packaging and Release (Open Source)

### 16.1 Repository standards

* `LICENSE` (MIT or Apache-2.0; decide once)
* `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`
* `SECURITY.md`
* Clear README with install + examples + model notes + troubleshooting

### 16.2 Distribution channels (MVP)

1. **npm** (Bun-first)

   * Publish using `bun publish` ([Bun][16])
2. **Standalone binaries (recommended)**

   * Provide GitHub Releases artifacts built with `bun build --compile` (Bun supports `--compile` to create standalone executables). ([Bun][17])
   * Use an architecture-switching launcher script if distributing via npm with prebuilt binaries (pattern described in the Bun ecosystem). ([runspired.com][18])

### 16.3 CI requirements (GitHub Actions)

* Lint + typecheck
* Unit/integration tests
* (Optional) eval smoke test (small dataset) in CI; full evals nightly
* Release pipeline:

  * tag → build binaries → attach to release → publish npm

---

## 17. Milestones and Acceptance Criteria

### Milestone 1 — Core index + BM25

**Done when:**

* `gno add` indexes markdown files into SQLite
* `gno search` returns expected hits
* `gno get` returns content
* tests cover ingestion + BM25

### Milestone 2 — MarkItDown conversion + source referencing

**Done when:**

* `.docx/.pptx/.xlsx/.pdf` ingest works via MarkItDown ([GitHub][1])
* DB stores both source metadata and derived markdown artifact
* search results always point to source file

### Milestone 3 — Embeddings + vector search

**Done when:**

* `gno embed` calls Ollama `/api/embed` ([Ollama Docs][3])
* sqlite-vec vector index is used (with `gno doctor` guidance for macOS extension loading) ([Alex Garcia][10])
* `gno vsearch` works

### Milestone 4 — Hybrid query + rerank

**Done when:**

* `gno query` performs expansion + fusion + rerank
* Default models are Qwen3 family (multilingual) ([Ollama][7])
* caching prevents repeated LLM costs/time

### Milestone 5 — MCP + evals + release readiness

**Done when:**

* `gno mcp` exposes tools with correct schemas
* Evalite v1 integrated with at least:

  * retrieval eval suite
  * hybrid eval suite ([Evalite][2])
* npm publishing + compiled binaries documented and CI-ready ([Bun][16])

---

## 18. Key Risks & Mitigations

### Risk: sqlite extension loading on macOS

* Mitigation: `gno doctor` detects and prints exact remediation (custom SQLite per Bun docs) ([Bun][11])

### Risk: MarkItDown dependency management (Python)

* Mitigation:

  * `gno doctor` checks python + markitdown presence
  * Provide clear install instructions and version pin guidance
  * Store converter version in DB; reconvert if changed ([GitHub][1])

### Risk: Reranker availability in Ollama namespace

* Mitigation:

  * Configurable reranker model string
  * Fallback rerank using a general Qwen3 model if reranker missing
  * `gno doctor` tries `ollama pull` (or checks local model list if available via API) and reports

### Risk: Stochastic pipeline regressions

* Mitigation:

  * Evalite-based evaluation + thresholds in CI ([Evalite][2])
  * Strong caching layer (also recommended by Evalite for watch mode) ([Evalite][14])

---

## 19. MVP Deliverables Checklist (what the agent should build)

* [ ] CLI scaffolding (`gno <cmd>`) + config layering
* [ ] SQLite schema + migrations
* [ ] Ingestion pipeline:

  * [ ] file scan + incremental detection
  * [ ] converters (md + markitdown)
  * [ ] artifact store
  * [ ] chunker
  * [ ] FTS index
* [ ] Embedding pipeline:

  * [ ] Ollama embed client + cache
  * [ ] sqlite-vec storage/query
* [ ] Retrieval:

  * [ ] BM25 search
  * [ ] vector search
  * [ ] hybrid query expansion + fusion + rerank
* [ ] Output formatters (json/files/csv/md/xml)
* [ ] MCP server + tool schemas
* [ ] Tests (unit + integration) and coverage baseline
* [ ] Evalite v1 eval suites + caching
* [ ] Packaging:

  * [ ] npm publish workflow ([Bun][16])
  * [ ] compiled binaries release workflow ([Bun][17])
* [ ] Docs (README + troubleshooting + model selection)

---

If you want one concrete decision locked in for the MVP defaults (so the agent doesn’t waffle), use:

* `expand_model = qwen3:1.7b` ([Ollama][7])
* `embed_model = qwen3-embedding:0.6b` (upgradeable to 4B/8B) ([Ollama][4])
* `rerank_model = qwen3-reranker:0.6b-*` (configurable; with fallback to `qwen3:1.7b`) ([Qwen][5])

[1]: https://github.com/microsoft/markitdown "GitHub - microsoft/markitdown: Python tool for converting files and office documents to Markdown."
[2]: https://v1.evalite.dev/ "Test AI-powered apps in TypeScript | Evalite"
[3]: https://docs.ollama.com/capabilities/embeddings "Embeddings - Ollama"
[4]: https://ollama.com/library/qwen3-embedding "qwen3-embedding"
[5]: https://qwenlm.github.io/blog/qwen3-embedding/ "Qwen3 Embedding: Advancing Text Embedding and Reranking Through Foundation Models | Qwen"
[6]: https://ollama.com/sam860/qwen3-reranker "sam860/qwen3-reranker"
[7]: https://ollama.com/library/qwen3%3A0.6b "qwen3:0.6b"
[8]: https://ollama.com/library/bge-m3?utm_source=chatgpt.com "bge-m3"
[9]: https://bun.com/docs/runtime/sqlite?utm_source=chatgpt.com "SQLite"
[10]: https://alexgarcia.xyz/sqlite-vec/js.html "Using sqlite-vec in Node.js, Deno, and Bun | sqlite-vec"
[11]: https://bun.com/reference/bun/sqlite/Database/loadExtension "Database.loadExtension method | bun:sqlite module | Bun"
[12]: https://v1.evalite.dev/guides/quickstart "Quickstart | Evalite"
[13]: https://v1.evalite.dev/guides/configuration?utm_source=chatgpt.com "Configuration | Evalite"
[14]: https://www.evalite.dev/guides/cli?utm_source=chatgpt.com "CLI"
[15]: https://ai-sdk.dev/providers/community-providers/ollama "Community Providers: Ollama"
[16]: https://bun.com/docs/pm/cli/publish "bun publish - Bun"
[17]: https://bun.com/docs/bundler/executables "Single-file executable - Bun"
[18]: https://runspired.com/2025/01/25/npx-executables-with-bun.html "Creating NPX compatible cli tools with Bun | runspired.com"
