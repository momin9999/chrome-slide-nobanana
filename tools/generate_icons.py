#!/usr/bin/env python3
"""Generate the extension's PNG icons without any third-party libraries.

The icon is a friendly "no banana" mark: a yellow rounded square with a
banana-style crescent and a red prohibition slash drawn on top. Rendered with
supersampling for smooth edges, then written out as RGBA PNGs at the sizes the
manifest references.
"""

import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

YELLOW = (255, 209, 59)      # banana / background
YELLOW_DARK = (240, 184, 30) # banana shading
RED = (224, 49, 49)          # prohibition sign
BROWN = (120, 80, 30)        # banana tips


def _lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _rounded_rect(x, y, w, h, r):
    """Signed-ish containment test for a rounded rectangle."""
    if x < r and y < r:
        return (x - r) ** 2 + (y - r) ** 2 <= r * r
    if x > w - r and y < r:
        return (x - (w - r)) ** 2 + (y - r) ** 2 <= r * r
    if x < r and y > h - r:
        return (x - r) ** 2 + (y - (h - r)) ** 2 <= r * r
    if x > w - r and y > h - r:
        return (x - (w - r)) ** 2 + (y - (h - r)) ** 2 <= r * r
    return 0 <= x <= w and 0 <= y <= h


def _banana(px, py, size):
    """Return True if the point is inside the crescent banana shape."""
    cx, cy = size * 0.52, size * 0.5
    # Two offset circles; inside the big one but outside the small one => crescent.
    big_r = size * 0.30
    small_r = size * 0.30
    d_big = math.hypot(px - cx, py - cy + size * 0.02)
    d_small = math.hypot(px - (cx + size * 0.16), py - (cy - size * 0.16))
    return d_big <= big_r and d_small >= small_r


def render(size):
    ss = 4  # supersampling factor
    S = size * ss
    # RGBA buffer
    buf = [[(0, 0, 0, 0) for _ in range(S)] for _ in range(S)]
    r = S * 0.22  # corner radius

    # slash line geometry (the prohibition bar), from top-left to bottom-right
    ring_cx, ring_cy = S * 0.5, S * 0.5
    ring_r = S * 0.40
    ring_t = S * 0.085
    bar_t = S * 0.075
    # bar direction (45 deg)
    bx, by = math.cos(math.radians(45)), math.sin(math.radians(45))

    for y in range(S):
        for x in range(S):
            fx, fy = x + 0.5, y + 0.5
            color = None
            alpha = 0

            if _rounded_rect(fx, fy, S, S, r):
                # base background
                shade = fy / S
                color = _lerp(YELLOW, YELLOW_DARK, shade * 0.25)
                alpha = 255

                # banana shading on top of background
                if _banana(fx, fy, S):
                    color = _lerp(YELLOW_DARK, BROWN, 0.15)

            # Prohibition ring
            d_ring = abs(math.hypot(fx - ring_cx, fy - ring_cy) - ring_r)
            if d_ring <= ring_t / 2 and math.hypot(fx - ring_cx, fy - ring_cy) <= ring_r + ring_t:
                color = RED
                alpha = 255

            # Prohibition diagonal bar (only within the ring's outer radius)
            rel_x, rel_y = fx - ring_cx, fy - ring_cy
            # distance from the 45-degree line through center
            dist_line = abs(rel_x * by - rel_y * bx)
            along = rel_x * bx + rel_y * by
            if dist_line <= bar_t / 2 and abs(along) <= ring_r:
                color = RED
                alpha = 255

            if alpha:
                buf[y][x] = (color[0], color[1], color[2], alpha)

    # Downsample by averaging ss x ss blocks
    out = bytearray()
    for y in range(size):
        out.append(0)  # PNG filter type 0 per scanline
        for x in range(size):
            rr = gg = bb = aa = 0
            for dy in range(ss):
                for dx in range(ss):
                    p = buf[y * ss + dy][x * ss + dx]
                    rr += p[0] * p[3]
                    gg += p[1] * p[3]
                    bb += p[2] * p[3]
                    aa += p[3]
            n = ss * ss
            a = aa // n
            if aa > 0:
                rr = rr // aa
                gg = gg // aa
                bb = bb // aa
            else:
                rr = gg = bb = 0
            out += bytes((rr, gg, bb, a))
    return bytes(out)


def write_png(path, size, raw):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return c

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(raw, 9)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (16, 48, 128):
        raw = render(size)
        path = os.path.join(OUT_DIR, f"icon{size}.png")
        write_png(path, size, raw)
        print("wrote", path)


if __name__ == "__main__":
    main()
