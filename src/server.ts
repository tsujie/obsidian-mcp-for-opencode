import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "path";
import { readFile } from "fs/promises";
import { createStore } from "./store.js";
import { indexVault } from "./indexer.js";
import { embed, init as initEmbedder } from "./embedder.js";

export async function startServer(vaultPath: string, indexing: boolean=false) {
  const resolvedPath = path.resolve(vaultPath);
  const dbPath = path.join(resolvedPath, ".obsidian-mcp.db");
  const store = createStore(dbPath);

  const ignoredKeys = process.env.OBSIDIAN_IGNORED_KEYS?.split(",").map((k) =>
    k.trim(),
  );

  console.error(`Obsidian MCP Server starting...`);
  console.error(`Vault: ${resolvedPath}`);
  console.error(`Database: ${dbPath}`);

  if (indexing) {
    console.error("Indexing vault (incremental)...");
    await indexVault(resolvedPath, store, { ignoredKeys });
  }

  const server = new McpServer({
    name: "obsidian-mcp",
    version: "0.1.0",
  });

  server.tool(
    "search_notes",
    "Semantic search across the Obsidian vault. Returns the most relevant note chunks for a natural language query.",
    {
      query: z.string().describe("Natural language search query"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of results to return"),
    },
    async ({ query, limit }) => {
      const [queryEmbedding] = await embed([query], "query");
      const results = store.search(queryEmbedding, limit);
      const formatted = results.map((r, i) => {
        const tags = JSON.parse(r.tags) as string[];
        return [
          `## Result ${i + 1} (distance: ${r.distance.toFixed(4)})`,
          `**File**: ${r.file}`,
          r.heading ? `**Section**: ${r.heading}` : "",
          tags.length > 0 ? `**Tags**: ${tags.join(", ")}` : "",
          "",
          r.text,
        ]
          .filter(Boolean)
          .join("\n");
      });
      return {
        content: [
          { type: "text" as const, text: formatted.join("\n\n---\n\n") },
        ],
      };
    },
  );

  server.tool(
    "read_note",
    "Read the full content of a specific note from the vault.",
    {
      path: z
        .string()
        .describe("Relative path to the note (e.g. 'folder/note.md')"),
    },
    async ({ path: notePath }) => {
      const fullPath = path.join(resolvedPath, notePath);
      if (!fullPath.startsWith(resolvedPath)) {
        return {
          content: [
            { type: "text" as const, text: "Error: path outside vault" },
          ],
        };
      }
      try {
        const content = await readFile(fullPath, "utf-8");
        return { content: [{ type: "text" as const, text: content }] };
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: file not found: ${notePath}`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    "list_tags",
    "List all tags found across the Obsidian vault.",
    {},
    async () => {
      const tags = store.getTags();
      return {
        content: [
          {
            type: "text" as const,
            text: tags.length > 0 ? tags.join("\n") : "No tags found",
          },
        ],
      };
    },
  );

  server.tool(
    "search_by_tag",
    "Find all notes with a specific tag.",
    {
      tag: z.string().describe("Tag to search for (without #)"),
    },
    async ({ tag }) => {
      const results = store.searchByTag(tag);
      const files = [...new Set(results.map((r) => r.file))];
      const formatted = files.map((f) => {
        const chunks = results.filter((r) => r.file === f);
        const tags = JSON.parse(chunks[0].tags) as string[];
        return `- **${f}** (${tags.join(", ")})`;
      });
      return {
        content: [
          {
            type: "text" as const,
            text: formatted.join("\n") || "No notes found with this tag",
          },
        ],
      };
    },
  );

  server.tool(
    "reindex",
    "Re-index the vault. Use 'force' to rebuild from scratch.",
    {
      force: z
        .boolean()
        .default(false)
        .describe("Force full re-index (ignore cache)"),
    },
    async ({ force }) => {
      const stats = await indexVault(resolvedPath, store, {
        force,
        ignoredKeys,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Indexed ${stats.files} files, ${stats.chunks} chunks`,
          },
        ],
      };
    },
  );

  server.tool(
    "vault_stats",
    "Get statistics about the indexed vault.",
    {},
    async () => {
      const stats = store.getStats();
      return {
        content: [
          {
            type: "text" as const,
            text: `Files: ${stats.files}\nChunks: ${stats.chunks}`,
          },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server running on stdio");
}
