"""Smoke-test the 19 routes with the disposable API; no enquiry submission."""
import json
import os
import sys
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

settings = json.load(sys.stdin)
origin = settings["origin"]
assert urlsplit(origin).hostname == "127.0.0.1"
with sync_playwright() as playwright:
    edge = os.environ.get("EDGE_BINARY", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
    browser = playwright.chromium.launch(executable_path=edge)
    page = browser.new_page()
    page.route("**/*", lambda route: route.continue_() if route.request.url.startswith(origin+"/") else route.abort())
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    for model in settings["models"]:
        page.goto(origin + "/product-details.html?model=" + model)
        links = page.get_by_role("link", name="Enquire About This Product")
        links.first.wait_for()
        assert page.locator("[data-gallery-main]").count() == 0
        assert model in page.locator(".detail-model").inner_text()
        links.first.click()
        page.wait_for_function("m => document.querySelector('#contact-model')?.value === m", arg=model)
    assert not errors, errors
    browser.close()
    print("PASS 19 product detail routes, placeholders and exact enquiry prefills")
