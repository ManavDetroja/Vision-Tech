"""Decode a single owner-approved photograph and discard its metadata."""
import io
import sys
import struct
import warnings
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 12_000_000
warnings.simplefilter("error", Image.DecompressionBombWarning)
try:
    with Image.open(io.BytesIO(sys.stdin.buffer.read(4 * 1024 * 1024 + 1))) as src:
        if src.format != sys.argv[1] or getattr(src, "n_frames", 1) != 1:
            raise ValueError()
        src.load()
        image = ImageOps.exif_transpose(src).convert("RGBA")
        image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", image.size, "white")
        canvas.paste(image, mask=image.getchannel("A"))
        sys.stdout.buffer.write(struct.pack(">II", *canvas.size))
        canvas.save(sys.stdout.buffer, format="JPEG", quality=90)
except (OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
    sys.exit(2)
