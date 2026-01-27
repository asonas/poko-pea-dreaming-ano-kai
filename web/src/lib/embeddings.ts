import { pipeline, env } from '@xenova/transformers';

// モデルのキャッシュを有効化
env.cacheDir = './.cache';
env.allowLocalModels = false;

// モデル名（Pythonスクリプトと同じモデルを使用）
const MODEL_NAME = 'Xenova/multilingual-e5-small';

// パイプラインのシングルトン
let embeddingPipeline: any = null;

/**
 * Embeddingパイプラインを取得（遅延初期化）
 */
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('Loading embedding model...');
    embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: true, // 量子化モデルを使用（軽量化）
    });
    console.log('Embedding model loaded.');
  }
  return embeddingPipeline;
}

/**
 * テキストからEmbeddingを生成
 * E5モデルは検索クエリに "query: " プレフィックスを使用
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  
  // E5モデル用のプレフィックスを追加
  const queryText = `query: ${text}`;
  
  // Embedding生成
  const output = await pipe(queryText, {
    pooling: 'mean',
    normalize: true,
  });
  
  // Float32Arrayを通常の配列に変換
  return Array.from(output.data);
}
