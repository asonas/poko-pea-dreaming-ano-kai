import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const transformers = vi.hoisted(() => {
  const extract = vi.fn(async () => ({
    data: Float32Array.from([0.25, -0.5]),
  }));

  return {
    env: {
      allowLocalModels: true,
      cacheDir: '',
    },
    extract,
    pipeline: vi.fn(async () => extract),
  };
});

vi.mock('@huggingface/transformers', () => ({
  env: transformers.env,
  pipeline: transformers.pipeline,
}));

import { generateQueryEmbedding } from './embeddings';

describe('generateQueryEmbedding', () => {
  beforeEach(() => {
    transformers.extract.mockClear();
    transformers.pipeline.mockClear();
  });

  it('uses the compatible quantized E5 feature-extraction pipeline', async () => {
    const result = await generateQueryEmbedding('たぬきの話');

    expect(transformers.pipeline).toHaveBeenCalledWith(
      'feature-extraction',
      'Xenova/multilingual-e5-small',
      { dtype: 'q8' },
    );
    expect(transformers.extract).toHaveBeenCalledWith('query: たぬきの話', {
      pooling: 'mean',
      normalize: true,
    });
    expect(result).toEqual([0.25, -0.5]);
    expect(transformers.env.cacheDir).toBe(join(tmpdir(), 'transformers-cache'));
    expect(transformers.env.allowLocalModels).toBe(false);
  });
});
