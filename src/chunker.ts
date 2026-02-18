import matter from "gray-matter";
import { createHash } from "crypto";

export interface Chunk {
  text: string;
  heading: string;
  file: string;
  startLine: number;
  tags: string[];
  frontmatter: Record<string, unknown>;
}

const MAX_CHUNK_SIZE = 1000;
const MIN_CHUNK_SIZE = 100;
const DEFAULT_IGNORED_KEYS = ["timesViewed", "date modified"];

export function contentHash(
  content: string,
  ignoredKeys: string[] = DEFAULT_IGNORED_KEYS,
): string {
  let frontmatter: Record<string, unknown> = {};
  let body: string;
  try {
    const parsed = matter(content);
    frontmatter = parsed.data;
    body = parsed.content;
  } catch {
    return createHash("sha256").update(content).digest("hex");
  }
  const stable = { ...frontmatter };
  for (const key of ignoredKeys) {
    delete stable[key];
  }
  const stableContent = matter.stringify(body, stable);
  return createHash("sha256").update(stableContent).digest("hex");
}

export function chunkMarkdown(content: string, filePath: string): Chunk[] {
  let frontmatter: Record<string, unknown> = {};
  let body: string;
  try {
    const parsed = matter(content);
    frontmatter = parsed.data;
    body = parsed.content;
  } catch {
    body = content;
  }
  const tags = extractTags(content, frontmatter);
  const lines = body.split("\n");
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let currentHeading = "";
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

    if (headingMatch && current.length > 0) {
      const text = current.join("\n").trim();
      if (text.length >= MIN_CHUNK_SIZE) {
        chunks.push(
          ...splitLargeChunk({
            text,
            heading: currentHeading,
            file: filePath,
            startLine,
            tags,
            frontmatter,
          }),
        );
      }
      current = [line];
      currentHeading = headingMatch[2];
      startLine = i + 1;
    } else {
      current.push(line);
      if (headingMatch) currentHeading = headingMatch[2];
    }
  }

  if (current.length > 0) {
    const text = current.join("\n").trim();
    if (text.length >= MIN_CHUNK_SIZE) {
      chunks.push(
        ...splitLargeChunk({
          text,
          heading: currentHeading,
          file: filePath,
          startLine,
          tags,
          frontmatter,
        }),
      );
    }
  }

  if (chunks.length === 0 && body.trim().length > 0) {
    chunks.push({
      text: body.trim(),
      heading: "",
      file: filePath,
      startLine: 1,
      tags,
      frontmatter,
    });
  }

  return chunks;
}

function splitLargeChunk(chunk: Chunk): Chunk[] {
  if (chunk.text.length <= MAX_CHUNK_SIZE) return [chunk];

  const parts: Chunk[] = [];
  const paragraphs = chunk.text.split(/\n\n+/);
  let current = "";
  let lineOffset = 0;

  for (const para of paragraphs) {
    if (current.length + para.length > MAX_CHUNK_SIZE && current.length > 0) {
      parts.push({
        ...chunk,
        text: current.trim(),
        startLine: chunk.startLine + lineOffset,
      });
      lineOffset += current.split("\n").length;
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }

  if (current.trim().length > 0) {
    parts.push({
      ...chunk,
      text: current.trim(),
      startLine: chunk.startLine + lineOffset,
    });
  }

  return parts;
}

function extractTags(
  content: string,
  frontmatter: Record<string, unknown>,
): string[] {
  const tags = new Set<string>();

  if (Array.isArray(frontmatter.tags)) {
    for (const t of frontmatter.tags) tags.add(String(t));
  }
  if (typeof frontmatter.tags === "string") {
    tags.add(frontmatter.tags);
  }
  if (typeof frontmatter.tag === "string") {
    tags.add(frontmatter.tag);
  }

  const inlineTags = content.match(/(?:^|\s)#([a-zA-Z][\w/-]*)/g);
  if (inlineTags) {
    for (const t of inlineTags) tags.add(t.trim().slice(1));
  }

  return [...tags];
}
