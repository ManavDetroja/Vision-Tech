# CP PLUS official product gallery downloader

This Windows application obtains images only from the rendered gallery of an exact,
verified product page on `cpplusworld.com`.  It does not scrape every image on a
page and it does not use third-party sources.  It checks `robots.txt` before each
automated request.  A robots denial, CAPTCHA, login, inaccessible original, or an
unverified product page is recorded as a failure/manual-review state rather than
being bypassed.

## Install and run

From PowerShell in `C:\Vision Tech`:

```powershell
py -3 -m venv .venv-cpplus-gallery
.\.venv-cpplus-gallery\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
playwright install chromium
python .\cp_plus_downloader.py
```

To make the required one-model, non-downloading discovery test:

```powershell
python .\cp_plus_downloader.py --test --model CP-UNC-DA21L3C-Q
```

To run without the window, after reviewing the behaviour, use `--run`.  Add
`--model MODEL_CODE` to restrict a run to one exact model.  The application never
overwrites an existing image; it records it as `EXISTS_NOT_OVERWRITTEN`.

## What is saved

Images retain their response format and are placed in the pre-existing model
directory as `MODEL_CODE_01.ext`, `MODEL_CODE_02.ext`, etc.  Progress is stored in
`logs/downloader-progress.json`.  The current report and manifest are written to
`assets/images/products/` and mirrored in `reports/`.  `logs/downloader.log` is an
append-only operational log.

## Manual review

Select a model and press **Review gallery**.  The official product page opens in
your browser and the discovered, gallery-scoped candidates can be selected in the
app.  Only checked candidates are eligible for a subsequent run.  If the site’s
robots policy does not permit programmatic retrieval, the app keeps the model in
manual-review state and never requests its image bytes.  It intentionally does not
try to defeat site controls.
