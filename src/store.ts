import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { dimensions } from "./embedder.js";

export interface StoredChunk {
  id: number;
  file: string;
  heading: string;
  text: string;
  startLine: number;
  tags: string;
  distance: number;
}

export function createStore(dbPath: string) {
  const db = new Database(dbPath, { nativeBinding: undefined });
  db.defaultSafeIntegers(false);
  sqliteVec.load(db);

  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA synchronous=NORMAL");

  // Check if we need to migrate (mtime → content_hash)
  const columns = db.prepare("PRAGMA table_info(chunks)").all() as {
    name: string;
  }[];
  const hasHash = columns.some((c) => c.name === "content_hash");
  if (columns.length > 0 && !hasHash) {
    db.exec("DROP TABLE IF EXISTS chunks_vec");
    db.exec("DROP TABLE IF EXISTS chunks");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file TEXT NOT NULL,
      heading TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      start_line INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      frontmatter TEXT NOT NULL DEFAULT '{}',
      content_hash TEXT NOT NULL DEFAULT ''
    )
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
      id INTEGER PRIMARY KEY,
      embedding float[${dimensions()}]
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS chunks_file_idx ON chunks(file)`);
  db.exec(`CREATE INDEX IF NOT EXISTS chunks_tags_idx ON chunks(tags)`);

  const insertChunk = db.prepare(`
    INSERT INTO chunks (file, heading, text, start_line, tags, frontmatter, content_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVec = db.prepare(`
    INSERT INTO chunks_vec (id, embedding) VALUES (?, ?)
  `);

  const deleteByFile = db.prepare(`DELETE FROM chunks WHERE file = ?`);
  const deleteVecByIds = db.prepare(
    `DELETE FROM chunks_vec WHERE id IN (SELECT id FROM chunks WHERE file = ?)`,
  );

  const getHash = db.prepare(
    `SELECT content_hash FROM chunks WHERE file = ? LIMIT 1`,
  );

  const allTags = db.prepare(
    `SELECT DISTINCT tags FROM chunks WHERE tags != '[]'`,
  );
  const byTag = db.prepare(
    `SELECT id, file, heading, text, start_line, tags FROM chunks WHERE tags LIKE ?`,
  );
  const byFile = db.prepare(
    `SELECT id, file, heading, text, start_line, tags, frontmatter FROM chunks WHERE file = ?`,
  );
  const allFiles = db.prepare(`SELECT DISTINCT file FROM chunks`);
  const stats = db.prepare(
    `SELECT COUNT(*) as chunks, COUNT(DISTINCT file) as files FROM chunks`,
  );

  return {
    upsertFile(
      file: string,
      chunks: {
        text: string;
        heading: string;
        startLine: number;
        tags: string[];
        frontmatter: Record<string, unknown>;
      }[],
      embeddings: Float32Array[],
      hash: string,
    ) {
      const tx = db.transaction(() => {
        deleteVecByIds.run(file);
        deleteByFile.run(file);
        for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i];
          const result = insertChunk.run(
            file,
            c.heading,
            c.text,
            c.startLine,
            JSON.stringify(c.tags),
            JSON.stringify(c.frontmatter),
            hash,
          );
          const id = BigInt(result.lastInsertRowid);
          insertVec.run(id, embeddings[i]);
        }
      });
      tx();
    },

    getFileHash(file: string): string | null {
      const row = getHash.get(file) as { content_hash: string } | undefined;
      return row?.content_hash ?? null;
    },

    removeFile(file: string) {
      const tx = db.transaction(() => {
        deleteVecByIds.run(file);
        deleteByFile.run(file);
      });
      tx();
    },

    search(embedding: Float32Array, limit: number = 10): StoredChunk[] {
      const stmt = db.prepare(`
        SELECT cv.id, cv.distance, c.file, c.heading, c.text, c.start_line, c.tags
        FROM chunks_vec cv
        JOIN chunks c ON c.id = cv.id
        WHERE embedding MATCH ? AND k = ?
        ORDER BY distance
      `);
      return stmt.all(Buffer.from(embedding.buffer), limit) as StoredChunk[];
    },

    getTags(): string[] {
      const rows = allTags.all() as { tags: string }[];
      const tags = new Set<string>();
      for (const row of rows) {
        for (const t of JSON.parse(row.tags)) tags.add(t);
      }
      return [...tags].sort();
    },

    searchByTag(tag: string): StoredChunk[] {
      return byTag.all(`%"${tag}"%`) as StoredChunk[];
    },

    getFile(file: string) {
      return byFile.all(file);
    },

    listFiles(): string[] {
      return (allFiles.all() as { file: string }[]).map((r) => r.file);
    },

    getStats(): { chunks: number; files: number } {
      return stats.get() as { chunks: number; files: number };
    },

    close() {
      db.close();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
