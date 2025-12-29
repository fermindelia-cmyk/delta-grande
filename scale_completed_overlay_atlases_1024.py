#!/usr/bin/env python3
"""Create 1024px multi-atlas variants for the completed-species overlay.

Goal:
- Keep the SAME page count and per-page layout.
- Downscale the *entire atlas pages* to 50% resolution.
    This preserves the exact look of the 2048 atlases, just with fewer pixels.
- Update frame rectangles by scaling their edges by 0.5.
- Write a separate set of files so runtime can opt-in:
    - sheet_1024.json
    - sheet_1024_00.webp, sheet_1024_01.webp, ...

This script reads the existing multi-atlas sheet.json (meta.pages) and downsizes
each page image as a whole (instead of resizing per-frame tiles).

Why this matters:
- Resizing per-tile can change edges/alpha ("looks less opaque") due to sampling
    at tile boundaries and alpha handling.
- Page-downscale + scaled rectangles matches "same pages, half resolution".

Usage:
  python scale_completed_overlay_atlases_1024.py

Requires:
  python -m pip install pillow
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image

import numpy as np


def _scale_edge(v: int, scale: float) -> int:
    return int(round(v * scale))


def _resize_rgba_premultiplied(im: Image.Image, new_size: Tuple[int, int]) -> Image.Image:
    """Resize with premultiplied alpha to avoid halos/opacity artifacts."""
    if im.mode != "RGBA":
        im = im.convert("RGBA")

    arr = np.asarray(im, dtype=np.float32)  # H,W,4 in 0..255
    rgb = arr[..., :3]
    a = arr[..., 3:4] / 255.0
    rgb_p = rgb * a

    premult = np.concatenate([rgb_p, arr[..., 3:4]], axis=2).clip(0, 255).astype(np.uint8)
    premult_im = Image.fromarray(premult, mode="RGBA")

    premult_small = premult_im.resize(new_size, resample=Image.Resampling.LANCZOS)

    arr2 = np.asarray(premult_small, dtype=np.float32)
    rgb2_p = arr2[..., :3]
    a2 = arr2[..., 3:4]
    denom = np.maximum(a2, 1.0)
    rgb2 = (rgb2_p * 255.0) / denom
    out = np.concatenate([rgb2, a2], axis=2).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, mode="RGBA")


def _load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(path: Path, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _save_lossless_webp(im: Image.Image, path: Path) -> None:
    im.save(path, "WEBP", lossless=True, quality=100, method=6)


def build_1024_variant(folder: Path) -> None:
    sheet_json = folder / "sheet.json"
    if not sheet_json.exists():
        raise RuntimeError(f"Missing sheet.json: {sheet_json}")

    data = _load_json(sheet_json)
    meta = data.get("meta") or {}
    pages = meta.get("pages")
    frames = data.get("frames")

    if not isinstance(pages, list) or not pages:
        raise RuntimeError(f"Expected meta.pages in {sheet_json}")
    if not isinstance(frames, list) or not frames:
        raise RuntimeError(f"Expected frames[] in {sheet_json}")

    scale = 0.5

    # Load source page images.
    src_images: List[Image.Image] = []
    for p in pages:
        name = p.get("image")
        if not name:
            raise RuntimeError(f"Page missing image name in {sheet_json}")
        path = folder / name
        if not path.exists():
            raise RuntimeError(f"Missing page image: {path}")
        src_images.append(Image.open(path).convert("RGBA"))

    try:
        page_count = len(pages)
        new_pages: List[Dict] = []

        # Downscale each page as a whole.
        new_page_images: List[Image.Image] = []
        for page_index, p in enumerate(pages):
            sz = p.get("size") or {}
            pw = int(sz.get("w") or src_images[page_index].width)
            ph = int(sz.get("h") or src_images[page_index].height)
            new_pw = max(1, _scale_edge(pw, scale))
            new_ph = max(1, _scale_edge(ph, scale))
            new_page_images.append(_resize_rgba_premultiplied(src_images[page_index], (new_pw, new_ph)))

        # Scale each frame rect by scaling its edges.
        new_frames: List[Dict] = []
        for entry in frames:
            page_index = int(entry.get("page") or 0)
            fr = entry.get("frame") or {}
            x = int(fr.get("x") or 0)
            y = int(fr.get("y") or 0)
            w = int(fr.get("w") or 0)
            h = int(fr.get("h") or 0)

            x0 = _scale_edge(x, scale)
            y0 = _scale_edge(y, scale)
            x1 = _scale_edge(x + w, scale)
            y1 = _scale_edge(y + h, scale)

            new_entry = dict(entry)
            new_entry["frame"] = {"x": x0, "y": y0, "w": max(1, x1 - x0), "h": max(1, y1 - y0)}
            new_frames.append(new_entry)

        # Write new pages.
        for page_index in range(page_count):
            out_name = f"sheet_1024_{page_index:02d}.webp"
            out_path = folder / out_name
            _save_lossless_webp(new_page_images[page_index], out_path)
            new_pages.append({
                "image": out_name,
                "size": {"w": int(new_page_images[page_index].width), "h": int(new_page_images[page_index].height)}
            })

        new_meta = dict(meta)
        new_meta["pages"] = new_pages

        # Keep original_frame_size unchanged; adjust scale as documentation.
        new_meta["scale"] = float(meta.get("scale") or 1.0) * scale

        out = {"meta": new_meta, "frames": new_frames}
        _save_json(folder / "sheet_1024.json", out)
    finally:
        for im in src_images:
            try:
                im.close()
            except Exception:
                pass


def main() -> None:
    root = Path(__file__).resolve().parent
    base = root / "game-assets" / "sub" / "interfaz"

    targets = [
        base / "completed-species-info",
        base / "completed-species-name",
        base / "completed-species-image",
    ]

    for folder in targets:
        print(f"[1024] building {folder}")
        build_1024_variant(folder)

    print("Done.")


if __name__ == "__main__":
    main()
