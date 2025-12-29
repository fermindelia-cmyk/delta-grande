#!/usr/bin/env python3
"""Rebuild the completed-species overlay atlases as multi-atlas pages (<=2048×2048).

This processes these folders:
- game-assets/sub/interfaz/completed-species-info
- game-assets/sub/interfaz/completed-species-name
- game-assets/sub/interfaz/completed-species-image

Usage:
  python build_completed_overlay_atlases.py

Requires:
  pip install pillow
"""

from pathlib import Path

from build_multi_atlas import build_multi_atlas


def main():
    root = Path(__file__).resolve().parent
    base = root / "game-assets" / "sub" / "interfaz"

    targets = [
        base / "completed-species-info",
        base / "completed-species-name",
        base / "completed-species-image",
    ]

    for folder in targets:
        print(f"[multi-atlas] Building: {folder}")
        build_multi_atlas(
            input_folder=folder,
            out_dir=folder,
            prefix="sheet",
            max_dim=2048,
            delete_old_single=False,
            mode="from_sheet",
        )

    print("Done.")


if __name__ == "__main__":
    main()
