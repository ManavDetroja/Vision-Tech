"""Official CP PLUS product-image downloader and verifier.

Usage (from the project root):
  .\.venv-cpplus-images\Scripts\python.exe scripts\cpplus_image_downloader.py --download

This script only uses CP PLUS official pages and never guesses an image URL.  It
uses Playwright to discover image addresses from an exact, rendered product page.
It respects robots.txt and does not bypass anti-bot/access controls; a candidate
that is disallowed is recorded for manual review rather than fetched.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse

import requests
from PIL import Image, UnidentifiedImageError
from playwright.async_api import BrowserContext, Page, async_playwright

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "services" / "cpplus-product-image-config.json"
LIBRARY = ROOT / "assets" / "images" / "products"
MANIFEST = LIBRARY / "product-image-manifest.json"
REPORT = LIBRARY / "acquisition-report.md"
LOG = LIBRARY / "acquisition-log.jsonl"
TIMEOUT_MS = 30_000


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def relative(file: Path) -> str:
    return file.relative_to(ROOT).as_posix()


def model_folder(product: dict) -> Path:
    pieces = [LIBRARY, product["category"]]
    if product.get("subcategory"):
        pieces.append(product["subcategory"])
    pieces.append(product["model"])
    return Path(*pieces)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def append_log(event: dict) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"at": timestamp(), **event}, ensure_ascii=False) + "\n")


def parse_robots(text: str) -> list[str]:
    """Return wildcard Disallow rules; sufficient for the official site's policy."""
    rules, wildcard = [], False
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, value = [part.strip() for part in line.split(":", 1)]
        if key.lower() == "user-agent":
            wildcard = value == "*"
        elif wildcard and key.lower() == "disallow" and value:
            rules.append(value)
    return rules


def robots_allows(url: str, disallow_rules: list[str]) -> bool:
    path = urlparse(url).path
    return not any(path.startswith(rule) for rule in disallow_rules)


def is_official(url: str, hosts: set[str]) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.hostname and parsed.hostname.lower() in hosts


async def block_automatic_image_loads(route) -> None:
    """Inspect rendered DOM without retrieving robots-disallowed image bytes."""
    request = route.request
    parsed = urlparse(request.url)
    if request.resource_type == "image" or parsed.path.startswith("/prodassets/"):
        await route.abort()
    else:
        await route.continue_()


async def exact_product_page(page: Page, model: str, hosts: set[str]) -> str | None:
    search_url = f"https://cpplusworld.com/products/search/{quote(model, safe='')}"
    await page.goto(search_url, wait_until="domcontentloaded", timeout=TIMEOUT_MS)
    await page.wait_for_timeout(750)
    anchors = await page.locator("a[href]").evaluate_all(
        """items => items.map(a => ({href: a.href, text: (a.innerText || '').trim()}))"""
    )
    exact_path = f"/{model.lower()}"
    matcher = re.compile(rf"(^|[^A-Z0-9]){re.escape(model)}([^A-Z0-9]|$)", re.I)
    for item in anchors:
        if is_official(item["href"], hosts) and urlparse(item["href"]).path.lower() == exact_path:
            return item["href"]
    for item in anchors:
        if is_official(item["href"], hosts) and matcher.search(item["text"]):
            return item["href"]
    return None


async def rendered_image_candidates(page: Page, model: str, hosts: set[str]) -> list[dict]:
    """Gather img/lazy/srcset/CSS candidates, including gallery states after clicks."""
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    await page.wait_for_timeout(500)
    thumbnail_selectors = [
        "[class*='gallery'] img", "[class*='thumbnail']", "[class*='thumb']",
        "[data-slide]", "[data-index]"
    ]
    for selector in thumbnail_selectors:
        for thumb in await page.locator(selector).all()[:20]:
            try:
                await thumb.click(timeout=800)
                await page.wait_for_timeout(180)
            except Exception:
                pass
    raw = await page.evaluate(
        """() => {
          const attrs = ['src', 'srcset', 'data-src', 'data-original', 'data-lazy-src', 'data-zoom-image'];
          const result = [];
          for (const img of document.querySelectorAll('img')) {
            const values = Object.fromEntries(attrs.map(a => [a, img.getAttribute(a) || '']));
            result.push({tag: 'img', alt: img.alt || '', currentSrc: img.currentSrc || '', values});
          }
          for (const node of document.querySelectorAll('*')) {
            const bg = getComputedStyle(node).backgroundImage || '';
            if (bg.startsWith('url(')) result.push({tag: 'background', alt: '', currentSrc: bg.slice(4, -1).replace(/["']/g, ''), values: {}});
          }
          return result;
        }"""
    )
    discovered, seen = [], set()
    for item in raw:
        values = [item.get("currentSrc", ""), *item.get("values", {}).values()]
        for value in values:
            for candidate in re.split(r"\s*,\s*|\s+\d+(?:\.\d+)?[wx](?=\s|$)", value or ""):
                candidate = candidate.strip().split(" ", 1)[0]
                if not candidate:
                    continue
                absolute = urljoin(page.url, candidate)
                if not is_official(absolute, hosts) or absolute in seen:
                    continue
                # Product gallery/media assets only; excludes site logos and banners.
                if "/prodassets/product/" not in urlparse(absolute).path:
                    continue
                seen.add(absolute)
                discovered.append({"sourceUrl": absolute, "element": item["tag"], "alt": item.get("alt", ""), "modelAssociation": "exact rendered product page"})
    return discovered


def rembg_available() -> tuple[bool, str]:
    try:
        from rembg import remove  # noqa: F401
        return True, "rembg import succeeded"
    except Exception as exc:
        return False, f"rembg unavailable: {type(exc).__name__}: {exc}"


def valid_transparent_png(data: bytes) -> tuple[bool, dict]:
    try:
        with Image.open(BytesIO(data)) as image:
            image.load()
            if image.format != "PNG" or image.mode != "RGBA":
                return False, {"format": image.format, "mode": image.mode, "reason": "not RGBA PNG"}
            alpha = image.getchannel("A")
            minimum, maximum = alpha.getextrema()
            return minimum < 255 and maximum == 255, {"width": image.width, "height": image.height, "alphaRange": [minimum, maximum]}
    except (UnidentifiedImageError, OSError) as exc:
        return False, {"reason": f"decode error: {exc}"}


async def download_and_process(context: BrowserContext, source_url: str, target: Path, rembg_ok: bool) -> tuple[dict | None, str | None]:
    if not rembg_ok:
        return None, "background removal is unavailable"
    response = await context.request.get(source_url, timeout=TIMEOUT_MS)
    if not response.ok:
        return None, f"image HTTP {response.status}"
    content_type = (response.headers.get("content-type") or "").lower()
    raw = await response.body()
    if not content_type.startswith("image/"):
        return None, f"unexpected MIME type {content_type or 'missing'}"
    try:
        with Image.open(BytesIO(raw)) as source:
            source.load()
    except (UnidentifiedImageError, OSError) as exc:
        return None, f"invalid image payload: {exc}"
    try:
        from rembg import remove
        output = remove(raw)
    except Exception as exc:
        return None, f"background removal failed: {type(exc).__name__}: {exc}"
    valid, details = valid_transparent_png(output)
    if not valid:
        return None, f"rejected output: {details.get('reason', 'no transparent alpha')}"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(output)
    return {"path": relative(target), "width": details["width"], "height": details["height"], "sha256": sha256(output), "transparencyVerified": True}, None


async def process_product(page: Page, product: dict, hosts: set[str], rules: list[str], download: bool, rembg_ok: bool, global_hashes: dict[str, str]) -> dict:
    folder = model_folder(product)
    folder.mkdir(parents=True, exist_ok=True)
    result = {
        "model": product["model"], "category": product["category"], "subcategory": product.get("subcategory"), "detail": product.get("detail", ""),
        "folder": relative(folder), "productPageUrl": None, "sourceType": "official", "identityVerified": False,
        "candidates": [], "localPngPaths": [], "transparencyVerified": False, "status": "UNRESOLVED", "notes": [], "lastCheckedAt": timestamp(),
    }
    try:
        product_url = await exact_product_page(page, product["model"], hosts)
        if not product_url:
            result["status"] = "NO_OFFICIAL_PRODUCT_PAGE"
            result["notes"].append("The official CP PLUS search returned no exact product page.")
            return result
        await page.goto(product_url, wait_until="domcontentloaded", timeout=TIMEOUT_MS)
        await page.wait_for_timeout(850)
        result["productPageUrl"] = page.url
        body = await page.locator("body").inner_text()
        result["identityVerified"] = bool(re.search(rf"(^|[^A-Z0-9]){re.escape(product['model'])}([^A-Z0-9]|$)", body, re.I))
        if not result["identityVerified"]:
            result["status"] = "IDENTITY_NOT_VERIFIED"
            result["notes"].append("Exact model number was absent from rendered official page text.")
            return result
        result["candidates"] = await rendered_image_candidates(page, product["model"], hosts)
        for candidate in result["candidates"]:
            candidate["robotsAllowed"] = robots_allows(candidate["sourceUrl"], rules)
        if not result["candidates"]:
            result["status"] = "NO_OFFICIAL_IMAGE_CANDIDATES"
            return result
        allowed = [item for item in result["candidates"] if item["robotsAllowed"]]
        if not allowed:
            result["status"] = "MANUAL_REVIEW_REQUIRED"
            result["notes"].append("All official product-media URLs are robots-disallowed; bytes were not requested.")
            return result
        if not download:
            result["status"] = "READY_FOR_AUTHORIZED_DOWNLOAD"
            return result
        for index, candidate in enumerate(allowed):
            name = "main.png" if index == 0 else f"gallery-{index:02d}.png"
            destination = folder / name
            if destination.exists():
                data = destination.read_bytes()
                valid, details = valid_transparent_png(data)
                if valid:
                    record = {"path": relative(destination), "width": details["width"], "height": details["height"], "sha256": sha256(data), "transparencyVerified": True}
                    result["localPngPaths"].append(record)
                    global_hashes[record["sha256"]] = record["path"]
                    continue
            record, error = await download_and_process(page.context, candidate["sourceUrl"], destination, rembg_ok)
            if error:
                result["notes"].append(f"{candidate['sourceUrl']}: {error}")
                continue
            if record["sha256"] in global_hashes:
                destination.unlink(missing_ok=True)
                result["notes"].append(f"duplicate image rejected; matches {global_hashes[record['sha256']]}")
                continue
            global_hashes[record["sha256"]] = record["path"]
            result["localPngPaths"].append(record)
        result["transparencyVerified"] = bool(result["localPngPaths"])
        result["status"] = "COMPLETE" if result["localPngPaths"] else "MANUAL_REVIEW_REQUIRED"
    except Exception as exc:
        result["status"] = "LOOKUP_FAILED"
        result["notes"].append(f"{type(exc).__name__}: {exc}")
    return result


def write_outputs(products: list[dict], rules: list[str], rembg_status: str) -> None:
    totals = {
        "totalProducts": len(products), "officialProductPagesFound": sum(bool(p["productPageUrl"]) for p in products),
        "finalPngImages": sum(len(p["localPngPaths"]) for p in products),
        "transparentPngImages": sum(sum(i["transparencyVerified"] for i in p["localPngPaths"]) for p in products),
        "manualReviewModels": sum(p["status"] != "COMPLETE" for p in products),
    }
    manifest = {"schemaVersion": 2, "generatedAt": timestamp(), "automation": "Playwright Python", "robotsDisallowRules": rules, "backgroundRemoval": rembg_status, "totals": totals, "products": products}
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    rows = "\n".join(f"| {p['model']} | {p['status']} | {len(p['localPngPaths'])} | {p['productPageUrl'] or '—'} |" for p in products)
    failed = [p["model"] for p in products if p["status"] != "COMPLETE"]
    files = [entry["path"] for p in products for entry in p["localPngPaths"]]
    report = f"""# CP PLUS Image Acquisition Report

Generated: {manifest['generatedAt']}

- Models processed: {totals['totalProducts']}
- Official product pages found: {totals['officialProductPagesFound']}
- Actual image files downloaded: {totals['finalPngImages']}
- Transparent PNGs generated and verified: {totals['transparentPngImages']}
- Failed or blocked models: {len(failed)} ({', '.join(failed) or 'none'})
- Products requiring manual review: {totals['manualReviewModels']}
- Background-removal environment: {rembg_status}

## Results

| Model | Status | Final PNGs | Official product page |
| --- | --- | ---: | --- |
{rows}

## Downloaded files

{chr(10).join(f'- `{file}`' for file in files) or 'No final image files were saved.'}

## Failures and restrictions

Product-media URLs disallowed by the official `robots.txt` were not requested. The automation does not bypass robots directives, authentication, CAPTCHAs, or other access controls. Detailed per-model source URLs and reasons are in `product-image-manifest.json` and `acquisition-log.jsonl`.
"""
    REPORT.write_text(report, encoding="utf-8")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true", help="Attempt only robots-permitted official image downloads")
    parser.add_argument("--model", help="Process one exact model")
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    products = config["products"]
    if args.model:
        products = [p for p in products if p["model"].upper() == args.model.upper()]
        if not products:
            raise SystemExit(f"Unknown exact model: {args.model}")
    LIBRARY.mkdir(parents=True, exist_ok=True)
    hosts = {h.lower() for h in config["sourcePolicy"]["officialHosts"]}
    try:
        robots_response = requests.get("https://cpplusworld.com/robots.txt", timeout=TIMEOUT_MS / 1000, headers={"User-Agent": "VisionTech official product auditor/1.0"})
        robots_response.raise_for_status()
        rules = parse_robots(robots_response.text)
    except requests.RequestException as exc:
        rules = ["/"]
        append_log({"event": "robots_unavailable", "error": str(exc)})
    rembg_ok, rembg_status = rembg_available()
    all_hashes: dict[str, str] = {}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(user_agent="VisionTech official product-image auditor/1.0")
        await context.route("**/*", block_automatic_image_loads)
        page = await context.new_page()
        outcomes = []
        for product in products:
            print(f"Inspecting {product['model']}…", flush=True)
            outcome = await process_product(page, product, hosts, rules, args.download, rembg_ok, all_hashes)
            outcomes.append(outcome)
            append_log({"event": "model_checked", "model": product["model"], "status": outcome["status"], "candidateCount": len(outcome["candidates"])})
        await browser.close()
    # Preserve an all-model report if a one-model test was requested.
    if args.model and MANIFEST.exists():
        previous = json.loads(MANIFEST.read_text(encoding="utf-8")).get("products", [])
        by_model = {p["model"]: p for p in previous}
        by_model.update({p["model"]: p for p in outcomes})
        outcomes = [by_model.get(p["model"], {"model": p["model"], "status": "NOT_YET_CHECKED", "localPngPaths": [], "productPageUrl": None}) for p in config["products"]]
    write_outputs(outcomes, rules, rembg_status)
    print(json.dumps(json.loads(MANIFEST.read_text(encoding="utf-8"))["totals"]), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
