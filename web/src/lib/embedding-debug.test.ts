import { describe, it, expect } from 'vitest';
import { computeEmbeddingDebugInfo } from './embedding-debug';

describe('computeEmbeddingDebugInfo', () => {
  it('embeddingベクトルから先頭10要素とstatisticsを返す', () => {
    const embedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2];

    const result = computeEmbeddingDebugInfo(embedding);

    expect(result.first10).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]);
    expect(result.dimension).toBe(12);
    expect(result.stats.min).toBeCloseTo(0.1);
    expect(result.stats.max).toBeCloseTo(1.2);
    expect(result.stats.mean).toBeCloseTo(0.65);
  });

  it('10要素未満の場合はすべての要素を返す', () => {
    const embedding = [0.5, -0.3, 0.8];

    const result = computeEmbeddingDebugInfo(embedding);

    expect(result.first10).toEqual([0.5, -0.3, 0.8]);
    expect(result.dimension).toBe(3);
    expect(result.stats.min).toBeCloseTo(-0.3);
    expect(result.stats.max).toBeCloseTo(0.8);
  });

  it('normを計算する', () => {
    // 3-4-5三角形: norm = sqrt(9+16+25) = sqrt(50)
    const embedding = [3, 4, 5];

    const result = computeEmbeddingDebugInfo(embedding);

    expect(result.stats.norm).toBeCloseTo(Math.sqrt(50));
  });
});
