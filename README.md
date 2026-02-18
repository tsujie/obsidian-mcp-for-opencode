# Obsidian MCP Server for OpenCode

A local MCP (Model Context Protocol) server that provides semantic search over your Obsidian vault using local embeddings and SQLite vector storage.

## Features

- **Semantic search** — find notes by meaning, not just keywords
- **Fully local** — no API keys, no cloud services. Embeddings run on your machine
- **Incremental indexing** — only re-embeds changed files (content-based change detection)
- **Orphan cleanup** — automatically removes deleted/renamed files from index
- **Markdown-aware chunking** — respects headings, frontmatter, and document structure
- **Tag support** — search and filter by Obsidian tags (frontmatter + inline)
- **Lightweight** — SQLite-based, no Docker or external databases

## Setup

```bash
npm install
npm run build
```

## Configuration

| Environment Variable  | Default                   | Description                                                     |
| --------------------- | ------------------------- | --------------------------------------------------------------- |
| OBSIDIAN_VAULT_PATH   | (required)                | Path to your Obsidian vault                                     |
| OBSIDIAN_IGNORED_KEYS | timesViewed,date modified | Comma-separated frontmatter keys to ignore for change detection |

The `OBSIDIAN_IGNORED_KEYS` setting allows you to exclude volatile frontmatter fields from content hash calculation. This prevents unnecessary re-indexing when only metadata like view counts or modification timestamps change, while still detecting actual content changes.

## Usage

### Standalone

```bash
# Via environment variable
OBSIDIAN_VAULT_PATH=/path/to/vault npm start

# Via CLI argument
node dist/index.js /path/to/vault
```

### With OpenCode

Add to your `opencode.json`:

```jsonc
{
  "mcp": {
    "obsidian": {
      "type": "local",
      "command": ["node", "/path/to/obsidian-mcp-for-opencode/dist/index.js"],
      "environment": {
        "OBSIDIAN_VAULT_PATH": "/path/to/your/obsidian/vault",
      },
    },
  },
}
```

## MCP Tools

| Tool            | Description                              |
| --------------- | ---------------------------------------- |
| `search_notes`  | Semantic search across the vault         |
| `read_note`     | Read full content of a specific note     |
| `list_tags`     | List all tags in the vault               |
| `search_by_tag` | Find notes by tag                        |
| `reindex`       | Re-index the vault (incremental or full) |
| `vault_stats`   | Get indexing statistics                  |

## Tech Stack

- **Embeddings**: `all-MiniLM-L6-v2` via `@xenova/transformers` (384 dimensions, runs locally)
- **Vector Store**: SQLite + `sqlite-vec` extension
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Chunking**: Markdown-aware, respects headings and frontmatter via `gray-matter`
