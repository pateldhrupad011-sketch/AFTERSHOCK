"""
Extracts the player animation frames from the original Aseprite exports.

The source PNGs are large (2256x1230) canvases with a small character drawn at
3x scale. This script finds the character's bounding box, downsamples it back
to native pixel-art resolution (1 art pixel = 1 output pixel) and writes tight,
feet-aligned frames into assets/sprites/. The game then scales them up with
nearest-neighbour filtering so the art stays crisp at any screen size.

Usage (no third-party packages required):
    python3 tools/extract-sprites.py
"""

import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(ROOT, "assets", "source")
OUTPUT_DIR = os.path.join(ROOT, "assets", "sprites")
SOURCE_PIXEL_SCALE = 3

FRAMES = {
    "Sprite-0002.png": "player-run-1.png",
    "Sprite-0003.png": "player-run-2.png",
}


def paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def read_rgba_png(path):
    """Minimal decoder for 8-bit RGBA, non-interlaced PNGs."""
    with open(path, "rb") as handle:
        data = handle.read()
    pos, idat = 8, b""
    width = height = 0
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        chunk_type = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
            if bit_depth != 8 or color_type != 6:
                raise ValueError(f"{path}: expected 8-bit RGBA PNG")
        elif chunk_type == b"IDAT":
            idat += chunk
        pos += 12 + length

    raw = zlib.decompress(idat)
    stride = width * 4
    rows, previous, offset = [], bytearray(stride), 0
    for _ in range(height):
        filter_type = raw[offset]
        line = bytearray(raw[offset + 1:offset + 1 + stride])
        offset += 1 + stride
        for i in range(stride):
            left = line[i - 4] if i >= 4 else 0
            up = previous[i]
            up_left = previous[i - 4] if i >= 4 else 0
            if filter_type == 1:
                line[i] = (line[i] + left) & 255
            elif filter_type == 2:
                line[i] = (line[i] + up) & 255
            elif filter_type == 3:
                line[i] = (line[i] + (left + up) // 2) & 255
            elif filter_type == 4:
                line[i] = (line[i] + paeth(left, up, up_left)) & 255
        rows.append(line)
        previous = line
    return width, height, rows


def write_rgba_png(path, width, height, pixels):
    def chunk(kind, payload):
        body = kind + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(pixels[y]) for y in range(height))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as handle:
        handle.write(png)


def opaque_bounds(width, height, rows):
    xs, ys = [], []
    for y in range(height):
        row = rows[y]
        for x in range(width):
            if row[x * 4 + 3] > 0:
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def extract_frame(source_name, output_name):
    width, height, rows = read_rgba_png(os.path.join(SOURCE_DIR, source_name))
    left, top, right, bottom = opaque_bounds(width, height, rows)
    out_w = (right - left + 1) // SOURCE_PIXEL_SCALE
    out_h = (bottom - top + 1) // SOURCE_PIXEL_SCALE

    pixels = []
    for y in range(out_h):
        line = bytearray()
        # Sample the centre of each 3x3 art pixel so anti-aliased edges are ignored.
        sy = top + y * SOURCE_PIXEL_SCALE + SOURCE_PIXEL_SCALE // 2
        for x in range(out_w):
            sx = left + x * SOURCE_PIXEL_SCALE + SOURCE_PIXEL_SCALE // 2
            r, g, b, a = rows[sy][sx * 4:sx * 4 + 4]
            line += bytes((r, g, b, 255 if a > 127 else 0))
        pixels.append(line)

    write_rgba_png(os.path.join(OUTPUT_DIR, output_name), out_w, out_h, pixels)
    print(f"{source_name} -> {output_name} ({out_w}x{out_h})")


def build_opposite_leg_frame():
    """Mirror the stepping legs of run-2 so the other leg advances in the walk cycle."""
    path = os.path.join(OUTPUT_DIR, "player-run-2.png")
    width, height, rows = read_rgba_png(path)
    leg_start, mid = 35, 11
    out = []
    for y in range(height):
        if y < leg_start:
            out.append(bytearray(rows[y]))
            continue
        line = bytearray(width * 4)
        for x in range(width):
            src = mid + (mid - x) if x < mid else mid - (x - mid)
            src = max(0, min(width - 1, src))
            line[x * 4:(x + 1) * 4] = rows[y][src * 4:(src + 1) * 4]
        out.append(line)
    write_rgba_png(os.path.join(OUTPUT_DIR, "player-run-3.png"), width, height, out)
    print(f"player-run-2.png -> player-run-3.png ({width}x{height}) [opposite leg]")


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for source, output in FRAMES.items():
        extract_frame(source, output)
    build_opposite_leg_frame()
