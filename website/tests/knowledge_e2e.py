"""Studio regression with mocked GitHub; never dispatches a real workflow.

Run against a served production export: python website/tests/knowledge_e2e.py URL
Optional --executable-path uses an existing Chrome installation.
"""

import argparse
import json
import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("url")
parser.add_argument("--executable-path")
parser.add_argument("--screenshots", type=Path)
parser.add_argument("--serve", type=Path, help="Serve an export locally in this process")
args = parser.parse_args()
if args.serve:
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 8766), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(args.serve)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    args.url = "http://127.0.0.1:8766"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=args.executable_path)
    page = browser.new_page(viewport={"width": 1280, "height": 1000})
    page.add_init_script("localStorage.setItem('rae_gh_token', 'legacy-token')")
    state = {"correlation": "", "failure": False}

    def github(route):
        path = route.request.url
        if route.request.method == "POST":
            body = route.request.post_data_json
            assert body["inputs"]["profile"] == "science"
            assert body["inputs"]["language"] == "typescript"
            assert "No inventar" in body["inputs"]["prompt"]
            state["correlation"] = body["inputs"]["run_id"]
            route.fulfill(status=204)
            return
        run = {"id": 42, "html_url": "https://github.com/test/repo/actions/runs/42", "status": "completed",
               "conclusion": "failure" if state["failure"] else "success", "display_title": f"knowledge-{state['correlation']}"}
        data = {"artifacts": [{"id": 7, "name": "knowledge-42", "expired": False}]} if path.endswith("/artifacts") else {"workflow_runs": [run]}
        route.fulfill(json=data, headers={"Access-Control-Allow-Origin": "*"})

    page.route("https://api.github.com/**", github)
    page.goto(args.url.rstrip("/") + "/studio/")
    expect(page.get_by_role("heading", name="Conocimiento que conecta tus proyectos")).to_be_visible()
    assert page.evaluate("localStorage.getItem('rae_gh_token')") is None
    page.get_by_role("button", name="Ciencias y datos").click()
    page.get_by_label("URL de la fuente").fill("https://school.example/api")
    page.get_by_label("Lenguaje del cliente reutilizable").select_option("typescript")
    page.get_by_label("Token temporal de GitHub").fill("test-token")
    page.get_by_role("button", name="Extraer y exportar").click()
    expect(page.get_by_role("link", name="Descargar knowledge-42")).to_be_visible(timeout=15000)
    assert page.evaluate("localStorage.getItem('rae_gh_token')") is None
    page.get_by_role("button", name="Borrar token").click()
    expect(page.get_by_label("Token temporal de GitHub")).to_have_value("")
    state["failure"] = True
    page.get_by_label("Token temporal de GitHub").fill("test-token")
    page.get_by_role("button", name="Extraer y exportar").click()
    expect(page.get_by_role("region", name="Resultados").get_by_role("status")).to_contain_text("failure", timeout=15000)
    expect(page.get_by_role("link", name="Descargar knowledge-42")).to_have_count(0)
    page.get_by_text("Consultar APIs abiertas sin agente", exact=True).click()
    page.route("https://school.example/public.json", lambda route: route.fulfill(json={"latex": "x^2", "answer": None}))
    page.get_by_label("Endpoint JSON").fill("https://school.example/public.json")
    page.get_by_role("button", name="Consultar JSON", exact=True).click()
    expect(page.get_by_role("button", name="Descargar JSON original")).to_be_visible()
    with page.expect_download() as download:
        page.get_by_role("button", name="Descargar JSON original").click()
    assert json.loads(Path(download.value.path()).read_text()) == {"latex": "x^2", "answer": None}
    page.route("https://school.example/failing.json", lambda route: route.fulfill(status=503))
    page.get_by_label("Endpoint JSON").fill("https://school.example/failing.json")
    page.get_by_role("button", name="Consultar JSON", exact=True).click()
    expect(page.get_by_text("La fuente respondió HTTP 503.", exact=False)).to_be_visible()
    expect(page.get_by_role("button", name="Descargar JSON original")).to_have_count(0)
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(args.screenshots / "studio-desktop.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Mobile horizontal overflow"
    if args.screenshots:
        page.screenshot(path=str(args.screenshots / "studio-mobile.png"), full_page=True)
    browser.close()
print(json.dumps({"studio": "passed", "checks": ["dispatch", "profile", "language", "artifact", "failure", "token", "mobile"]}))
