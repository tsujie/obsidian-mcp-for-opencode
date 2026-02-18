import { glob } from "glob";
import { readFile } from "fs/promises";
import path from "path";
import { chunkMarkdown, contentHash } from "./chunker.js";
import { embed, init as initEmbedder } from "./embedder.js";
import type { Store } from "./store.js";

export async function indexVault(
  vaultPath: string,
  store: Store,
  opts: { force?: boolean; ignoredKeys?: string[] } = {},
) {
  await initEmbedder();

  const files = await glob("**/*.md", {
    cwd: vaultPath,
    ignore: ["node_modules/**", ".obsidian/**", ".trash/**"],
    absolute: false,
  });

  console.error(`Found ${files.length} markdown files`);

  const indexedFiles = store.listFiles();
  const fileSet = new Set(files);
  let removed = 0;
  for (const f of indexedFiles) {
    if (!fileSet.has(f)) {
      store.removeFile(f);
      removed++;
    }
  }
  if (removed > 0) console.error(`Cleaned up ${removed} orphaned files`);

  let indexed = 0;
  let skipped = 0;
  const batchSize = 50;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const toProcess: { file: string; content: string; hash: string }[] = [];

    for (const file of batch) {
      try {
        const fullPath = path.join(vaultPath, file);
        const content = await readFile(fullPath, "utf-8");
        const hash = contentHash(content, opts.ignoredKeys);

        if (!opts.force) {
          const storedHash = store.getFileHash(file);
          if (storedHash === hash) {
            skipped++;
            continue;
          }
        }

        toProcess.push({ file, content, hash });
      } catch (err) {
        console.error(
          `Warning: failed to read ${file}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (toProcess.length === 0) continue;

    for (const { file, content, hash } of toProcess) {
      try {
        const chunks = chunkMarkdown(content, file);
        if (chunks.length === 0) continue;

        const texts = chunks.map((c) => c.text);
        const embeddings = await embed(texts);

        store.upsertFile(
          file,
          chunks.map((c) => ({
            text: c.text,
            heading: c.heading,
            startLine: c.startLine,
            tags: c.tags,
            frontmatter: c.frontmatter,
          })),
          embeddings,
          hash,
        );
        indexed++;
      } catch (err) {
        console.error(
          `Warning: failed to index ${file}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    console.error(
      `Progress: ${Math.min(i + batchSize, files.length)}/${files.length} files processed (${indexed} indexed, ${skipped} skipped)`,
    );
  }

  const stats = store.getStats();
  console.error(`Done: ${stats.files} files, ${stats.chunks} chunks indexed`);
  return stats;
}
