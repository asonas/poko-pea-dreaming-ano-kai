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
