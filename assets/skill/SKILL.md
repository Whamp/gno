---
name: gno
description: Search local documents, files, notes, and knowledge bases. Supports PDFs, Markdown, Word docs, code files. Use when user wants to search files, find documents, query their notes, look up information in local folders, index a directory, set up document search, build a knowledge base, or needs RAG/semantic search over their files.
allowed-tools: Bash(gno:*), Read
---

# GNO - Local Document Search

Fast local semantic search for your documents. Index once, search instantly.

**Role**: document search assistant
**Goal**: help users index, search, and query their documents

## When to Use This Skill

- User asks to **search files, documents, or notes**
- User wants to **find information** in local folders
- User needs to **index a directory** for searching
- User mentions **PDFs, markdown, docs** they want to search
- User asks about **knowledge base** or **RAG** setup
- User wants **semantic/vector search** over their files
- User needs to **set up MCP** for document access

## Quick Start

```bash
# 1. Initialize in any directory
gno init

# 2. Add a collection (folder of docs)
gno collection add ~/docs --name docs

# 3. Index documents
gno index

# 4. Search
gno search "your query"
```

## Core Commands

### Indexing

| Command | Description |
|---------|-------------|
| `gno init` | Initialize GNO in current directory |
| `gno collection add <path> --name <name>` | Add folder to index |
| `gno index` | Full index (ingest + embed) |
| `gno update` | Sync files without embedding |

### Searching

| Command | Description |
|---------|-------------|
| `gno search <query>` | BM25 keyword search |
| `gno vsearch <query>` | Vector semantic search |
| `gno query <query>` | Hybrid search (BM25 + vector + rerank) |
| `gno ask <question>` | AI-powered Q&A with citations |

### Common Options

- `-n <num>` — Max results (default: 5)
- `-c, --collection <name>` — Filter to collection
- `--json` — JSON output
- `--full` — Include full content (not snippets)

## Usage Patterns

### Search & Retrieve

```bash
# Keyword search
gno search "termination clause" -n 10

# Semantic search (similar meaning)
gno vsearch "how to cancel contract"

# Hybrid search (best quality)
gno query "deployment process" --collection work

# Get answer with citations
gno ask "what are the payment terms"
```

### Inspect Documents

```bash
# Get document by URI
gno get gno://docs/readme.md

# Get with line numbers
gno get "#a1b2c3d4" --line-numbers

# List documents
gno ls docs
```

### JSON Output (for scripts)

```bash
# Search results as JSON
gno search "api" --json | jq '.[] | .uri'

# Status check
gno status --json
```

## Reference

For complete CLI details, see [cli-reference.md](cli-reference.md).
For MCP server setup, see [mcp-reference.md](mcp-reference.md).
For usage examples, see [examples.md](examples.md).
