# Remote Transcription Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the repository-managed Whisper GPU runtime and make `scripts/run-pipeline.sh` safely synchronize komachi before remote transcription.

**Architecture:** Keep Whisper and its CUDA dependencies in a dedicated Docker Compose service on komachi. The local orchestration script performs a fast-forward-only pull and validates the remote runtime before uploading audio, while Python and shell integration tests exercise transcription results and command ordering without loading a Whisper model or contacting komachi.

**Tech Stack:** Bash, Python standard-library `unittest`, Docker Compose, NVIDIA Container Toolkit, OpenAI Whisper, Git, SSH, rsync

## Global Constraints

- Synchronize komachi with `git pull --ff-only origin main`; never reset, rebase, force-push, delete untracked files, or create an automatic merge.
- Require an NVIDIA GPU and fail instead of silently falling back to CPU.
- Default `WHISPER_MODEL` to `large` and propagate an explicit value into the Compose service.
- Persist downloaded Whisper models in a named Docker Volume.
- Stop the pipeline after Git, runtime validation, build, GPU, transcription, or download failures.
- Do not change the web application, embedding generation, or Supabase upload behavior.
- Use `git ai-commit` for every commit and keep structural and behavioral changes separate.

---

### Task 1: Restore the testable Whisper transcription program

**Files:**
- Create: `scripts/transcribe.py`
- Create: `scripts/tests/test_transcribe.py`

**Interfaces:**
- Produces: `format_timestamp(seconds: float) -> str`
- Produces: `run(model_loader, audio_dir: Path, output_txt_dir: Path, output_srt_dir: Path, model_name: str) -> int`
- Produces: CLI behavior that exits `0` when every file succeeds or is skipped and exits nonzero when input is absent or any file fails.

- [ ] **Step 1: Write the failing timestamp test**

Create `scripts/tests/test_transcribe.py` with an import helper that loads `scripts/transcribe.py` by path without importing Whisper:

```python
import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).parents[1] / "transcribe.py"


def load_transcribe():
    spec = importlib.util.spec_from_file_location("transcribe", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class FormatTimestampTest(unittest.TestCase):
    def test_formats_hours_minutes_seconds_and_milliseconds(self):
        transcribe = load_transcribe()

        self.assertEqual("01:01:01,234", transcribe.format_timestamp(3661.234))
```

- [ ] **Step 2: Run the timestamp test and verify RED**

Run:

```bash
python3 -m unittest scripts.tests.test_transcribe.FormatTimestampTest -v
```

Expected: `FileNotFoundError` because `scripts/transcribe.py` does not exist.

- [ ] **Step 3: Implement timestamp formatting without importing Whisper**

Create `scripts/transcribe.py` with `format_timestamp`, `write_srt`, and `write_txt`.
Keep `import whisper` out of module scope so the unit tests run on machines without the GPU dependency:

```python
def format_timestamp(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
```

- [ ] **Step 4: Run the timestamp test and verify GREEN**

Run:

```bash
python3 -m unittest scripts.tests.test_transcribe.FormatTimestampTest -v
```

Expected: one passing test.

- [ ] **Step 5: Write the failing processing tests**

Add tests using temporary audio and output directories plus small fake model classes.
The successful fake returns two literal segments; the failing fake raises `RuntimeError("decode failed")`.

```python
class SuccessfulModel:
    def transcribe(self, _audio_path, **_options):
        return {
            "segments": [
                {"start": 0.0, "end": 1.25, "text": " 最初 "},
                {"start": 1.25, "end": 2.5, "text": " 次 "},
            ]
        }


class FailingModel:
    def transcribe(self, _audio_path, **_options):
        raise RuntimeError("decode failed")
```

Assert these observable results:

- a successful run returns `0` and writes hand-derived SRT and text contents;
- a failed file makes `run` return `1`;
- an empty audio directory makes `run` return `1`;
- existing SRT and text outputs cause the matching MP3 to be skipped without calling the loader.

- [ ] **Step 6: Run the processing tests and verify RED**

Run:

```bash
python3 -m unittest scripts.tests.test_transcribe -v
```

Expected: failures because `run` is not defined.

- [ ] **Step 7: Implement the minimal processing loop and CLI**

Implement `run` with injected `model_loader`.
Create output directories, sort `*.mp3`, load the model once, process remaining files, and count failures.
Return `1` when no MP3 files exist or at least one transcription fails.

At the CLI boundary only, import Whisper and exit with the return value:

```python
def main() -> int:
    import whisper

    return run(
        whisper.load_model,
        Path("/app/data/audio"),
        Path("/app/data/transcripts/txt"),
        Path("/app/data/transcripts/srt"),
        os.environ.get("WHISPER_MODEL", "large"),
    )


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 8: Run the Python tests and verify GREEN**

Run:

```bash
python3 -m unittest scripts.tests.test_transcribe -v
```

Expected: all transcription tests pass without installing Whisper.

- [ ] **Step 9: Commit the transcription program**

Run:

```bash
git add scripts/transcribe.py scripts/tests/test_transcribe.py
git ai-commit --context "Restore the Whisper transcription program with tests for output, skipping, and failure status. Use an English sentence-style commit message without Conventional Commits formatting."
```

Expected: one behavioral commit containing only the Python program and its tests.

### Task 2: Restore the Docker Compose GPU runtime

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `scripts/tests/test_compose_config.py`

**Interfaces:**
- Consumes: `/app/scripts/transcribe.py` from Task 1
- Produces: Compose service `whisper`
- Produces: named Volume `whisper-model-cache`
- Produces: container paths `/app/scripts`, `/app/data`, and `/root/.cache/whisper`

- [ ] **Step 1: Write the failing Compose behavior test**

Create `scripts/tests/test_compose_config.py`.
Run the real Compose parser, request JSON, and assert the resolved service contract:

```python
import json
import subprocess
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).parents[2]


class ComposeConfigTest(unittest.TestCase):
    def test_whisper_service_connects_gpu_data_scripts_and_model_cache(self):
        result = subprocess.run(
            [
                "docker",
                "compose",
                "-f",
                str(PROJECT_DIR / "docker-compose.yml"),
                "config",
                "--format",
                "json",
            ],
            cwd=PROJECT_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        config = json.loads(result.stdout)
        service = config["services"]["whisper"]

        volumes = {volume["target"]: volume for volume in service["volumes"]}
        self.assertTrue(volumes["/app/scripts"]["read_only"])
        self.assertEqual("bind", volumes["/app/data"]["type"])
        self.assertEqual("volume", volumes["/root/.cache/whisper"]["type"])
        self.assertEqual("large", service["environment"]["WHISPER_MODEL"])
        self.assertEqual(
            ["gpu"],
            service["deploy"]["resources"]["reservations"]["devices"][0][
                "capabilities"
            ],
        )
```

- [ ] **Step 2: Run the Compose test and verify RED**

Run:

```bash
python3 -m unittest scripts.tests.test_compose_config -v
```

Expected: failure because `docker-compose.yml` does not exist.

- [ ] **Step 3: Add the minimal Compose service and Dockerfile**

Create `docker-compose.yml` with:

```yaml
services:
  whisper:
    build: .
    image: poko-pea-whisper
    working_dir: /app
    environment:
      WHISPER_MODEL: ${WHISPER_MODEL:-large}
      NVIDIA_VISIBLE_DEVICES: all
    volumes:
      - ./scripts:/app/scripts:ro
      - ./data:/app/data
      - whisper-model-cache:/root/.cache/whisper
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities:
                - gpu

volumes:
  whisper-model-cache:
```

Create a focused `Dockerfile` based on `nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04`.
Install Python, ffmpeg, Git, CUDA-enabled PyTorch from the CUDA 12.4 wheel index, and `openai-whisper`.
Do not reinstall yt-dlp or sentence-transformers because the service only performs transcription.

- [ ] **Step 4: Run the Compose test and verify GREEN**

Run:

```bash
python3 -m unittest scripts.tests.test_compose_config -v
docker compose -f docker-compose.yml config --quiet
```

Expected: the unit test and Compose validation pass.

- [ ] **Step 5: Commit the Docker runtime**

Run:

```bash
git add Dockerfile docker-compose.yml scripts/tests/test_compose_config.py
git ai-commit --context "Restore the focused NVIDIA GPU Docker Compose runtime and verify its resolved service contract. Use an English sentence-style commit message without Conventional Commits formatting."
```

Expected: one behavioral commit containing only the container runtime and its test.

### Task 3: Synchronize and validate komachi before uploading audio

**Files:**
- Modify: `scripts/remote-transcribe.sh`
- Create: `scripts/tests/test_remote_transcribe.py`

**Interfaces:**
- Consumes: Compose service `whisper` from Task 2
- Consumes: environment variables `REMOTE_HOST`, `REMOTE_USER`, `REMOTE_PORT`, `REMOTE_PROJECT_DIR`, and optional `WHISPER_MODEL`
- Produces: fast-forward-only synchronization before rsync
- Produces: nonzero exit without upload when synchronization or runtime validation fails

- [ ] **Step 1: Write the failing Git error integration test**

Create `scripts/tests/test_remote_transcribe.py`.
In a temporary project, copy the real script, create one MP3 file, and create a fake remote project containing the three required runtime files.

Place executable test doubles for `ssh`, `git`, `docker`, and `rsync` at the front of `PATH`.
The `ssh` double discards connection arguments and executes the passed `bash -s` script locally.
The other doubles append their command and relevant environment to `COMMAND_LOG`.

Configure the fake `git` executable to exit `23`.
Assert that the script returns nonzero and `COMMAND_LOG` contains neither rsync nor Docker commands.

The mutation this catches is continuing without synchronizing the remote checkout or continuing after a failed fast-forward pull.

- [ ] **Step 2: Run the Git error test and verify RED**

Run:

```bash
python3 -m unittest scripts.tests.test_remote_transcribe.RemoteTranscribeTest.test_stops_before_upload_when_git_sync_fails -v
```

Expected: failure because the current script never invokes Git and proceeds to rsync.

- [ ] **Step 3: Implement the minimal remote synchronization**

Before creating remote data directories or uploading files, execute a quoted remote Bash script through SSH:

```bash
cd "$remote_project_dir"
git pull --ff-only origin main
```

Pass `REMOTE_PROJECT_DIR` as a positional argument to `bash -s --` rather than interpolating it into remote shell source.
Rely on `set -euo pipefail` locally and remotely so a nonzero Git status stops before rsync.

- [ ] **Step 4: Run the Git error test and verify GREEN**

Run:

```bash
python3 -m unittest scripts.tests.test_remote_transcribe.RemoteTranscribeTest.test_stops_before_upload_when_git_sync_fails -v
```

Expected: one passing integration test.

- [ ] **Step 5: Write the failing missing-runtime test**

Allow the fake Git command to succeed and remove `docker-compose.yml` from the fake remote project.
Assert that the script returns nonzero, reports `Required remote runtime file not found: docker-compose.yml`, and logs neither rsync nor Docker execution.

The mutation this catches is starting upload or Docker after an incomplete pull.

- [ ] **Step 6: Run the missing-runtime test and verify RED**

Run:

```bash
python3 -m unittest scripts.tests.test_remote_transcribe.RemoteTranscribeTest.test_stops_before_upload_when_runtime_file_is_missing -v
```

Expected: failure because the synchronization added in Step 3 does not inspect the runtime files.

- [ ] **Step 7: Implement the minimal runtime validation**

After Git synchronization, check the required files and create data directories:

```bash
for required_file in Dockerfile docker-compose.yml scripts/transcribe.py; do
    if [[ ! -f "$required_file" ]]; then
        echo "Required remote runtime file not found: $required_file" >&2
        exit 1
    fi
done

mkdir -p data/audio data/transcripts/txt data/transcripts/srt
```

- [ ] **Step 8: Run the missing-runtime test and verify GREEN**

Run:

```bash
python3 -m unittest scripts.tests.test_remote_transcribe.RemoteTranscribeTest.test_stops_before_upload_when_runtime_file_is_missing -v
```

Expected: one passing integration test.

- [ ] **Step 9: Write the failing happy-path integration test**

Allow Git to succeed and provide all three runtime files.
Run the copied script with `WHISPER_MODEL=medium` and assert the literal command order:

```text
git pull --ff-only origin main
docker compose config --quiet
docker compose build whisper
rsync upload
WHISPER_MODEL=medium docker compose run --rm whisper python /app/scripts/transcribe.py
rsync download
```

The mutation this catches is moving Git synchronization after upload or dropping `--ff-only`, `origin`, `main`, the build, or model propagation.

- [ ] **Step 10: Run the happy-path test and verify RED**

Run:

```bash
python3 -m unittest scripts.tests.test_remote_transcribe.RemoteTranscribeTest.test_syncs_validates_and_builds_before_upload -v
```

Expected: failure because the script does not validate Compose, build the image, or propagate `WHISPER_MODEL`.

- [ ] **Step 11: Implement Compose validation, build, and model propagation**

Extend the first remote script after directory creation:

```bash
docker compose config --quiet
docker compose build whisper
```

Run transcription through a second quoted remote script.
Pass `REMOTE_PROJECT_DIR` and `WHISPER_MODEL` as positional arguments, then use:

```bash
WHISPER_MODEL="$whisper_model" \
    docker compose run --rm whisper python /app/scripts/transcribe.py
```

- [ ] **Step 12: Run the happy-path test and verify GREEN**

Run:

```bash
python3 -m unittest scripts.tests.test_remote_transcribe.RemoteTranscribeTest.test_syncs_validates_and_builds_before_upload -v
```

Expected: one passing integration test.

- [ ] **Step 13: Run shell syntax and all orchestration tests**

Run:

```bash
bash -n scripts/remote-transcribe.sh scripts/run-pipeline.sh
python3 -m unittest scripts.tests.test_remote_transcribe -v
```

Expected: shell syntax validation and all remote orchestration tests pass.

- [ ] **Step 14: Commit remote synchronization**

Run:

```bash
git add scripts/remote-transcribe.sh scripts/tests/test_remote_transcribe.py
git ai-commit --context "Synchronize and validate the komachi runtime before uploading audio, with integration tests for ordering and failure behavior. Use an English sentence-style commit message without Conventional Commits formatting."
```

Expected: one behavioral commit containing only remote orchestration and its tests.

### Task 4: Verify, integrate, and activate the runtime on komachi

**Files:**
- Verify only: all files changed in Tasks 1 through 3

**Interfaces:**
- Consumes: the complete branch implementation
- Produces: updated `origin/main` and a validated komachi runtime

- [ ] **Step 1: Run the complete local verification suite**

Run:

```bash
python3 -m unittest discover -s scripts/tests -v
bash -n scripts/remote-transcribe.sh scripts/run-pipeline.sh
docker compose -f docker-compose.yml config --quiet
git --no-pager diff --check origin/main...HEAD
```

Expected: all tests and validation commands pass with no warnings.

- [ ] **Step 2: Review the branch**

Run:

```bash
git status --short --branch
git --no-pager log --oneline origin/main..HEAD
git --no-pager diff --stat origin/main...HEAD
git --no-pager diff origin/main...HEAD
```

Expected: only the approved design, plan, Docker runtime, transcription program, orchestration changes, and their tests are present.

- [ ] **Step 3: Merge the completed branch into local main**

From the original worktree, fetch and require a fast-forward integration:

```bash
git fetch origin
git merge --ff-only bugfix/restore-remote-transcription
```

Expected: local `main` advances without a merge commit.

- [ ] **Step 4: Push main**

Run:

```bash
git push origin main
```

Expected: `origin/main` advances to the verified implementation.

- [ ] **Step 5: Synchronize komachi without touching untracked files**

Run:

```bash
ssh komachi 'git -C /home/asonas/ghq/github.com/asonas/poko-pea-dreaming-ano-kai pull --ff-only origin main'
```

Expected: komachi fast-forwards and its untracked design file remains unchanged.

- [ ] **Step 6: Validate and build the runtime on komachi**

Point Compose explicitly at the remote project without changing the shell directory:

```bash
ssh komachi 'docker compose --project-directory /home/asonas/ghq/github.com/asonas/poko-pea-dreaming-ano-kai -f /home/asonas/ghq/github.com/asonas/poko-pea-dreaming-ano-kai/docker-compose.yml config --quiet'
ssh komachi 'docker compose --project-directory /home/asonas/ghq/github.com/asonas/poko-pea-dreaming-ano-kai -f /home/asonas/ghq/github.com/asonas/poko-pea-dreaming-ano-kai/docker-compose.yml build whisper'
```

Expected: Compose validation and the cached image build succeed.

- [ ] **Step 7: Verify GPU and Whisper imports on komachi**

Run:

```bash
ssh komachi 'docker compose --project-directory /home/asonas/ghq/github.com/asonas/poko-pea-dreaming-ano-kai -f /home/asonas/ghq/github.com/asonas/poko-pea-dreaming-ano-kai/docker-compose.yml run --rm whisper python -c "import torch, whisper; assert torch.cuda.is_available(); print(torch.cuda.get_device_name(0))"'
```

Expected: the command prints the NVIDIA GPU name and exits zero.

- [ ] **Step 8: Confirm final Git state**

Run:

```bash
git status --short --branch
ssh komachi 'git -C /home/asonas/ghq/github.com/asonas/poko-pea-dreaming-ano-kai status --short --branch'
```

Expected: the local implementation worktree is clean; komachi is synchronized with `origin/main` and retains only its pre-existing untracked file.
