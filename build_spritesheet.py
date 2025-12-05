#!/usr/bin/env python3
"""
Make a WebP sprite sheet from a folder of PNG and/or WebP frames.

- Supports .png and .webp inputs
- Preserves transparency (RGBA)
- Arranges frames in a grid
- Optionally forces a target frame size (largest side)
- Automatically downscales if the sheet would exceed max_dim

Usage:
    python build_spritesheet.py /path/to/frames sprite.webp
    python build_spritesheet.py /path/to/frames sprite.webp --cols 8
    python build_spritesheet.py /path/to/frames sprite.webp --max-dim 16000
    python build_spritesheet.py /path/to/frames sprite.webp --frame-size 512
"""

import os
import math
import argparse
import re
import json
from PIL import Image

SUPPORTED_EXTENSIONS = (".webp", ".png")


def natural_key(s):
    """
    Sort key that handles numbers in filenames:
    'frame_2.png' comes before 'frame_10.png'.
    """
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split(r"(\d+)", s)]


def collect_frames(folder):
    files = [
        f for f in os.listdir(folder)
        if f.lower().endswith(SUPPORTED_EXTENSIONS)
    ]
    if not files:
        raise RuntimeError(f"No .webp or .png files found in {folder}")

    files.sort(key=natural_key)
    paths = [os.path.join(folder, f) for f in files]
    return paths


def choose_layout(num_frames, forced_cols=None):
    """
    Decide (cols, rows) layout.
    If forced_cols is given, use that.
    Otherwise, choose a nearly square grid.
    """
    if forced_cols is not None and forced_cols > 0:
        cols = min(forced_cols, num_frames)
    else:
        cols = math.ceil(math.sqrt(num_frames))  # nearly square

    rows = math.ceil(num_frames / cols)
    return cols, rows


def make_sprite_sheet(input_folder, output_path, cols=None, max_dim=16000, target_frame_size=None):
    frame_paths = collect_frames(input_folder)

    # Load frames as RGBA (keep transparency)
    frames = [Image.open(p).convert("RGBA") for p in frame_paths]

    # Assume all frames same size
    frame_w, frame_h = frames[0].size
    num_frames = len(frames)

    cols, rows = choose_layout(num_frames, cols)
    sheet_w_unscaled = frame_w * cols
    sheet_h_unscaled = frame_h * rows

    print(f"Found {num_frames} frames.")
    print(f"Original frame size: {frame_w}x{frame_h}")
    print(f"Initial layout: {cols} cols x {rows} rows")
    print(f"Initial sheet size: {sheet_w_unscaled}x{sheet_h_unscaled}")

    # --- determine scaling factors ---

    # 1) scaling to satisfy max_dim for the sheet
    max_sheet_dim = max(sheet_w_unscaled, sheet_h_unscaled)
    scale_for_max_dim = 1.0
    if max_sheet_dim > max_dim:
        scale_for_max_dim = max_dim / float(max_sheet_dim)
        print(f"Sheet too large for max_dim={max_dim}, "
              f"scale_for_max_dim={scale_for_max_dim:.4f}")

    # 2) scaling to satisfy target frame size (largest side of each frame)
    scale_for_target = 1.0
    if target_frame_size is not None:
        original_max_side = max(frame_w, frame_h)
        scale_for_target = target_frame_size / float(original_max_side)
        print(f"Target frame size (max side)={target_frame_size}, "
              f"scale_for_target={scale_for_target:.4f}")

    # Use the most restrictive scale (smallest)
    scale = min(scale_for_max_dim, scale_for_target)
    print(f"Final scale factor: {scale:.4f}")

    # New frame size after scaling
    new_frame_w = max(1, int(round(frame_w * scale)))
    new_frame_h = max(1, int(round(frame_h * scale)))

    sheet_w = new_frame_w * cols
    sheet_h = new_frame_h * rows

    print(f"Final frame size: {new_frame_w}x{new_frame_h}")
    print(f"Final sheet size: {sheet_w}x{sheet_h}")

    # Transparent background
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    for idx, frame in enumerate(frames):
        if scale != 1.0:
            frame = frame.resize((new_frame_w, new_frame_h), Image.LANCZOS)

        row = idx // cols
        col = idx % cols
        x = col * new_frame_w
        y = row * new_frame_h

        sheet.paste(frame, (x, y), frame)

    if not output_path.lower().endswith(".webp"):
        print("Warning: output file does not end with .webp, "
              "but it will still be saved as WebP format.")

    sheet.save(output_path, "WEBP")
    print(f"Saved WebP sprite sheet to: {output_path}")

    # Save metadata
    meta_path = os.path.splitext(output_path)[0] + ".json"
    meta = {
        "file": os.path.basename(output_path),
        "columns": cols,
        "rows": rows,
        "frameCount": num_frames,
        "frameWidth": new_frame_w,
        "frameHeight": new_frame_h,
        "sheetWidth": sheet_w,
        "sheetHeight": sheet_h
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Saved metadata to: {meta_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Create a WebP sprite sheet from a folder of PNG/WebP frames."
    )
    parser.add_argument("input_folder", help="Folder containing PNG/WebP frames (ordered by filename).")
    parser.add_argument("output", help="Output sprite sheet path (e.g. sprite.webp).")
    parser.add_argument(
        "--cols",
        type=int,
        default=None,
        help="Number of columns in the sprite sheet. "
             "Default: choose a nearly square layout automatically.",
    )
    parser.add_argument(
        "--max-dim",
        type=int,
        default=16000,
        help="Maximum width/height of the generated sprite sheet (default: 16000).",
    )
    parser.add_argument(
        "--frame-size",
        type=int,
        default=None,
        help="Target size (in px) for the LARGEST side of each frame (e.g. 512).",
    )

    args = parser.parse_args()
    make_sprite_sheet(
        args.input_folder,
        args.output,
        cols=args.cols,
        max_dim=args.max_dim,
        target_frame_size=args.frame_size,
    )


if __name__ == "__main__":
    main()
