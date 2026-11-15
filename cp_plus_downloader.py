"""Respectful CP PLUS product-gallery downloader for Windows.

Only the gallery of an exact, verified official product page is considered.
It deliberately treats robots.txt and access failures as a stop condition.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import mimetypes
import os
import queue
import re
import shutil
import threading
import time
import webbrowser
from dataclasses import dataclass, field
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from PIL import Image, ImageTk, UnidentifiedImageError
from playwright.async_api import Page, async_playwright
import tkinter as tk
from tkinter import messagebox, ttk

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "config" / "models.json"
LOG_DIR = ROOT / "logs"
REPORT_DIR = ROOT / "reports"
STATE_PATH = LOG_DIR / "downloader-progress.json"
LOG_PATH = LOG_DIR / "downloader.log"
USER_AGENT = "VisionTech-CPPlusGalleryDownloader/1.0 (+local desktop application)"
TIMEOUT = 30
IMAGE_MIME_EXTS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif"}
GALLERY_SELECTORS = (
    "[data-gallery] img, [data-fancybox] img, [data-lightbox] img, "
    ".product-gallery img, .product_gallery img, .product-images img, "
    ".product-image img, .gallery img, .gallery-item img, .slick-slide img, "
    ".swiper-slide img, .zoom img"
)


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp.replace(path)


def token_present(text: str, model: str) -> bool:
    return bool(re.search(rf"(?<![A-Z0-9]){re.escape(model)}(?![A-Z0-9])", text, re.I))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def official_url(url: str, site_host: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.hostname in {site_host, f"www.{site_host}"}


def filename_extension(url: str, content_type: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}:
        return suffix
    return IMAGE_MIME_EXTS.get(content_type.split(";", 1)[0].lower(), mimetypes.guess_extension(content_type) or ".img")


@dataclass
class Product:
    model: str
    category: str
    subcategory: str | None = None


@dataclass
class RunControl:
    paused: threading.Event = field(default_factory=threading.Event)
    stopped: threading.Event = field(default_factory=threading.Event)

    def wait_if_paused(self) -> bool:
        while self.paused.is_set() and not self.stopped.is_set():
            time.sleep(.15)
        return not self.stopped.is_set()


class Downloader:
    def __init__(self, emit: Callable[[str, dict[str, Any]], None] | None = None) -> None:
        self.config = read_json(CONFIG, {})
        self.site = self.config.get("site", "https://cpplusworld.com").rstrip("/")
        self.site_host = urlparse(self.site).hostname or "cpplusworld.com"
        self.output_root = ROOT / self.config.get("outputRoot", "assets/images/products")
        self.products = [Product(**item) for item in self.config.get("products", [])]
        self.emit = emit or (lambda event, data: None)
        self.state = read_json(STATE_PATH, {"schemaVersion": 1, "models": {}, "manualSelections": {}})
        self.state.setdefault("models", {})
        self.state.setdefault("manualSelections", {})
        self.robots = RobotFileParser()
        self.robots_url = f"{self.site}/robots.txt"
        self.robots_loaded = False
        self.logger = self._logger()

    def _logger(self) -> logging.Logger:
        LOG_DIR.mkdir(exist_ok=True)
        logger = logging.getLogger("cpplus_downloader")
        if not logger.handlers:
            handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
            handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
            logger.setLevel(logging.INFO)
            logger.addHandler(handler)
        return logger

    def folder_for(self, product: Product) -> Path:
        parts = [self.output_root, product.category]
        if product.subcategory:
            parts.append(product.subcategory)
        parts.append(product.model)
        return Path(*parts)

    def save_state(self) -> None:
        self.state["updatedAt"] = utcnow()
        atomic_json(STATE_PATH, self.state)

    async def load_robots(self) -> bool:
        try:
            async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=TIMEOUT) as client:
                response = await client.get(self.robots_url)
                response.raise_for_status()
            self.robots.set_url(self.robots_url)
            self.robots.parse(response.text.splitlines())
            self.robots_loaded = True
            self.emit("log", {"message": f"Loaded robots policy from {self.robots_url}"})
            return True
        except httpx.HTTPError as exc:
            self.emit("log", {"message": f"Cannot retrieve robots.txt; refusing automated downloads: {exc}"})
            self.logger.warning("robots unavailable: %s", exc)
            return False

    def allowed(self, url: str) -> bool:
        return self.robots_loaded and self.robots.can_fetch(USER_AGENT, url)

    async def _block_disallowed_requests(self, route) -> None:
        # Rendering a product page is permitted; gallery/media bytes are blocked when robots denies them.
        request = route.request
        if request.resource_type == "image" and not self.allowed(request.url):
            await route.abort()
        else:
            await route.continue_()

    async def find_exact_page(self, page: Page, model: str) -> str | None:
        direct = f"{self.site}/{model.lower()}"
        try:
            await page.goto(direct, wait_until="domcontentloaded", timeout=TIMEOUT * 1000)
            if official_url(page.url, self.site_host):
                body = await page.locator("body").inner_text(timeout=5000)
                if token_present(body, model):
                    return page.url
        except Exception:
            pass
        search_url = f"{self.site}/products/search/{quote(model, safe='')}"
        try:
            await page.goto(search_url, wait_until="domcontentloaded", timeout=TIMEOUT * 1000)
            links = await page.locator("a[href]").evaluate_all("els => els.map(e => ({href:e.href,text:e.innerText || ''}))")
        except Exception as exc:
            self.logger.warning("search failed for %s: %s", model, exc)
            return None
        exact_path = "/" + model.lower()
        for item in links:
            if official_url(item["href"], self.site_host) and urlparse(item["href"]).path.lower() == exact_path:
                return item["href"]
        for item in links:
            if official_url(item["href"], self.site_host) and token_present(item["text"], model):
                return item["href"]
        return None

    async def discover_gallery(self, page: Page) -> list[dict[str, str]]:
        """Return declared sources in gallery-specific DOM elements only, in visible gallery order."""
        await page.wait_for_timeout(500)
        try:
            for node in (await page.locator("[data-gallery], .product-gallery, .product_gallery, .gallery, .slick-slide, .swiper-slide").all())[:30]:
                try:
                    await node.scroll_into_view_if_needed(timeout=500)
                except Exception:
                    pass
        except Exception:
            pass
        raw = await page.locator(GALLERY_SELECTORS).evaluate_all("""nodes => nodes.map((img, index) => {
          const owner = img.closest('[data-gallery],[data-fancybox],[data-lightbox],.product-gallery,.product_gallery,.product-images,.product-image,.gallery,.gallery-item,.slick-slide,.swiper-slide,.zoom');
          const a = img.closest('a');
          const pick = (...values) => values.find(v => v && !v.startsWith('data:')) || '';
          return { index, src: pick(img.getAttribute('data-zoom-image'), img.getAttribute('data-original'), img.getAttribute('data-lazy-src'), img.getAttribute('data-src'), img.currentSrc, img.getAttribute('src')), href: a ? a.href : '', owner: owner ? (owner.className || owner.getAttribute('data-gallery') || owner.tagName) : '', alt: img.alt || '' };
        })""")
        candidates, seen = [], set()
        for item in raw:
            choices = [item.get("href", ""), item.get("src", "")]
            for choice in choices:
                absolute = urljoin(page.url, choice)
                path = urlparse(absolute).path.lower()
                if not choice or not official_url(absolute, self.site_host) or absolute in seen:
                    continue
                # Product media path, in a positive gallery DOM context.  This excludes mastheads/recommendations.
                if "/prodassets/product/" not in path and "/product/" not in path:
                    continue
                seen.add(absolute)
                candidates.append({"url": absolute, "alt": item.get("alt", ""), "galleryElement": str(item.get("owner", "")), "order": str(item.get("index", ""))})
        return candidates

    async def inspect(self, page: Page, product: Product) -> dict[str, Any]:
        record: dict[str, Any] = {
            "model": product.model, "folder": str(self.folder_for(product).relative_to(ROOT)).replace("\\", "/"),
            "productPageUrl": None, "verified": False, "status": "UNRESOLVED", "galleryImages": [],
            "downloads": [], "failures": [], "duplicates": [], "manualSelectionRequired": False, "checkedAt": utcnow(),
        }
        url = await self.find_exact_page(page, product.model)
        if not url:
            record.update(status="OFFICIAL_PAGE_NOT_FOUND", manualSelectionRequired=True)
            record["failures"].append("No exact official product page was found.")
            return record
        record["productPageUrl"] = url
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=TIMEOUT * 1000)
            body = await page.locator("body").inner_text(timeout=7000)
        except Exception as exc:
            record.update(status="PRODUCT_PAGE_UNAVAILABLE", manualSelectionRequired=True)
            record["failures"].append(f"Product page could not be inspected: {type(exc).__name__}: {exc}")
            return record
        if not token_present(body, product.model):
            record.update(status="MODEL_NOT_VERIFIED", manualSelectionRequired=True)
            record["failures"].append("The exact model code was not present in rendered official page text.")
            return record
        record["verified"] = True
        found = await self.discover_gallery(page)
        record["galleryImages"] = [{**item, "robotsAllowed": self.allowed(item["url"])} for item in found]
        if not found:
            record.update(status="NO_GALLERY_IMAGES_FOUND", manualSelectionRequired=True)
        elif not any(item["robotsAllowed"] for item in record["galleryImages"]):
            record.update(status="ROBOTS_BLOCKED_MANUAL_REVIEW", manualSelectionRequired=True)
            record["failures"].append("Gallery sources are disallowed by the official robots policy; image bytes were not requested.")
        else:
            record["status"] = "DISCOVERED"
        return record

    def existing_hashes(self) -> dict[str, str]:
        result: dict[str, str] = {}
        for path in self.output_root.rglob("*") if self.output_root.exists() else []:
            if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"}:
                try:
                    result[sha256_file(path)] = str(path.relative_to(ROOT)).replace("\\", "/")
                except OSError:
                    continue
        return result

    async def download_gallery(self, product: Product, record: dict[str, Any], hashes: dict[str, str], control: RunControl, selected_only: bool = True) -> None:
        if not record["verified"]:
            return
        chosen = set(self.state["manualSelections"].get(product.model, []))
        images = record["galleryImages"]
        if selected_only and chosen:
            images = [item for item in images if item["url"] in chosen]
        folder = self.folder_for(product)
        folder.mkdir(parents=True, exist_ok=True)
        # Correct a pre-release numbering gap only for files this tool itself recorded.
        # Unknown files in the folder are intentionally left untouched.
        for index, entry in enumerate(record["downloads"], 1):
            old = ROOT / entry["path"]
            desired = folder / f"{product.model}_{index:02d}{old.suffix}"
            if old != desired and old.exists() and not desired.exists():
                old_relative = entry["path"]
                old.replace(desired)
                entry["path"] = str(desired.relative_to(ROOT)).replace("\\", "/")
                for digest, saved_path in list(hashes.items()):
                    if saved_path == old_relative:
                        hashes[digest] = entry["path"]
        used_numbers = [int(match.group(1)) for path in folder.glob(f"{product.model}_*.*") if (match := re.fullmatch(rf"{re.escape(product.model)}_(\d+)\.[^.]+", path.name))]
        next_number = max(used_numbers, default=0) + 1
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT, "Referer": record["productPageUrl"]}, follow_redirects=True, timeout=TIMEOUT) as client:
            for image in images:
                if not control.wait_if_paused():
                    record["status"] = "STOPPED"
                    return
                if any(entry.get("sourceUrl") == image["url"] for entry in record["downloads"]):
                    # It was already downloaded and validated in a prior run.
                    continue
                if not image["robotsAllowed"]:
                    record["failures"].append(f"Not fetched (robots disallowed): {image['url']}")
                    continue
                try:
                    response = await client.get(image["url"])
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "")
                    if not content_type.lower().startswith("image/"):
                        raise ValueError(f"unexpected MIME type {content_type or 'missing'}")
                    data = response.content
                    if not data:
                        raise ValueError("zero-byte response")
                    with Image.open(BytesIO(data)) as decoded:
                        decoded.verify()
                    with Image.open(BytesIO(data)) as decoded:
                        width, height, image_format = decoded.width, decoded.height, decoded.format
                    digest = hashlib.sha256(data).hexdigest()
                    if digest in hashes:
                        duplicate = {"url": image["url"], "sha256": digest, "matches": hashes[digest]}
                        if not any(item.get("url") == image["url"] and item.get("sha256") == digest for item in record["duplicates"]):
                            record["duplicates"].append(duplicate)
                        continue
                    ext = filename_extension(image["url"], content_type)
                    target = folder / f"{product.model}_{next_number:02d}{ext}"
                    while target.exists():
                        # Existing files are never overwritten, even if an earlier run did not create the manifest.
                        next_number += 1
                        target = folder / f"{product.model}_{next_number:02d}{ext}"
                    target.write_bytes(data)
                    relative = str(target.relative_to(ROOT)).replace("\\", "/")
                    hashes[digest] = relative
                    record["downloads"].append({"sourceUrl": image["url"], "path": relative, "sha256": digest, "bytes": len(data), "width": width, "height": height, "format": image_format, "extension": ext, "validated": True})
                    next_number += 1
                    self.emit("preview", {"path": str(target)})
                    self.emit("log", {"message": f"Saved {relative}"})
                except (httpx.HTTPError, ValueError, UnidentifiedImageError, OSError) as exc:
                    record["failures"].append(f"{image['url']}: {type(exc).__name__}: {exc}")
                    self.logger.warning("download error %s: %s", image["url"], exc)
                # Deliberately conservative pacing; no parallel media requests.
                await asyncio.sleep(0.5)
        if record["downloads"] and not record["failures"]:
            record["status"] = "COMPLETE"
        elif record["downloads"]:
            record["status"] = "COMPLETE_WITH_WARNINGS"
        elif record["duplicates"] and not record["failures"]:
            record["status"] = "COMPLETE_DUPLICATES_ONLY"
        else:
            record["status"] = "DOWNLOAD_FAILED"

    def write_reports(self) -> None:
        records = [self.state["models"].get(product.model, {"model": product.model, "status": "NOT_YET_RUN", "galleryImages": [], "downloads": [], "failures": [], "duplicates": []}) for product in self.products]
        complete_statuses = {"COMPLETE", "COMPLETE_WITH_WARNINGS", "COMPLETE_DUPLICATES_ONLY"}
        manifest = {"schemaVersion": 1, "generatedAt": utcnow(), "source": self.site, "policy": "Exact official gallery only; robots policy enforced; no overwrite.", "totals": {"models": len(records), "verified": sum(bool(item.get("verified")) for item in records), "galleryImagesDiscovered": sum(len(item.get("galleryImages", [])) for item in records), "imagesDownloaded": sum(len(item.get("downloads", [])) for item in records), "failedModels": sum(item.get("status") not in complete_statuses for item in records)}, "products": records}
        rows = []
        for item in records:
            notes = "; ".join(item.get("failures", [])) or "—"
            rows.append(f"| {item['model']} | {item.get('status','NOT_YET_RUN')} | {'yes' if item.get('verified') else 'no'} | {len(item.get('galleryImages', []))} | {len(item.get('downloads', []))} | {item.get('productPageUrl') or '—'} | {notes.replace('|', '\\|')} |")
        report = "# CP PLUS official gallery acquisition report\n\n" + f"Generated: {manifest['generatedAt']}\n\n" + "| Model | Status | Verified | Gallery images discovered | Downloaded | Official product page | Failures / manual review |\n| --- | --- | --- | ---: | ---: | --- | --- |\n" + "\n".join(rows) + "\n\n## Integrity checks\n\nEvery reported download was opened with Pillow, checked for non-zero size, recorded with dimensions, format, and SHA-256. Exact SHA-256 duplicates are listed under each product in the manifest and are not saved again. Discovered sources are not equivalent to downloads.\n"
        destinations = [(self.output_root / "product-image-manifest.json", self.output_root / "acquisition-report.md"), (REPORT_DIR / "product-image-manifest.json", REPORT_DIR / "acquisition-report.md")]
        for manifest_path, report_path in destinations:
            atomic_json(manifest_path, manifest)
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(report, encoding="utf-8")

    async def run(self, chosen_models: set[str] | None, download: bool, control: RunControl) -> None:
        self.logger.info("run started: download=%s models=%s", download, sorted(chosen_models) if chosen_models else "all")
        if not await self.load_robots():
            self.write_reports()
            return
        products = [p for p in self.products if chosen_models is None or p.model.upper() in chosen_models]
        hashes = self.existing_hashes()
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=USER_AGENT)
            await context.route("**/*", self._block_disallowed_requests)
            page = await context.new_page()
            for number, product in enumerate(products, 1):
                if not control.wait_if_paused():
                    break
                self.emit("progress", {"current": product.model, "index": number, "total": len(products)})
                self.emit("log", {"message": f"Inspecting {product.model} ({number}/{len(products)})"})
                self.logger.info("inspecting %s (%d/%d)", product.model, number, len(products))
                record = await self.inspect(page, product)
                # Keep already validated files in the manifest across resume/retry runs.
                # Discovery data is refreshed from the live official page each time.
                previous = self.state["models"].get(product.model, {})
                record["downloads"] = [item for item in previous.get("downloads", []) if (ROOT / item.get("path", "")).is_file()]
                downloaded_sources = {item.get("sourceUrl") for item in record["downloads"]}
                record["duplicates"] = [item for item in previous.get("duplicates", []) if item.get("url") not in downloaded_sources]
                if download and record["status"] == "DISCOVERED":
                    await self.download_gallery(product, record, hashes, control)
                self.state["models"][product.model] = record
                self.save_state()
                self.write_reports()
                self.emit("model", record)
                self.logger.info("completed %s with status=%s downloads=%d", product.model, record["status"], len(record["downloads"]))
            await browser.close()
        self.write_reports()
        self.emit("finished", {})


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("CP PLUS Official Product Gallery Downloader")
        self.geometry("1180x760")
        self.events: queue.Queue[tuple[str, dict[str, Any]]] = queue.Queue()
        self.downloader = Downloader(self.events.put)
        self.control = RunControl()
        self.worker: threading.Thread | None = None
        self.preview_image: ImageTk.PhotoImage | None = None
        self._build()
        self.refresh_models()
        self.after(100, self.consume_events)

    def _build(self) -> None:
        toolbar = ttk.Frame(self, padding=10); toolbar.pack(fill="x")
        self.start = ttk.Button(toolbar, text="Start Download", command=lambda: self.launch(True)); self.start.pack(side="left", padx=3)
        ttk.Button(toolbar, text="Discover only", command=lambda: self.launch(False)).pack(side="left", padx=3)
        ttk.Button(toolbar, text="Pause", command=lambda: self.control.paused.set()).pack(side="left", padx=3)
        ttk.Button(toolbar, text="Resume", command=lambda: self.control.paused.clear()).pack(side="left", padx=3)
        ttk.Button(toolbar, text="Stop", command=lambda: self.control.stopped.set()).pack(side="left", padx=3)
        ttk.Button(toolbar, text="Retry failed models", command=self.retry_failed).pack(side="left", padx=3)
        ttk.Button(toolbar, text="Review gallery", command=self.review_selected).pack(side="left", padx=3)
        ttk.Button(toolbar, text="Open output folder", command=lambda: os.startfile(self.downloader.output_root)).pack(side="right", padx=3)
        self.current = tk.StringVar(value="Ready")
        ttk.Label(self, textvariable=self.current, padding=(10, 0)).pack(anchor="w")
        self.bar = ttk.Progressbar(self, mode="determinate"); self.bar.pack(fill="x", padx=10, pady=4)
        stats = ttk.Frame(self, padding=(10, 0)); stats.pack(fill="x")
        self.counts = tk.StringVar(value="Downloaded images: 0   Failed models: 0")
        ttk.Label(stats, textvariable=self.counts).pack(anchor="w")
        body = ttk.PanedWindow(self, orient="horizontal"); body.pack(fill="both", expand=True, padx=10, pady=8)
        left = ttk.Frame(body); right = ttk.Frame(body); body.add(left, weight=3); body.add(right, weight=2)
        self.tree = ttk.Treeview(left, columns=("status", "verified", "found", "saved"), show="headings", selectmode="browse")
        for col, title, width in [("status", "Status", 210), ("verified", "Verified", 70), ("found", "Found", 60), ("saved", "Saved", 60)]: self.tree.heading(col, text=title); self.tree.column(col, width=width, anchor="center")
        self.tree.pack(fill="both", expand=True)
        self.preview = ttk.Label(right, text="Latest downloaded image preview", anchor="center"); self.preview.pack(fill="both", expand=True)
        ttk.Label(right, text="Download log").pack(anchor="w")
        self.log = tk.Text(right, height=13, state="disabled", wrap="word"); self.log.pack(fill="x")

    def refresh_models(self) -> None:
        self.tree.delete(*self.tree.get_children())
        records = self.downloader.state["models"]
        downloaded = failed = 0
        for product in self.downloader.products:
            item = records.get(product.model, {})
            status = item.get("status", "NOT_YET_RUN")
            found, saved = len(item.get("galleryImages", [])), len(item.get("downloads", []))
            downloaded += saved
            failed += status not in {"NOT_YET_RUN", "DISCOVERED", "COMPLETE", "COMPLETE_WITH_WARNINGS", "COMPLETE_DUPLICATES_ONLY"}
            self.tree.insert("", "end", iid=product.model, values=(status, "yes" if item.get("verified") else "no", found, saved), text=product.model)
        self.counts.set(f"Downloaded images: {downloaded}   Failed/manual models: {failed}")

    def launch(self, download: bool, models: set[str] | None = None) -> None:
        if self.worker and self.worker.is_alive(): return
        self.control = RunControl()
        self.worker = threading.Thread(target=lambda: asyncio.run(self.downloader.run(models, download, self.control)), daemon=True)
        self.worker.start(); self.current.set("Starting browser-assisted inspection…")

    def retry_failed(self) -> None:
        failed = {m for m, r in self.downloader.state["models"].items() if r.get("status") not in {"COMPLETE", "COMPLETE_WITH_WARNINGS", "COMPLETE_DUPLICATES_ONLY"}}
        self.launch(True, failed or None)

    def review_selected(self) -> None:
        chosen = self.tree.selection()
        if not chosen: messagebox.showinfo("Select a model", "Select a model row first."); return
        model = chosen[0]; record = self.downloader.state["models"].get(model)
        if not record or not record.get("productPageUrl"):
            messagebox.showinfo("Inspect first", "Run discovery for this model first so the official page and gallery candidates can be verified."); return
        webbrowser.open(record["productPageUrl"])
        ReviewDialog(self, self.downloader, model, record)

    def consume_events(self) -> None:
        try:
            while True:
                event, data = self.events.get_nowait()
                if event == "log":
                    self.log.configure(state="normal"); self.log.insert("end", data["message"] + "\n"); self.log.see("end"); self.log.configure(state="disabled")
                elif event == "progress":
                    self.current.set(f"Current model: {data['current']} ({data['index']}/{data['total']})"); self.bar.configure(maximum=data["total"], value=data["index"] - 1)
                elif event == "model": self.refresh_models()
                elif event == "preview": self.show_preview(Path(data["path"]))
                elif event == "finished": self.current.set("Finished — see the report for verified results and manual-review requirements."); self.refresh_models()
        except queue.Empty: pass
        self.after(100, self.consume_events)

    def show_preview(self, path: Path) -> None:
        try:
            with Image.open(path) as image:
                image.thumbnail((410, 410)); copy = image.copy()
            self.preview_image = ImageTk.PhotoImage(copy); self.preview.configure(image=self.preview_image, text="")
        except (OSError, UnidentifiedImageError): pass


class ReviewDialog(tk.Toplevel):
    def __init__(self, parent: App, downloader: Downloader, model: str, record: dict[str, Any]) -> None:
        super().__init__(parent); self.title(f"Review official gallery — {model}"); self.geometry("850x430")
        ttk.Label(self, text=f"{model}\nOfficial page opened in your browser. Select only images you see in that product's gallery.", padding=10).pack(anchor="w")
        self.vars: list[tuple[str, tk.BooleanVar]] = []
        box = ttk.Frame(self); box.pack(fill="both", expand=True, padx=10)
        for item in record.get("galleryImages", []):
            var = tk.BooleanVar(value=item["url"] in downloader.state["manualSelections"].get(model, []))
            suffix = " (automated download blocked by robots)" if not item.get("robotsAllowed") else ""
            ttk.Checkbutton(box, text=item["url"] + suffix, variable=var).pack(anchor="w", pady=2)
            self.vars.append((item["url"], var))
        ttk.Button(self, text="Save selected gallery images", command=lambda: self.save(downloader, model)).pack(pady=10)

    def save(self, downloader: Downloader, model: str) -> None:
        downloader.state["manualSelections"][model] = [url for url, var in self.vars if var.get()]
        downloader.save_state(); downloader.write_reports(); self.destroy()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true", help="Run headlessly and attempt permitted image downloads.")
    parser.add_argument("--test", action="store_true", help="Inspect only; never request image bytes.")
    parser.add_argument("--model", help="Process one exact model code.")
    args = parser.parse_args()
    if args.run or args.test:
        selected = {args.model.upper()} if args.model else None
        downloader = Downloader(lambda event, data: print(data.get("message", data), flush=True))
        asyncio.run(downloader.run(selected, download=args.run and not args.test, control=RunControl()))
    else:
        App().mainloop()


if __name__ == "__main__":
    main()
