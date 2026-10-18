"""Regression coverage for faithful exports, privacy and malformed captures."""

import base64
import json

import pytest

from reverse_api.knowledge import export_dataset, export_har, sanitize, validate_source_url


def test_preserves_math_and_missing_answers_without_inference(tmp_path):
    output = tmp_path / "dataset"
    report = export_dataset([("https://school.example/problems?token=secret", [
        {"latex": r"\frac{x}{2}", "answer": None, "image": "https://school.example/figure.svg"},
    ])], output, "mathematics")
    record = json.loads((output / "normalized/items.json").read_text())[0]
    assert record["observed"]["latex"] == r"\frac{x}{2}"
    assert record["observed"]["answer"] is None
    assert record["inferred"] == {}
    assert record["source_url"] == "https://school.example/problems"
    assert record["json_pointer"] == "/0"
    assert report["semantic_mapping"] == "not_performed"


def test_redaction_and_deduplication(tmp_path):
    payload = {"id": 1, "access_token": "sensitive", "nested": {"password": "secret"}}
    report = export_dataset([("https://school.example/api", [payload, payload])], tmp_path / "dataset")
    content = (tmp_path / "dataset/raw/response-0000.json").read_text()
    assert "sensitive" not in content
    assert '"secret"' not in content
    assert report["records"] == 1
    assert report["duplicates_removed"] == 1
    assert sanitize("Bearer private-token") == "[REDACTED]"
    assert sanitize({"name": "Cookie", "value": "auth=private"})["value"] == "[REDACTED]"


def test_nested_api_containers_remain_intact(tmp_path):
    payload = {"items": [{"id": 1}], "next_page": 2}
    export_dataset([("https://school.example/api", payload)], tmp_path / "dataset")
    records = json.loads((tmp_path / "dataset/normalized/items.json").read_text())
    assert len(records) == 1
    assert records[0]["observed"] == payload
    assert records[0]["json_pointer"] == ""


def test_export_har_filters_and_decodes(tmp_path):
    def entry(status, mime, text, encoding=None):
        return {"request": {"url": "https://school.example/api?key=secret"}, "response": {
            "status": status, "content": {"mimeType": mime, "text": text, "encoding": encoding},
        }}
    path = tmp_path / "capture.har"
    path.write_text(json.dumps({"log": {"entries": [
        entry(200, "application/json", base64.b64encode(b'[{"id": 7}]').decode(), "base64"),
        entry(403, "application/json", '{"error":"denied"}'),
        entry(200, "text/html", "<html>"),
        entry(200, "application/json", "not json"),
    ]}}))
    report = export_har(path, tmp_path / "dataset")
    assert report["records"] == 1
    assert report["skipped_entries"] == 3
    assert not list((tmp_path / "dataset").rglob("*.har"))


@pytest.mark.parametrize("url", ["file:///private", "https://user:secret@example.org", "http://localhost", "http://127.0.0.1", "http://169.254.169.254"])
def test_rejects_invalid_remote_sources(url):
    with pytest.raises(ValueError):
        validate_source_url(url)


def test_existing_dataset_cannot_be_overwritten(tmp_path):
    export_dataset([("https://school.example/api", [])], tmp_path / "dataset")
    with pytest.raises(ValueError, match="empty"):
        export_dataset([("https://school.example/api", [1])], tmp_path / "dataset")


@pytest.mark.parametrize("value", [[], {}, {"log": {"entries": None}}])
def test_invalid_har_structure_is_reported(tmp_path, value):
    path = tmp_path / "invalid.har"
    path.write_text(json.dumps(value))
    with pytest.raises(ValueError, match="log.entries"):
        export_har(path, tmp_path / "dataset")
