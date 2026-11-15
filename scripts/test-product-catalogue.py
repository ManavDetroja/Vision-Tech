"""Real Chromium QA for the static catalogue; never submits a real enquiry.

Run: python scripts/test-product-catalogue.py --output PATH
Uses the existing Playwright installation and browser. No frontend build required.
"""
import argparse
import functools
import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import quote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REMOVED = ('CP-Z42Q', 'CP-UNC-DA41L3C-Q2', 'CP-DNW-HPU8G2-6-V3')


class StaticServer(ThreadingHTTPServer):
    # Chromium can open many parallel asset connections when routing disables cache.
    request_queue_size = 128
    daemon_threads = True


class StaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        parts = urlparse(self.path).path.split('/')
        if any(part.startswith('.') for part in parts if part):
            self.send_error(403)
            return
        try:
            super().do_GET()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass  # Navigation may cancel an in-flight lazy image response.


def run(output):
    output.mkdir(parents=True, exist_ok=True)
    products = json.loads((ROOT / 'js/data/products.json').read_text(encoding='utf-8-sig'))
    server = StaticServer(('127.0.0.1', 0), functools.partial(StaticHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}'
    results = {'models': [], 'checks': [], 'consoleErrors': [], 'networkFailures': [], 'server': 'Loopback static HTTP server; no build or backend'}

    def check(name, condition):
        results['checks'].append({'name': name, 'passed': bool(condition)})

    def go(page, route):
        response = page.goto(base + '/' + route, wait_until='networkidle')
        assert response.status == 200

    def images_fit(page):
        return page.locator('[data-product-image], [data-gallery-main]').evaluate_all("""images => images.every(image => {
            if (image.hidden) return true;
            const bounds = image.getBoundingClientRect();
            const frame = image.closest('[data-product-image-frame], .product-gallery-stage').getBoundingClientRect();
            return bounds.left >= frame.left - 1 && bounds.top >= frame.top - 1 &&
                bounds.right <= frame.right + 1 && bounds.bottom <= frame.bottom + 1 &&
                getComputedStyle(image).objectFit === 'contain';
        })""")

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
            context.route('**/*', lambda route: route.continue_() if urlparse(route.request.url).hostname in ['127.0.0.1', 'localhost'] else route.abort())
            page = context.new_page()
            page.on('pageerror', lambda error: results['consoleErrors'].append(str(error)))
            page.on('console', lambda message: results['consoleErrors'].append(message.text) if message.type == 'error' else None)
            page.on('response', lambda response: results['networkFailures'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
            page.on('requestfailed', lambda request: results['networkFailures'].append({'url': request.url, 'error': request.failure}) if request.failure != 'net::ERR_ABORTED' else None)
            check('19 unique exact model records; removed models absent', len(products) == 19 and len({p['model'] for p in products}) == 19 and not set(REMOVED) & {p['model'] for p in products})
            go(page, 'products.html')
            page.locator('#product-grid .product-card').first.wait_for()
            check('All 19 catalogue cards render', page.locator('#product-grid .product-card').count() == 19)
            page.locator('[data-product-image]').evaluate_all("images => images.forEach(image => image.loading = 'eager')")
            page.wait_for_function("[...document.querySelectorAll('[data-product-image]')].every(image => image.complete && image.naturalWidth > 0)")
            check('19 catalogue photographs load and use contain', page.locator('[data-product-image]').count() == 19 and page.locator('[data-product-image]').evaluate_all("images => images.every(image => getComputedStyle(image).objectFit === 'contain')"))
            check('No removed-model placeholders remain', page.locator('#product-grid [data-product-image-placeholder]').count() == 0)
            check('Catalogue image bounds prevent clipping', images_fit(page))
            page.screenshot(path=str(output/'catalogue-desktop.png'), full_page=True)
            for product in products:
                model = product['model']; row = {'model': model, 'category': product['categoryId']}
                page.locator('#product-search').fill(model)
                row['searchExactModel'] = page.locator('#product-grid .product-card').count() == 1 and page.locator('#product-grid .product-card').get_attribute('data-model') == model
                row['cardEnquiryModel'] = 'model=' + quote(model) in page.locator('.product-card-actions a').last.get_attribute('href')
                page.locator('.product-card-actions a').first.click()
                page.wait_for_selector('#detail-title')
                row['route'] = page.url.split(base+'/')[1]
                row['exactModel'] = page.locator('.detail-model strong').inner_text() == model
                row['titleAndDescription'] = model in page.title() and model in page.locator('meta[name="description"]').get_attribute('content')
                row['canonical'] = page.locator('link[rel="canonical"]').get_attribute('href') == 'https://visiontechsolutionmorbi.in/product-details.html?model=' + quote(model)
                row['categoryCorrect'] = page.locator('.detail-category-line .badge').count() == 1 and product['subcategory'] in page.locator('.detail-category-line').inner_text() if product['subcategory'] else True
                row['specificationRows'] = page.locator('.spec-table tbody tr').count()
                rows = page.locator('.spec-table tbody').inner_text()
                row['specificationsMatchRecord'] = all((str(value) in rows if value is not None else True) for key, value in product['specifications'].items())
                row['unverifiedFieldsLabelled'] = all(page.locator('.spec-table tbody tr').filter(has=page.get_by_role('rowheader', name=key, exact=True)).inner_text().count('Not yet verified') > 0 for key, value in product['specifications'].items() if value is None)
                row['galleryImages'] = []
                paths = product.get('galleryPaths', [])
                if paths:
                    for index, path in enumerate(paths):
                        if len(paths) > 1:
                            page.locator('[data-gallery-thumbnail]').nth(index).click()
                        page.wait_for_function("path => { const im = document.querySelector('[data-gallery-main]'); return im && im.getAttribute('src') === path && im.complete && im.naturalWidth > 0 && !im.hidden; }", arg=path)
                        row['galleryImages'].append({'path': path, 'loaded': True, 'selected': True})
                    page.locator('[data-gallery-open]').click()
                    row['lightbox'] = page.locator('[data-gallery-dialog]').is_visible()
                    page.keyboard.press('Escape')
                    row['lightbox'] = row['lightbox'] and not page.locator('[data-gallery-dialog]').is_visible()
                else:
                    row['placeholderVisible'] = page.locator('.detail-art [data-product-image-placeholder]').is_visible()
                related = page.locator('.related-product-card').evaluate_all("links => links.map(link => link.getAttribute('href'))")
                expected = {p['model'] for p in products if p['categoryId'] == product['categoryId'] and p['id'] != product['id']}
                row['relatedProducts'] = set(href.split('model=')[1] for href in related) == expected
                row['imagesWithinFrames'] = images_fit(page)
                row['accessibleImagesAndTable'] = page.locator('[data-gallery-main], [data-product-image]').evaluate_all("images => images.every(image => image.alt.trim().length > 0)") and page.locator('.spec-table caption').count() == 1
                structured = page.locator('#product-structured-data')
                row['structuredData'] = structured.count() == (1 if product['verification']['status'] == 'verified' else 0)
                if structured.count():
                    data = json.loads(structured.text_content())
                    row['structuredData'] = row['structuredData'] and data['model'] == model and not any(key in data for key in ['offers','aggregateRating','review'])
                if model == 'CP-UNC-DA21L3C-Q':
                    page.screenshot(path=str(output/'product-detail-desktop.png'), full_page=True)
                page.locator('.detail-enquiry-button').click()
                page.wait_for_function("document.querySelectorAll('#contact-product-models option').length === 19")
                row['enquiryPrefill'] = page.locator('#contact-model').input_value() == model and page.locator('#contact-type').input_value() == 'product'
                results['models'].append(row)
                check('All detail assertions: '+model, all(value for value in row.values() if isinstance(value, bool)) and len(row['galleryImages']) == len(paths))
                go(page, 'products.html')
                page.wait_for_selector('#product-search')
            for category in sorted({p['categoryId'] for p in products}):
                page.locator('#category-filter').select_option(category)
                expected = [p for p in products if p['categoryId'] == category]
                check('Category filter: '+category, page.locator('.product-card').count() == len(expected))
                for subcategory in sorted({p['subcategory'] for p in expected if p['subcategory']}):
                    page.locator('#subcategory-filter').select_option(subcategory)
                    check('Subcategory filter: '+category+'/'+subcategory, page.locator('.product-card').count() == sum(p['subcategory']==subcategory for p in expected))
                page.locator('.clear-filters').click()
            for resolution in [2,3,4,6]:
                page.locator('#resolution-filter').select_option(str(resolution))
                check('Resolution filter: '+str(resolution), page.locator('.product-card').count() == sum(p['resolutionMp']==resolution for p in products))
                page.locator('.clear-filters').click()
            for option, reverse in [('az',False),('za',True)]:
                page.locator('#sort-filter').select_option(option)
                models=page.locator('.product-card').evaluate_all("cards => cards.map(card => card.dataset.model)")
                check('Sort: '+option, models==sorted(models,reverse=reverse))
            page.locator('#sort-filter').select_option('resolution')
            models=page.locator('.product-card').evaluate_all("cards => cards.map(card => card.dataset.model)")
            check('Sort: resolution', models == [p['model'] for p in sorted(products,key=lambda p:(p['resolutionMp'] or 0,p['model']))])
            page.locator('#product-search').fill('no-such-model')
            check('No search results state', page.get_by_text('No matching products',exact=True).is_visible())
            page.locator('.clear-filters').click()
            check('Clear all filters restores 19', page.locator('.product-card').count()==19)
            go(page,'product-details.html?model=UNKNOWN-MODEL')
            check('Unknown route and noindex', page.get_by_role('heading',name='Product not found').is_visible() and page.locator('meta[name="robots"]').get_attribute('content')=='noindex')
            # Form validation is local only: no POST request or customer persistence.
            go(page,'contact.html?type=product&model=CP-E21Q')
            page.locator('#contact-submit').click()
            check('Empty form validation', page.locator('[aria-invalid="true"]').count()>0)
            page.locator('#contact-name').fill('Catalogue QA')
            page.locator('#contact-email').fill('qa@example.invalid')
            page.locator('#contact-phone').fill('1234567890')
            page.locator('#contact-message').fill('Synthetic local validation test; never submitted to a backend.')
            page.locator('#contact-consent').check()
            page.locator('#contact-submit').click()
            check('Unconfigured form reports nothing transmitted', 'Nothing was transmitted or saved' in page.locator('#contact-form-status').inner_text())
            for width,height in [(1440,1000),(768,1024),(390,844)]:
                page.set_viewport_size({'width':width,'height':height})
                for route in ['products.html','product-details.html?model=CP-UNC-DA21L3C-Q','product-details.html?model=CP-SL06K','contact.html?type=product&model=CP-E31Q']:
                    go(page,route)
                    check(f'No horizontal overflow {width}: {route}',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
                    check(f'No image clipping {width}: {route}',images_fit(page))
                if width==390:
                    go(page,'products.html')
                    page.locator('.nav-toggle').click()
                    check('Mobile menu opens',page.locator('.nav-toggle').get_attribute('aria-expanded')=='true')
                    page.locator('.nav-toggle').click()
                    check('Mobile menu closes',page.locator('.nav-toggle').get_attribute('aria-expanded')=='false')
                    page.screenshot(path=str(output/'catalogue-mobile.png'),full_page=True)
                    go(page,'product-details.html?model=CP-UNC-DA21L3C-Q')
                    page.locator('[data-gallery-thumbnail]').nth(1).focus()
                    page.keyboard.press('Enter')
                    check('Keyboard thumbnail selection',page.locator('[data-gallery-thumbnail]').nth(1).get_attribute('aria-pressed')=='true')
                    page.screenshot(path=str(output/'product-detail-mobile.png'),full_page=True)
                    page.locator('.detail-enquiry-button').click()
                    page.wait_for_function("document.querySelectorAll('#contact-product-models option').length === 19")
                    check('Mobile enquiry exact prefill',page.locator('#contact-model').input_value()=='CP-UNC-DA21L3C-Q')
            for route in ['index.html','services.html','about.html','contact.html']:
                go(page,route)
                check('Public navigation shell: '+route,page.locator('#site-header nav').count()>0 and page.locator('h1').count()==1)
            # Internal link crawl: only actual public hrefs, no admin/API access.
            go(page,'products.html')
            links=page.locator('a[href]').evaluate_all("links => [...new Set(links.map(a => a.href))]")
            for link in links:
                if link.startswith(base) and '/admin/' not in link:
                    response=context.request.get(link)
                    check('Internal link '+link.replace(base,''),response.status==200)
            check('Normal-page console errors',not results['consoleErrors'])
            check('Normal-page HTTP errors',not results['networkFailures'])
            # Deliberate broken-image cases get separate diagnostics.
            failure_page=context.new_page()
            failure_page.route('**/assets/images/products/**',lambda route:route.fulfill(status=404,body='Intentional QA missing image'))
            go(failure_page,'products.html')
            failure_page.locator('[data-product-image]').evaluate_all("images => images.forEach(image => image.loading = 'eager')")
            failure_page.wait_for_function("document.querySelectorAll('.product-image-frame.is-unavailable').length === 19")
            check('All failed card images show fallbacks',failure_page.locator('.product-image-frame.is-unavailable').count()==19)
            check('Failed image elements hidden',failure_page.locator('[data-product-image]').evaluate_all("images => images.every(image => getComputedStyle(image).display === 'none')"))
            go(failure_page,'product-details.html?model=CP-UNC-DA21L3C-Q')
            failure_page.locator('[data-gallery-fallback]').wait_for(state='visible')
            check('Failed gallery fallback visible',failure_page.locator('[data-gallery-fallback]').is_visible())
            check('Failed gallery cannot open',failure_page.locator('[data-gallery-open]').is_disabled())
            browser.close()
    except Exception as exc:
        results['fatalError']=str(exc)
    finally:
        server.shutdown()
        server.server_close()
    results['passed']=sum(c['passed'] for c in results['checks'])
    results['failed']=sum(not c['passed'] for c in results['checks'])
    (output/'results.json').write_text(json.dumps(results,indent=2),encoding='utf8')
    print(json.dumps({'modelsTested':len(results['models']),'checksPassed':results['passed'],'checksFailed':results['failed'],'fatalError':results.get('fatalError'),'output':str(output)},indent=2))
    return 1 if results['failed'] or results.get('fatalError') else 0


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    raise SystemExit(run(parser.parse_args().output.resolve()))
