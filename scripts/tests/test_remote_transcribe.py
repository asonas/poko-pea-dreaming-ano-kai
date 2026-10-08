import os
import shlex
import shutil
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path


SOURCE_SCRIPT = Path(__file__).parents[1] / "remote-transcribe.sh"


class RemoteTranscribeTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.local_project = self.root / "local-project"
        self.remote_project = self.root / "remote-project"
        self.fake_bin = self.root / "fake-bin"
        self.command_log = self.root / "commands.log"
        self.ssh_log = self.root / "ssh.log"

        (self.local_project / "scripts").mkdir(parents=True)
        (self.local_project / "data" / "audio").mkdir(parents=True)
        (self.local_project / "data" / "audio" / "episode.mp3").write_bytes(
            b"audio"
        )
        self.remote_project.mkdir()
        self.fake_bin.mkdir()
        shutil.copy2(
            SOURCE_SCRIPT,
            self.local_project / "scripts" / "remote-transcribe.sh",
        )

        self.write_executable(
            "ssh",
            """
            #!/usr/bin/env python3
            import os
            import subprocess
            import sys

            arguments = sys.argv[1:]
            with open(os.environ["SSH_LOG"], "a", encoding="utf-8") as log:
                log.write(" ".join(arguments) + "\\n")

            if "bash" not in arguments:
                raise SystemExit(0)

            bash_index = arguments.index("bash")
            environment = os.environ.copy()
            environment.pop("WHISPER_MODEL", None)
            completed = subprocess.run(
                arguments[bash_index:],
                env=environment,
            )
            raise SystemExit(completed.returncode)
            """,
        )
        self.write_executable(
            "git",
            """
            #!/bin/bash
            printf 'git' >> "$COMMAND_LOG"
            printf ' %s' "$@" >> "$COMMAND_LOG"
            printf '\\n' >> "$COMMAND_LOG"
            exit "${FAKE_GIT_EXIT:-0}"
            """,
        )
        self.write_executable(
            "docker",
            """
            #!/bin/bash
            printf 'WHISPER_MODEL=%s docker' "${WHISPER_MODEL:-}" >> "$COMMAND_LOG"
            printf ' %s' "$@" >> "$COMMAND_LOG"
            printf '\\n' >> "$COMMAND_LOG"
            if [[ "$*" == *download.sh* ]]; then
                [[ "${FAKE_DOWNLOAD_EXIT:-0}" == 0 ]] || exit "$FAKE_DOWNLOAD_EXIT"
                touch data/audio/downloaded.mp3
            fi
            """,
        )
        self.write_executable(
            "rsync",
            """
            #!/bin/bash
            printf 'rsync' >> "$COMMAND_LOG"
            printf ' %s' "$@" >> "$COMMAND_LOG"
            printf '\\n' >> "$COMMAND_LOG"
            """,
        )

    def write_executable(self, name, source):
        executable = self.fake_bin / name
        executable.write_text(
            textwrap.dedent(source).lstrip(),
            encoding="utf-8",
        )
        executable.chmod(0o755)

    def run_script(self, *, git_exit="0", download_exit="0"):
        environment = os.environ.copy()
        environment.update(
            {
                "COMMAND_LOG": str(self.command_log),
                "FAKE_GIT_EXIT": git_exit,
                "FAKE_DOWNLOAD_EXIT": download_exit,
                "PATH": f"{self.fake_bin}{os.pathsep}{environment['PATH']}",
                "REMOTE_HOST": "komachi.test",
                "REMOTE_PORT": "2222",
                "REMOTE_PROJECT_DIR": str(self.remote_project),
                "REMOTE_USER": "asonas",
                "SSH_LOG": str(self.ssh_log),
                "WHISPER_MODEL": "medium",
            }
        )
        return subprocess.run(
            [str(self.local_project / "scripts" / "remote-transcribe.sh")],
            capture_output=True,
            env=environment,
            text=True,
        )

    def logged_commands(self):
        if not self.command_log.exists():
            return ""
        return self.command_log.read_text(encoding="utf-8")

    def logged_ssh_connections(self):
        return self.ssh_log.read_text(encoding="utf-8").splitlines()

    def create_remote_runtime(self, *, include_compose=True):
        (self.remote_project / "Dockerfile").write_text(
            "FROM scratch\n",
            encoding="utf-8",
        )
        (self.remote_project / "scripts").mkdir()
        (self.remote_project / "scripts" / "transcribe.py").write_text(
            "",
            encoding="utf-8",
        )
        (self.remote_project / "scripts" / "download.sh").write_text("")
        if include_compose:
            (self.remote_project / "docker-compose.yml").write_text(
                "services: {}\n",
                encoding="utf-8",
            )

    def test_stops_before_upload_when_git_sync_fails(self):
        result = self.run_script(git_exit="23")

        self.assertNotEqual(0, result.returncode)
        self.assertIn("git pull --ff-only origin main", self.logged_commands())
        self.assertNotIn("rsync", self.logged_commands())
        self.assertNotIn("docker", self.logged_commands())

    def test_stops_before_upload_when_runtime_file_is_missing(self):
        self.create_remote_runtime(include_compose=False)

        result = self.run_script()

        self.assertNotEqual(0, result.returncode)
        self.assertIn(
            "Required remote runtime file not found: docker-compose.yml",
            result.stderr,
        )
        self.assertNotIn("rsync", self.logged_commands())
        self.assertNotIn("docker", self.logged_commands())

    def test_syncs_builds_downloads_and_transcribes(self):
        self.create_remote_runtime()

        result = self.run_script()

        self.assertEqual(0, result.returncode, result.stderr)
        commands = self.logged_commands().splitlines()
        self.assertEqual("git pull --ff-only origin main", commands[0])
        self.assertEqual(
            "WHISPER_MODEL= docker compose config --quiet",
            commands[1],
        )
        self.assertEqual(
            "WHISPER_MODEL= docker compose build whisper",
            commands[2],
        )
        self.assertTrue(commands[3].startswith("rsync "))
        self.assertIn("--ignore-existing", commands[3])
        self.assertIn("/audio/", commands[3])
        self.assertEqual(
            "WHISPER_MODEL= docker compose run --rm whisper "
            "bash /app/scripts/download.sh",
            commands[4],
        )
        self.assertEqual(
            "WHISPER_MODEL=medium docker compose run --rm whisper "
            "python /app/scripts/transcribe.py",
            commands[5],
        )
        self.assertTrue(commands[6].startswith("rsync "))
        self.assertIn("/srt/", commands[6])

    def test_forwards_agent_only_for_git_sync(self):
        self.create_remote_runtime()

        result = self.run_script()

        self.assertEqual(0, result.returncode, result.stderr)
        connections = self.logged_ssh_connections()
        self.assertEqual(2, len(connections))
        self.assertIn("-A", shlex.split(connections[0]))
        self.assertNotIn("-A", shlex.split(connections[1]))

    def test_downloads_without_local_audio(self):
        self.create_remote_runtime()
        shutil.rmtree(self.local_project / "data" / "audio")
        result = self.run_script()
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("bash /app/scripts/download.sh", self.logged_commands())
        self.assertNotIn("--ignore-existing", self.logged_commands())

    def test_download_failure_stops_transcription_and_result_sync(self):
        self.create_remote_runtime()
        result = self.run_script(download_exit="17")
        self.assertNotEqual(0, result.returncode)
        self.assertNotIn("python /app/scripts/transcribe.py", self.logged_commands())
        self.assertNotIn("/srt/", self.logged_commands())

    def test_merges_download_history_without_losing_remote_entries(self):
        self.create_remote_runtime()
        data = self.remote_project / "data"
        data.mkdir()
        (data / "downloaded.txt").write_text("youtube remote\nyoutube shared\n")
        (data / "downloaded.local.txt").write_text("youtube local\nyoutube shared\n")
        result = self.run_script()
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(
            "youtube local\nyoutube remote\nyoutube shared\n",
            (data / "downloaded.txt").read_text(),
        )
        self.assertFalse((data / "downloaded.local.txt").exists())


class DownloadTest(unittest.TestCase):
    def test_empty_download_succeeds_and_download_failure_is_propagated(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / "scripts"
            scripts.mkdir()
            script = scripts / "download.sh"
            shutil.copy2(SOURCE_SCRIPT.with_name("download.sh"), script)
            fake_bin = root / "bin"
            fake_bin.mkdir()
            downloader = fake_bin / "yt-dlp"
            downloader.write_text('#!/bin/bash\nexit "${DOWNLOAD_EXIT:-0}"\n')
            downloader.chmod(0o755)
            environment = os.environ.copy()
            environment["PATH"] = f"{fake_bin}{os.pathsep}{environment['PATH']}"
            for exit_code in (0, 19):
                with self.subTest(exit_code=exit_code):
                    environment["DOWNLOAD_EXIT"] = str(exit_code)
                    result = subprocess.run(
                        [str(script)], env=environment, capture_output=True, text=True,
                    )
                    self.assertEqual(exit_code, result.returncode, result.stderr)
                    if exit_code == 0:
                        self.assertIn("Total: 0", result.stdout)
                    else:
                        self.assertNotIn("Download complete!", result.stdout)
