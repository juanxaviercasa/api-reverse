"""GitHub runner entry point. Inputs arrive through environment, never shell code."""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

from .config import ConfigManager
from .knowledge import PROFILES, export_har, validate_source_url, write_json
from .utils import OUTPUT_LANGUAGE_EXTENSIONS, get_config_path


def main() -> None:
    run_id = os.environ["INPUT_RUN_ID"]
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", run_id):
        raise ValueError("Invalid run identifier")
    target = validate_source_url(os.environ["INPUT_URL"])
    prompt = os.environ["INPUT_PROMPT"].strip()
    language = os.environ.get("INPUT_LANGUAGE", "python")
    profile = os.environ.get("INPUT_PROFILE", "general")
    if not prompt or len(prompt) > 12000 or language not in OUTPUT_LANGUAGE_EXTENSIONS or profile not in PROFILES:
        raise ValueError("Invalid prompt, language or profile")
    config = ConfigManager(get_config_path())
    config.update({"output_language": language, "real_time_sync": False, "sdk": "claude", "agent_provider": "auto"})
    work = Path(".capture-work") / run_id
    delivery = Path("generated") / run_id
    work.mkdir(parents=True, exist_ok=True)
    delivery.mkdir(parents=True, exist_ok=True)
    with (work / "result.json").open("w", encoding="utf-8") as stream:
        completed = subprocess.run(
            [sys.executable, "-m", "reverse_api.cli", "agent", "--url", target,
             "--prompt", prompt, "--headless", "--output-dir", str(work.resolve()), "--json"],
            stdout=stream, check=False, timeout=660,
        )
    result = json.loads((work / "result.json").read_text(encoding="utf-8-sig"))
    if completed.returncode or result.get("status") != "ok":
        raise RuntimeError("Capture failed; inspect the workflow diagnostics")
    if delivery.is_symlink() or any(delivery.iterdir()):
        raise ValueError("Delivery directory was modified during capture")
    har = Path(result.get("har_path") or "")
    if not har.is_file() or not har.resolve().is_relative_to(work.resolve()):
        raise ValueError("Capture did not produce a HAR inside the work directory")
    report = export_har(har, delivery / "dataset", profile)
    # Keep generated code private in this first export stage: it has not passed
    # independent secret scanning. The underlying CLI still stores the client.
    write_json(delivery / "execution.json", {
        "schema_version": 1, "run_id": run_id, "profile": profile, "language": language,
        "commit": os.environ.get("GITHUB_SHA"), "records": report["records"],
        "client_delivery": "withheld_pending_independent_secret_review",
    })
    if not report["records"]:
        raise RuntimeError("No JSON records captured; review dataset/quality-report.json")


if __name__ == "__main__":
    main()
