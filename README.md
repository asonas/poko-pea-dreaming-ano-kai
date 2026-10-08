# ぽこピーのゆめうつつのあの回

「[ぽこピーのゆめうつつ](https://www.youtube.com/@pokopeadreaming)」のあの回を探せるWebアプリケーションです。

会話の内容や雰囲気から関連するシーンを検索し、該当箇所のYouTubeリンク（タイムスタンプ付き）を表示します。

## 技術スタック

- **フロントエンド**: Next.js, Tailwind CSS
- **データベース**: Supabase (PostgreSQL + pgvector)
- **Embedding**: OpenAI text-embedding-3-small
- **文字起こし**: OpenAI Whisper

## データ更新

`scripts/run-pipeline.sh` を実行すると、リモートGPUマシンのDocker環境で
yt-dlpによる音源取得とWhisperによる書き起こしを行い、SRTをこのマシンへ取得します。
SRTの分割、埋め込み生成、Supabaseへのアップロードはこのマシンで実行します。
接続情報はスクリプト冒頭の案内に従い、envchainの `poko-pea` に登録します。

リモートのコードは実行時に `origin/main` から更新されるため、この変更をmainへ反映して
pushした後に実行してください。Dockerイメージは実行時にビルドされます。

既存の `data/audio/` はリモートにないファイルだけ転送し、`data/downloaded.txt` は
リモートの履歴と統合します。ローカルの音源がなくても実行できます。
音源と取得履歴はリモートに蓄積されます。取得が失敗した場合は後続処理を停止します。

## ライセンス

MIT
