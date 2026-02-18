import { pipeline } from "@xenova/transformers";

const MODEL = "Xenova/multilingual-e5-small";
const DIMENSIONS = 384;

let extractor: any = null;

export async function init(): Promise<void> {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", MODEL);
  }
}

export async function embed(
  texts: string[],
  type: "query" | "passage" = "passage",
): Promise<Float32Array[]> {
  if (!extractor) await init();
  const prefix = type === "query" ? "query: " : "passage: ";
  const prefixed = texts.map((t) => prefix + t);
  const results: Float32Array[] = [];
  const batchSize = 32;
  for (let i = 0; i < prefixed.length; i += batchSize) {
    const batch = prefixed.slice(i, i + batchSize);
    const output = await extractor(batch, { pooling: "mean", normalize: true });
    for (let j = 0; j < batch.length; j++) {
      const embedding = output[j] as { data: Float32Array };
      results.push(new Float32Array(embedding.data));
    }
  }
  return results;
}

export function dimensions(): number {
  return DIMENSIONS;
}
