# ぽこピーのゆめうつつ セマンティック検索

「[ぽこピーのゆめうつつ](https://www.youtube.com/@pokopeadreaming)」の文字起こしデータをセマンティック検索できるWebアプリケーションです。

会話の内容や雰囲気から関連するシーンを検索し、該当箇所のYouTubeリンク（タイムスタンプ付き）を表示します。

## 技術スタック

- **フロントエンド**: Next.js, Tailwind CSS
- **データベース**: Supabase (PostgreSQL + pgvector)
- **Embedding**: OpenAI text-embedding-3-small
- **文字起こし**: OpenAI Whisper

## ライセンス

MIT
