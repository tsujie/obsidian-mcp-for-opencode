---
name: obsidian-mcp
description: Use this when you need to search, read, or explore notes in the user's Obsidian vault. It describes the available MCP tools for semantic search, tag filtering, reading notes, and vault management. Use it whenever the user asks about their notes, knowledge base, or personal wiki.
---
 Use this when
- User asks to find, search, or look up something in their notes/vault
- User references their Obsidian vault, knowledge base, or personal wiki
- You need to retrieve context from the user's notes to answer a question
- User asks about tags, topics, or themes across their notes
- You need to check what's indexed or trigger a reindex
 Available MCP tools
 `search_notes`
Semantic search across the vault. Finds notes by meaning, not just keywords.
- Use this as the primary search tool — it understands intent
- Returns ranked results with relevance scores
- Good for broad queries like "notes about project planning" or "ideas related to distributed systems"
 `read_note`
Read the full content of a specific note by path.
- Use after `search_notes` to get full context from a relevant result
- Use when the user references a specific note by name
 `list_tags`
List all tags in the vault.
- Use to understand the vault's taxonomy before filtering
- Helpful when the user asks "what topics do I have notes on?"
 `search_by_tag`
Find notes by tag.
- Use when the user asks for notes with a specific tag
- Supports both frontmatter tags and inline `#tag` syntax
- Combine with `search_notes` for tag + semantic filtering
 `reindex`
Re-index the vault. Supports incremental (default) or full reindex.
- Incremental: only re-embeds changed files (fast, content-hash based)
- Full: rebuilds the entire index from scratch
- Use when the user says their search results seem stale or after bulk vault changes
 `vault_stats`
Get indexing statistics.
- Shows total notes, indexed count, last index time
- Use to diagnose indexing issues or answer "how many notes do I have?"
 Patterns
- Start with `search_notes` for broad queries, then `read_note` for details.
- Use `list_tags` first if the user's request is tag-oriented, then `search_by_tag`.
- If search results seem off, suggest `reindex` with incremental mode.
- Combine semantic search with tag search to narrow results.
- Note paths are relative to the vault root.
 Quick checklist
- Use `search_notes` for meaning-based lookup, not keyword grep.
- Use `read_note` to fetch full content after identifying relevant notes.
- Check `vault_stats` if indexing seems incomplete.
- Prefer incremental reindex unless the user explicitly wants a full rebuild.