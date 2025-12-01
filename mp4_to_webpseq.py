import subprocess
from pathlib import Path

# === Paths (edit if needed) ===
SRC_DIR = Path(r"C:\Users\Nico\Documents\GitHub\delta-grande\game-assets\simulador\plants\mp4s\redo")
DST_DIR = Path(r"C:\Users\Nico\Documents\GitHub\delta-grande\game-assets\simulador\plants\webp_seq\redo")

# === Chroma key settings ===
# 'chromakey' arguments are: chroma_color:similarity:blend
# similarity ~ tolerance (0..1). Start small; raise if near-black should also be transparent.
CHROMA_COLOR = "0x000000"   # black
SIMILARITY   = 0.004         # try 0.01–0.10 as needed
BLEND        = 0.0          # hard key (no feather). Try 0.05–0.1 for a slight edge soften.

# === FFmpeg binary name (leave as 'ffmpeg' if it's on PATH) ===
FFMPEG_BIN = "ffmpeg"

def convert_video_to_webp_frames(src_video: Path, dst_root: Path) -> None:
    base = src_video.stem  # raw basename (no prefixes/suffixes added)
    out_dir = dst_root / base
    out_dir.mkdir(parents=True, exist_ok=True)

    # {basename}_000.webp, {basename}_001.webp, ...
    frame_pattern = str(out_dir / f"{base}_%03d.webp")

    # Build filter: key out black -> keep RGBA
    vf = f"chromakey={CHROMA_COLOR}:{SIMILARITY}:{BLEND},format=rgba"

    # FFmpeg command:
    # -vsync 0: one image per source frame (no dup/drop)
    # -start_number 0: numbering starts at 000
    # libwebp options:
    #   -lossless 1, -q:v 100 for max quality; adjust if you want smaller files
    #   -compression_level 6 is a good default (0..6)
    cmd = [
        FFMPEG_BIN,
        "-hide_banner", "-loglevel", "error",
        "-i", str(src_video),
        "-vf", vf,
        "-vsync", "0",
        "-start_number", "0",
        "-c:v", "libwebp",
        "-lossless", "1",
        "-compression_level", "6",
        "-q:v", "100",
        frame_pattern,
    ]

    print(f"[FFmpeg] {src_video.name} -> {out_dir}")
    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError:
        raise SystemExit("FFmpeg not found. Install it and ensure 'ffmpeg' is on your PATH.")
    except subprocess.CalledProcessError as e:
        raise SystemExit(f"FFmpeg failed on {src_video} (exit {e.returncode}).")

def main():
    if not SRC_DIR.exists():
        raise SystemExit(f"Source folder not found: {SRC_DIR}")
    DST_DIR.mkdir(parents=True, exist_ok=True)

    videos = [p for p in SRC_DIR.iterdir() if p.suffix.lower() == ".mp4"]
    if not videos:
        print(f"No .mp4 files found in {SRC_DIR}")
        return

    for vid in videos:
        convert_video_to_webp_frames(vid, DST_DIR)

    print("Done.")

if __name__ == "__main__":
    main()
