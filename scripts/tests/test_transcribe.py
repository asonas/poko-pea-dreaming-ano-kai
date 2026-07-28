import importlib.util
import tempfile
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


class SuccessfulModel:
    def transcribe(self, audio_path, **options):
        self.audio_path = audio_path
        self.options = options
        return {
            "segments": [
                {"start": 0.0, "end": 1.25, "text": " 最初 "},
                {"start": 1.25, "end": 2.5, "text": " 次 "},
            ]
        }


class FailingModel:
    def transcribe(self, _audio_path, **_options):
        raise RuntimeError("decode failed")


class TranscriptionRunTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.audio_dir = self.root / "audio"
        self.txt_dir = self.root / "transcripts" / "txt"
        self.srt_dir = self.root / "transcripts" / "srt"
        self.audio_dir.mkdir()

    def test_writes_srt_and_text_for_a_successful_transcription(self):
        transcribe = load_transcribe()
        audio_path = self.audio_dir / "episode.mp3"
        audio_path.write_bytes(b"audio")
        model = SuccessfulModel()
        loaded_models = []

        exit_code = transcribe.run(
            lambda name: loaded_models.append(name) or model,
            self.audio_dir,
            self.txt_dir,
            self.srt_dir,
            "medium",
        )

        self.assertEqual(0, exit_code)
        self.assertEqual(["medium"], loaded_models)
        self.assertEqual(str(audio_path), model.audio_path)
        self.assertEqual(
            {"language": "ja", "verbose": False, "task": "transcribe"},
            model.options,
        )
        self.assertEqual(
            "1\n"
            "00:00:00,000 --> 00:00:01,250\n"
            "最初\n\n"
            "2\n"
            "00:00:01,250 --> 00:00:02,500\n"
            "次\n\n",
            (self.srt_dir / "episode.srt").read_text(encoding="utf-8"),
        )
        self.assertEqual(
            "最初\n次\n",
            (self.txt_dir / "episode.txt").read_text(encoding="utf-8"),
        )

    def test_returns_nonzero_when_a_file_cannot_be_transcribed(self):
        transcribe = load_transcribe()
        (self.audio_dir / "broken.mp3").write_bytes(b"audio")

        exit_code = transcribe.run(
            lambda _name: FailingModel(),
            self.audio_dir,
            self.txt_dir,
            self.srt_dir,
            "large",
        )

        self.assertEqual(1, exit_code)
        self.assertFalse((self.srt_dir / "broken.srt").exists())
        self.assertFalse((self.txt_dir / "broken.txt").exists())

    def test_returns_nonzero_without_loading_a_model_when_audio_is_absent(self):
        transcribe = load_transcribe()
        loaded_models = []

        exit_code = transcribe.run(
            lambda name: loaded_models.append(name),
            self.audio_dir,
            self.txt_dir,
            self.srt_dir,
            "large",
        )

        self.assertEqual(1, exit_code)
        self.assertEqual([], loaded_models)

    def test_skips_completed_audio_without_loading_a_model(self):
        transcribe = load_transcribe()
        (self.audio_dir / "complete.mp3").write_bytes(b"audio")
        self.txt_dir.mkdir(parents=True)
        self.srt_dir.mkdir(parents=True)
        (self.txt_dir / "complete.txt").write_text("done\n", encoding="utf-8")
        (self.srt_dir / "complete.srt").write_text("done\n", encoding="utf-8")
        loaded_models = []

        exit_code = transcribe.run(
            lambda name: loaded_models.append(name),
            self.audio_dir,
            self.txt_dir,
            self.srt_dir,
            "large",
        )

        self.assertEqual(0, exit_code)
        self.assertEqual([], loaded_models)
