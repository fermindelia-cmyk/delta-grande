#!/usr/bin/env python3
"""Build a multi-atlas WebP spritesheet (multiple pages).

Why:
- Large single-sheet textures (e.g. 7k×6k) can cause decode + GPU upload spikes.
- Splitting into multiple <=2048×2048 pages keeps GPU uploads small and predictable.

What it does:
- Mode A (recommended for completed overlay):
    Split an existing legacy atlas (sheet.webp + sheet.json) into multiple <=max pages
    WITHOUT changing frame pixels. It uses the frame rectangles in sheet.json and
    crops from sheet.webp.
- Mode B:
    Build pages from individual frames in a folder (no scaling).

Usage:
    # Split an existing sheet.webp using sheet.json
    python build_multi_atlas.py <input_folder> --from-sheet --max-dim 2048

    # Build from individual frames (no scaling)
    python build_multi_atlas.py <input_folder> --from-frames --max-dim 2048

Optional:
  --out-dir <dir>         (default: input folder)
  --prefix sheet          (default: sheet)
  --delete-old-single     (delete legacy sheet.webp if present)

Notes:
- No scaling is applied in either mode.
- In --from-sheet mode, the new atlases preserve the exact pixel content that
    currently exists in sheet.webp (i.e. the already-downscaled quality).
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import List, Tuple

from PIL import Image


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def collect_frames(folder: Path) -> List[Path]:
    pngs = sorted([p for p in folder.iterdir() if p.is_file() and p.suffix.lower() == ".png"], key=lambda p: natural_key(p.name))
    if pngs:
        return pngs

    webps = sorted([p for p in folder.iterdir() if p.is_file() and p.suffix.lower() == ".webp"], key=lambda p: natural_key(p.name))
    # Filter out previously-generated sheets.
    webps = [p for p in webps if not re.match(r"^sheet(_\d+)?\.webp$", p.name, re.IGNORECASE)]
    return webps


def get_frame_size(frames: List[Path]) -> Tuple[int, int]:
    with Image.open(frames[0]) as im:
        im = im.convert("RGBA")
        return im.size


def build_pages(frames: List[Path], frame_w: int, frame_h: int, max_dim: int) -> Tuple[int, int, int]:
    cols = max(1, max_dim // frame_w)
    rows = max(1, max_dim // frame_h)
    per_page = max(1, cols * rows)
    return cols, rows, per_page


def save_lossless_webp(image: Image.Image, path: Path):
    # Pillow: WEBP lossless mode preserves pixels (no quality loss)
    image.save(
        path,
        "WEBP",
        lossless=True,
        quality=100,
        method=6,
    )


def _compute_page_layout(frame_w: int, frame_h: int, max_dim: int) -> Tuple[int, int, int, int, int]:
    if frame_w <= 0 or frame_h <= 0:
        raise RuntimeError(f"Invalid frame size: {frame_w}x{frame_h}")

    cols = max(1, max_dim // frame_w)
    rows = max(1, max_dim // frame_h)
    page_w = cols * frame_w
    page_h = rows * frame_h
    per_page = max(1, cols * rows)
    return cols, rows, per_page, page_w, page_h


def build_multi_atlas_from_frames(input_folder: Path, out_dir: Path, prefix: str, max_dim: int, delete_old_single: bool):
    frames = collect_frames(input_folder)
    if not frames:
        raise RuntimeError(f"No PNG/WebP frames found in {input_folder}")

    frame_w, frame_h = get_frame_size(frames)

    # Validate consistent sizes.
    for p in frames[1:10]:
        with Image.open(p) as im:
            im = im.convert("RGBA")
            if im.size != (frame_w, frame_h):
                raise RuntimeError(f"Frame size mismatch: {p.name} is {im.size}, expected {(frame_w, frame_h)}")

    cols, rows, per_page, page_w, page_h = _compute_page_layout(frame_w, frame_h, max_dim)

    pages = []
    out_frames = []

    total = len(frames)
    page_count = (total + per_page - 1) // per_page

    out_dir.mkdir(parents=True, exist_ok=True)

    for page_index in range(page_count):
        start = page_index * per_page
        end = min(total, start + per_page)
        page_frames = frames[start:end]

        sheet = Image.new("RGBA", (page_w, page_h), (0, 0, 0, 0))

        for i, frame_path in enumerate(page_frames):
            row = i // cols
            col = i % cols
            x = col * frame_w
            y = row * frame_h

            with Image.open(frame_path) as im:
                im = im.convert("RGBA")
                sheet.paste(im, (x, y), im)

            out_frames.append(
                {
                    "filename": frame_path.name,
                    "page": page_index,
                    "frame": {"x": x, "y": y, "w": frame_w, "h": frame_h},
                    "rotated": False,
                    "trimmed": False,
                    "spriteSourceSize": {"x": 0, "y": 0, "w": frame_w, "h": frame_h},
                    "sourceSize": {"w": frame_w, "h": frame_h},
                }
            )

        page_name = f"{prefix}_{page_index:02d}.webp"
        page_path = out_dir / page_name
        save_lossless_webp(sheet, page_path)

        pages.append({"image": page_name, "size": {"w": page_w, "h": page_h}})

    meta = {
        "pages": pages,
        "frame_count": total,
        "cols": cols,
        "rows": rows,
        "frame_size": {"w": frame_w, "h": frame_h},
        "original_frame_size": {"w": frame_w, "h": frame_h},
        "scale": 1.0,
    }

    out_json = {"meta": meta, "frames": out_frames}
    json_path = out_dir / "sheet.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(out_json, f, ensure_ascii=False, indent=2)

    if delete_old_single:
        legacy = out_dir / "sheet.webp"
        if legacy.exists():
            legacy.unlink()


def build_multi_atlas_from_sheet(input_folder: Path, out_dir: Path, prefix: str, max_dim: int, delete_old_single: bool):
    """Split legacy sheet.webp into <=max_dim pages using rectangles from sheet.json."""
    json_path = input_folder / "sheet.json"
    if not json_path.exists():
        raise RuntimeError(f"Missing sheet.json in {input_folder}")

    with open(json_path, "r", encoding="utf-8") as f:
        sheet = json.load(f)

    meta = sheet.get("meta") or {}
    frames = sheet.get("frames")
    if not isinstance(frames, list) or not frames:
        raise RuntimeError(f"sheet.json has no frames: {json_path}")

    image_name = meta.get("image") or "sheet.webp"
    sheet_path = input_folder / image_name
    if not sheet_path.exists():
        # Common legacy name
        fallback = input_folder / "sheet.webp"
        if fallback.exists():
            sheet_path = fallback
        else:
            raise RuntimeError(f"Missing sheet image {image_name} in {input_folder}")

    # Determine the actual frame size from metadata (preferred), otherwise from first frame.
    fs = meta.get("frame_size") or {}
    frame_w = int(fs.get("w") or frames[0].get("frame", {}).get("w") or 0)
    frame_h = int(fs.get("h") or frames[0].get("frame", {}).get("h") or 0)
    if frame_w <= 0 or frame_h <= 0:
        raise RuntimeError(f"Cannot determine frame_size from {json_path}")

    cols, rows, per_page, page_w, page_h = _compute_page_layout(frame_w, frame_h, max_dim)
    total = len(frames)
    page_count = (total + per_page - 1) // per_page

    out_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(sheet_path) as sheet_im:
        sheet_im = sheet_im.convert("RGBA")

        out_frames = []
        pages = []

        # Pre-create all pages.
        page_images = [Image.new("RGBA", (page_w, page_h), (0, 0, 0, 0)) for _ in range(page_count)]

        for idx, entry in enumerate(frames):
            src_rect = entry.get("frame") or {}
            sx = int(src_rect.get("x", 0))
            sy = int(src_rect.get("y", 0))
            sw = int(src_rect.get("w", frame_w))
            sh = int(src_rect.get("h", frame_h))

            # Crop exact pixels from the legacy sheet.
            tile = sheet_im.crop((sx, sy, sx + sw, sy + sh))

            page_index = idx // per_page
            within = idx % per_page
            row = within // cols
            col = within % cols
            dx = col * frame_w
            dy = row * frame_h

            page_images[page_index].paste(tile, (dx, dy), tile)

            out_frames.append(
                {
                    "filename": entry.get("filename"),
                    "page": page_index,
                    "frame": {"x": dx, "y": dy, "w": frame_w, "h": frame_h},
                    "rotated": False,
                    "trimmed": False,
                    "spriteSourceSize": entry.get("spriteSourceSize") or {"x": 0, "y": 0, "w": frame_w, "h": frame_h},
                    "sourceSize": entry.get("sourceSize") or {"w": frame_w, "h": frame_h},
                }
            )

        # Save pages.
        for page_index, page_im in enumerate(page_images):
            page_name = f"{prefix}_{page_index:02d}.webp"
            page_path = out_dir / page_name
            save_lossless_webp(page_im, page_path)
            pages.append({"image": page_name, "size": {"w": page_w, "h": page_h}})

        out_meta = {
            "pages": pages,
            "frame_count": int(meta.get("frame_count") or total),
            "cols": cols,
            "rows": rows,
            "frame_size": {"w": frame_w, "h": frame_h},
            "original_frame_size": meta.get("original_frame_size") or meta.get("frame_size") or {"w": frame_w, "h": frame_h},
            "scale": float(meta.get("scale") or 1.0),
        }

        out_json = {"meta": out_meta, "frames": out_frames}
        out_json_path = out_dir / "sheet.json"
        with open(out_json_path, "w", encoding="utf-8") as f:
            json.dump(out_json, f, ensure_ascii=False, indent=2)

    if delete_old_single:
        # Remove legacy single sheet to ensure runtime uses multi-atlas.
        if sheet_path.exists():
            try:
                sheet_path.unlink()
            except Exception:
                pass


def build_multi_atlas(input_folder: Path, out_dir: Path, prefix: str, max_dim: int, delete_old_single: bool, mode: str):
    if mode == "from_sheet":
        return build_multi_atlas_from_sheet(input_folder, out_dir, prefix, max_dim, delete_old_single)
    if mode == "from_frames":
        return build_multi_atlas_from_frames(input_folder, out_dir, prefix, max_dim, delete_old_single)
    raise RuntimeError(f"Unknown mode: {mode}")


def main():
    parser = argparse.ArgumentParser(description="Build multi-atlas spritesheets (<= max dim) from a folder of frames.")
    parser.add_argument("input_folder", help="Folder containing frames (PNG preferred).")
    parser.add_argument("--out-dir", default=None, help="Output directory (default: input folder)")
    parser.add_argument("--prefix", default="sheet", help="Output page prefix (default: sheet)")
    parser.add_argument("--max-dim", type=int, default=2048, help="Maximum atlas page width/height (default: 2048)")
    parser.add_argument("--delete-old-single", action="store_true", help="Delete legacy sheet.webp if present")
    parser.add_argument("--from-sheet", action="store_true", help="Split existing sheet.webp + sheet.json (recommended)")
    parser.add_argument("--from-frames", action="store_true", help="Build from individual frame files (no scaling)")

    args = parser.parse_args()
    input_folder = Path(args.input_folder)
    if not input_folder.exists():
        raise SystemExit(f"Input folder does not exist: {input_folder}")

    out_dir = Path(args.out_dir) if args.out_dir else input_folder

    mode = "from_sheet" if args.from_sheet else ("from_frames" if args.from_frames else "from_sheet")
    build_multi_atlas(
        input_folder=input_folder,
        out_dir=out_dir,
        prefix=args.prefix,
        max_dim=int(args.max_dim),
        delete_old_single=bool(args.delete_old_single),
        mode=mode,
    )


if __name__ == "__main__":
    main()
