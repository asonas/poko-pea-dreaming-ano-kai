export interface EmbeddingDebugInfo {
  first10: number[];
  dimension: number;
  stats: {
    min: number;
    max: number;
    mean: number;
    norm: number;
  };
}

export function computeEmbeddingDebugInfo(embedding: number[]): EmbeddingDebugInfo {
  const first10 = embedding.slice(0, 10);
  const dimension = embedding.length;
  const min = Math.min(...embedding);
  const max = Math.max(...embedding);
  const mean = embedding.reduce((sum, v) => sum + v, 0) / embedding.length;
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));

  return {
    first10,
    dimension,
    stats: { min, max, mean, norm },
  };
}
