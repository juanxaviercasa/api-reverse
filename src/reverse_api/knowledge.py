"""Export observed JSON without inferring educational answers or classifications.

This module uses only the standard library so local captures can be processed
without an agent, browser, or model subscription.
"""

import argparse
import base64
import hashlib
import ipaddress
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

PROFILES = ("mathematics", "science", "development", "design", "marketing", "general")
SECRET_KEY = re.compile(r"authorization|cookie|token|secret|password|api[-_]?key|session[-_]?id", re.I)
SECRET_VALUE = re.compile(r"Bearer\s+\S+|\b(?:gh[pousr]_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{16,})", re.I)
MAX_BYTES = 20 * 1024 * 1024


def validate_source_url(value: str) -> str:
    """Validate a remote source; this is input hygiene, not an egress firewall."""
    parts = urlsplit(value)
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.username or parts.password:
        raise ValueError("Source must be an HTTP(S) URL without credentials")
    if parts.hostname.lower() in {"localhost", "metadata.google.internal"} or parts.hostname.endswith(".local"):
        raise ValueError("Source must be a public host")
    try:
        address = ipaddress.ip_address(parts.hostname)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        raise ValueError("Source must not use a private or reserved address")
    return value


def clean_url(value: str) -> str:
    """Never publish credentials, query parameters or fragments in provenance."""
    parts = urlsplit(value)
    return urlunsplit((parts.scheme, parts.netloc.rsplit("@", 1)[-1], parts.path, "", ""))


def sanitize(value: Any) -> Any:
    """Best-effort redaction of common secret fields and token strings.

    Does not claim to remove all personal information; review before sharing.
    """
    if isinstance(value, dict):
        if isinstance(value.get("name"), str) and SECRET_KEY.search(value["name"]) and "value" in value:
            value = {**value, "value": "[REDACTED]"}
        return {key: "[REDACTED]" if SECRET_KEY.search(key) else sanitize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    if isinstance(value, str):
        value = SECRET_VALUE.sub("[REDACTED]", value)
        if value.startswith(("https://", "http://")):
            return clean_url(value)
    return value


def load_json(path: Path) -> Any:
    if path.stat().st_size > MAX_BYTES:
        raise ValueError(f"Input exceeds {MAX_BYTES} bytes")
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def export_dataset(payloads: list[tuple[str, Any]], output: Path, profile: str = "general", skipped: int = 0) -> dict[str, Any]:
    """Preserve payloads and wrap records with provenance, hash and source pointer.

    Only top-level arrays are split. Nested containers remain intact to avoid
    pretending to know the semantic structure of an unknown API.
    """
    if profile not in PROFILES:
        raise ValueError("Unknown profile")
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output directory must be empty; choose a new dataset version")
    output.mkdir(parents=True, exist_ok=True)
    captured_at = datetime.now(UTC).isoformat()
    records: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    duplicates = 0
    for index, (source, payload) in enumerate(payloads):
        source = clean_url(source)
        cleaned = sanitize(payload)
        relative = f"raw/response-{index:04d}.json"
        write_json(output / relative, cleaned)
        values = enumerate(cleaned) if isinstance(cleaned, list) else [(None, cleaned)]
        for position, value in values:
            digest = hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()
            identity = (source, digest)
            if identity in seen:
                duplicates += 1
                continue
            seen.add(identity)
            records.append({
                "id": hashlib.sha256(f"{source}:{digest}".encode()).hexdigest(),
                "source_url": source, "captured_at": captured_at, "content_hash": digest,
                "raw_file": relative, "json_pointer": "" if position is None else f"/{position}",
                "profile": profile, "license": None, "observed": value, "inferred": {},
            })
    write_json(output / "normalized/items.json", records)
    report = {
        "records": len(records), "responses": len(payloads), "duplicates_removed": duplicates,
        "skipped_entries": skipped, "semantic_mapping": "not_performed", "coverage": "not_verified",
        "warnings": ["Review source rights, personal data and redaction before sharing.",
                     "Only observed JSON is exported; HTML, PDFs and linked images are not downloaded.",
                     "No guarantee of complete pagination or relevance; review captured responses."],
    }
    write_json(output / "quality-report.json", report)
    write_json(output / "manifest.json", {
        "schema_version": 1, "profile": profile, "created_at": captured_at,
        "sources": sorted({clean_url(source) for source, _ in payloads}),
        "files": ["normalized/items.json", "quality-report.json", *[f"raw/response-{i:04d}.json" for i in range(len(payloads))]],
        "redaction": "best_effort_common_secrets", "record_count": len(records),
    })
    return report


def export_har(path: Path, output: Path, profile: str = "general") -> dict[str, Any]:
    har = load_json(path)
    if not isinstance(har, dict) or not isinstance(har.get("log"), dict) or not isinstance(har["log"].get("entries"), list):
        raise ValueError("HAR must contain log.entries as an array")
    payloads = []
    skipped = 0
    for entry in har["log"]["entries"]:
        if not isinstance(entry, dict) or not isinstance(entry.get("response"), dict) or not isinstance(entry.get("request"), dict):
            skipped += 1
            continue
        response = entry.get("response", {})
        content = response.get("content", {})
        if not isinstance(content, dict) or not isinstance(response.get("status"), int):
            skipped += 1
            continue
        text = content.get("text", "")
        mime = content.get("mimeType", "")
        if not 200 <= response["status"] < 300 or not isinstance(mime, str) or "json" not in mime.lower() or not isinstance(text, str) or not text:
            skipped += 1
            continue
        try:
            if content.get("encoding") == "base64":
                text = base64.b64decode(text, validate=True).decode("utf-8-sig")
            data = json.loads(text)
            url = entry["request"]["url"]
            if not isinstance(url, str):
                raise ValueError("Invalid response source URL")
            source = validate_source_url(url)
        except (ValueError, KeyError, UnicodeError):
            skipped += 1
            continue
        payloads.append((source, data))
    return export_dataset(payloads, output, profile, skipped)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("normalize", "har"))
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--source-url")
    parser.add_argument("--profile", choices=PROFILES, default="general")
    args = parser.parse_args()
    try:
        if args.mode == "har":
            report = export_har(args.input, args.output, args.profile)
        else:
            if not args.source_url:
                parser.error("normalize requires --source-url")
            source = validate_source_url(args.source_url)
            report = export_dataset([(source, load_json(args.input))], args.output, args.profile)
    except (ValueError, OSError) as error:
        parser.exit(1, f"Export failed: {error}\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
