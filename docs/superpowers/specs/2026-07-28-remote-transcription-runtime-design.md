# リモート文字起こし実行環境の復旧設計

## 背景

komachiでは、2026年7月22日9時32分までDocker ComposeによるWhisper文字起こしが動作していた。

同日18時の`git pull`は、komachiの`main`を`a03524f`から`fe05d1d`へ進めた。
この更新は`Dockerfile`、`docker-compose.yml`、`scripts/transcribe.py`を削除する一方で、それらを使用する`scripts/remote-transcribe.sh`を追加した。

その結果、音声ファイルの転送までは成功するが、リモートで`docker compose run`を実行すると`no configuration file provided: not found`で停止する。

## 目的

`scripts/run-pipeline.sh`を実行すると、komachiの`main`を安全に最新化し、NVIDIA GPUを使用して未処理の音声を文字起こしできる状態を復旧する。

更新後のリポジトリには、リモート文字起こしに必要な実行環境をすべて含める。
komachi固有の手作業でDocker関連ファイルを復元する運用は採用しない。

## 対象範囲

次の変更を対象とする。

- Whisper専用のDockerイメージ
- Docker ComposeによるGPU、データディレクトリ、モデルキャッシュの接続
- MP3ファイルからSRTファイルとテキストファイルを生成するスクリプト
- komachiの`main`を`git pull --ff-only origin main`で同期する処理
- 実行前の構成検査
- シェルスクリプトの回帰テスト

Webアプリケーション、Embedding生成、Supabaseへのアップロード処理は変更しない。

## 実行の流れ

ローカルの`run-pipeline.sh`は、従来どおり`remote-transcribe.sh`を呼び出す。

`remote-transcribe.sh`は、次の順序で処理する。

1. ローカルの未処理MP3ファイルを検出する。
2. SSHでkomachiへ接続する。
3. `REMOTE_PROJECT_DIR`がGitリポジトリであることを確認する。
4. komachiで`git pull --ff-only origin main`を実行する。
5. `Dockerfile`、Compose設定、`scripts/transcribe.py`の存在を確認する。
6. リモートの音声ディレクトリと出力ディレクトリを作成する。
7. 未処理MP3ファイルをkomachiへ転送する。
8. Compose設定を検証し、Whisperイメージをキャッシュ付きでビルドする。
9. 指定されたWhisperモデルをコンテナへ渡して文字起こしを実行する。
10. 生成されたSRTファイルをローカルへダウンロードする。

Git同期は音声転送より前に行う。
同期または構成検査に失敗した場合、不要なアップロードを始めないためである。

## Git同期の制約

komachiでは次のコマンドを使用する。

```bash
git pull --ff-only origin main
```

`--ff-only`は、komachiの`main`と`origin/main`が分岐した場合に自動マージを防ぐ。
分岐時はパイプラインを停止し、作業者が履歴を確認する。

未追跡ファイルは削除しない。
ローカルコミットのreset、rebase、強制pushも実行しない。

## Docker実行環境

Dockerイメージは、CUDA対応のPyTorch、OpenAI Whisper、ffmpegを含む。
CUDAとPyTorchの組み合わせはDockerfileで固定し、komachiのPython環境へ依存させない。

Compose設定は、次の領域をコンテナへ接続する。

- `scripts`：文字起こしスクリプトを読み取り専用で接続する。
- `data`：音声ファイルと文字起こし結果を読み書きする。
- Whisperモデルキャッシュ：モデルを実行のたびに再取得しないため、名前付きVolumeへ保存する。

Compose設定はNVIDIA GPUを1台要求する。
GPUを利用できない場合はCPUへ暗黙に切り替えず、実行を失敗させる。

## 文字起こし

文字起こしスクリプトは`data/audio`にあるMP3ファイルを列挙する。
対応するSRTファイルとテキストファイルの両方が存在する場合、その音声は処理済みとしてスキップする。

モデル名は`WHISPER_MODEL`から受け取り、未指定時は`large`を使用する。
言語は日本語、タスクは文字起こしに固定する。

個別ファイルの処理に失敗した場合はファイル名と例外を出力し、残りのファイルを処理する。
一件以上失敗した場合、スクリプト全体は非ゼロで終了し、パイプラインが成功扱いにならないようにする。

## エラー処理

次の失敗を区別して表示する。

- `REMOTE_PROJECT_DIR`が存在しない、またはGitリポジトリではない。
- `git pull --ff-only`が履歴の分岐や通信エラーで失敗する。
- Dockerfile、Compose設定、文字起こしスクリプトが不足している。
- Compose設定が不正である。
- Dockerイメージをビルドできない。
- NVIDIA GPUをコンテナから利用できない。
- Whisperが一件以上の音声を処理できない。
- SRTファイルをローカルへ取得できない。

エラー発生後は後続処理を実行しない。

## テスト

外部のSSH、rsync、Docker、Gitを実行しないシェルテストを追加する。
テストではコマンドを記録する偽実装をPATHの先頭に置き、スクリプトが発行したコマンドと順序を検証する。

最低限、次の振る舞いを対象とする。

- リモートのGit同期が音声転送より先に実行される。
- Git同期に`--ff-only origin main`が指定される。
- Git同期が失敗した場合、音声転送とDocker実行を開始しない。
- 必要ファイルが不足している場合、Docker実行を開始しない。
- 指定した`WHISPER_MODEL`がCompose実行へ渡される。

Pythonの文字起こし処理では、タイムスタンプのSRT変換と処理失敗時の終了状態を、Whisperモデルを読み込まずにテストする。

## komachiへの反映

修正をmainへ取り込んだ後、ローカルからパイプラインを再実行する。
パイプライン自身がkomachiでfast-forward pullを行うため、Docker関連ファイルと文字起こしスクリプトがkomachiへ反映される。

初回はDockerイメージを再ビルドする。
以後の実行はDockerのレイヤーキャッシュとWhisperモデルの名前付きVolumeを再利用する。
