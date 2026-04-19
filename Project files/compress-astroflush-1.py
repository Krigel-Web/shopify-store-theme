# ============================================================
#  AstroFlush 1 - Compress pages to WebP for Shopify upload
#  Run: python compress-astroflush-1.py
# ============================================================

import subprocess
import sys
import os

# Install Pillow if needed
subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "--quiet"])
from PIL import Image

SOURCE_DIR = r"C:\Users\PCZONE.GE\Desktop\BlackWhole\Project files\Astrouflash-1"
OUTPUT_DIR = r"C:\Users\PCZONE.GE\Desktop\BlackWhole\Project files\Astrouflash-1\webp-ready"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Settings
MAX_WIDTH = 1800       # px wide — good quality for comic reading
WEBP_QUALITY = 88      # 0-100, higher = better quality, larger file

source_files = sorted([
    f for f in os.listdir(SOURCE_DIR)
    if f.endswith(".jpg") and os.path.isfile(os.path.join(SOURCE_DIR, f))
])

print(f"\nCompressing {len(source_files)} pages to WebP...")
print(f"Settings: max width {MAX_WIDTH}px, quality {WEBP_QUALITY}\n")

total_original = 0
total_compressed = 0

for filename in source_files:
    source_path = os.path.join(SOURCE_DIR, filename)
    output_name = filename.replace(".jpg", ".webp")
    output_path = os.path.join(OUTPUT_DIR, output_name)

    original_size = os.path.getsize(source_path)
    total_original += original_size

    img = Image.open(source_path)

    # Resize if wider than MAX_WIDTH, keep aspect ratio
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        new_height = int(img.height * ratio)
        img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)

    # Convert to RGB if needed (webp doesn't support CMYK)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    img.save(output_path, "WEBP", quality=WEBP_QUALITY, method=6)

    compressed_size = os.path.getsize(output_path)
    total_compressed += compressed_size

    reduction = (1 - compressed_size / original_size) * 100
    print(f"  {filename} -> {output_name}  |  "
          f"{original_size/1024/1024:.1f}MB -> {compressed_size/1024:.0f}KB  |  "
          f"{reduction:.0f}% smaller")

print(f"\n{'='*50}")
print(f"  Total original:    {total_original/1024/1024:.1f} MB")
print(f"  Total compressed:  {total_compressed/1024/1024:.1f} MB")
print(f"  Overall reduction: {(1 - total_compressed/total_original)*100:.0f}%")
print(f"\n  Files saved to:")
print(f"  {OUTPUT_DIR}")
print(f"{'='*50}\n")
