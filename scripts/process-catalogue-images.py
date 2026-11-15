"""Conservative local cutouts. Never fetch images or overwrite source files.

Usage: python scripts/process-catalogue-images.py source destination.png
Requires the existing Pillow installation. For uniform near-white backgrounds only.
Every output requires visual review before catalogue publication.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse
import json


def process(source, destination):
    source = Path(source).resolve()
    destination = Path(destination).resolve()
    if source == destination or destination.exists():
        raise ValueError('Never overwrite an original or existing derivative.')
    with Image.open(source) as original:
        original.load()
        rgba = original.convert('RGBA')
    if rgba.getchannel('A').getextrema()[0] < 255:
        raise ValueError('Already transparent: preserve the original cutout.')
    # Remove only near-white pixels connected to an outside edge. Interior white
    # components remain untouched; no AI generation, repainting, or upscaling.
    mask = Image.new('L', rgba.size)
    mask.putdata([1 if min(r, g, b) >= 250 and max(r, g, b) - min(r, g, b) <= 3 else 0
                  for r, g, b, a in rgba.getdata()])
    for x in range(mask.width):
        for y in (0, mask.height - 1):
            if mask.getpixel((x, y)) == 1:
                ImageDraw.floodfill(mask, (x, y), 2, thresh=0)
    for y in range(mask.height):
        for x in (0, mask.width - 1):
            if mask.getpixel((x, y)) == 1:
                ImageDraw.floodfill(mask, (x, y), 2, thresh=0)
    alpha = mask.point(lambda value: 0 if value == 2 else 255)
    if alpha.getextrema() != (0, 255):
        raise ValueError('No safe exterior background identified.')
    rgba.putalpha(alpha)
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError('Empty foreground; manual review required.')
    crop = rgba.crop(bounds)
    margin = max(12, round(max(crop.size) * .06))
    result = Image.new('RGBA', (crop.width + 2 * margin, crop.height + 2 * margin))
    result.paste(crop, (margin, margin))
    destination.parent.mkdir(parents=True, exist_ok=True)
    result.save(destination, optimize=True)
    return {'method': 'edge-connected near-white mask; no resampling', 'source': str(source),
            'output': str(destination), 'originalSize': list(rgba.size), 'cropBounds': list(bounds),
            'size': list(result.size), 'removedBackgroundPixels': alpha.histogram()[0],
            'visualReviewRequired': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('destination')
    args = parser.parse_args()
    print(json.dumps(process(args.source, args.destination), indent=2))
