"""Runner contract tested without contacting a model or target website."""

import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from reverse_api import knowledge_runner


def configure(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    for key, value in {"INPUT_RUN_ID": "run-1", "INPUT_URL": "https://school.example/api", "INPUT_PROMPT": "Collect algebra",
                       "INPUT_LANGUAGE": "typescript", "INPUT_PROFILE": "mathematics"}.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setattr(knowledge_runner, "get_config_path", lambda: tmp_path / "config.json")


def test_runner_exports_real_capture_and_applies_language(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)

    def fake_capture(command, stdout, **kwargs):
        assert "--headless" in command
        assert "--output-dir" in command
        work = tmp_path / ".capture-work/run-1"
        har = work / "recording.har"
        har.write_text(json.dumps({"log": {"entries": [{
            "request": {"url": "https://school.example/api"},
            "response": {"status": 200, "content": {"mimeType": "application/json", "text": '[{"question":"x+1=2"}]'}},
        }]}}))
        json.dump({"status": "ok", "har_path": str(har)}, stdout)
        return SimpleNamespace(returncode=0)

    with patch.object(knowledge_runner.subprocess, "run", side_effect=fake_capture):
        knowledge_runner.main()
    config = json.loads((tmp_path / "config.json").read_text())
    assert config["output_language"] == "typescript"
    assert config["real_time_sync"] is False
    delivery = tmp_path / "generated/run-1"
    assert json.loads((delivery / "dataset/normalized/items.json").read_text())[0]["observed"]["question"] == "x+1=2"
    assert json.loads((delivery / "execution.json").read_text())["records"] == 1
    assert not list(delivery.rglob("*.har"))


def test_runner_rejects_path_traversal_before_execution(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)
    monkeypatch.setenv("INPUT_RUN_ID", "../outside")
    with patch.object(knowledge_runner.subprocess, "run") as execute:
        with pytest.raises(ValueError, match="identifier"):
            knowledge_runner.main()
        execute.assert_not_called()


def test_runner_does_not_hide_agent_failure(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)

    def failed_capture(command, stdout, **kwargs):
        json.dump({"status": "error", "error": "network"}, stdout)
        return SimpleNamespace(returncode=1)

    with patch.object(knowledge_runner.subprocess, "run", side_effect=failed_capture):
        with pytest.raises(RuntimeError, match="Capture failed"):
            knowledge_runner.main()
    assert not (tmp_path / "generated/run-1/execution.json").exists()


def test_runner_rejects_agent_written_delivery_files(monkeypatch, tmp_path):
    configure(monkeypatch, tmp_path)

    def tampered_capture(command, stdout, **kwargs):
        (tmp_path / "generated/run-1/unreviewed.txt").write_text("untrusted")
        json.dump({"status": "ok"}, stdout)
        return SimpleNamespace(returncode=0)

    with patch.object(knowledge_runner.subprocess, "run", side_effect=tampered_capture):
        with pytest.raises(ValueError, match="modified during capture"):
            knowledge_runner.main()
