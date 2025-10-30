import os
import json
from pathlib import Path
from PIL import Image

# --- Configuration ---

# 1. Set the path to your folder full of animation folders
#    (The user provided this path)
INPUT_ROOT = Path(r"D:\GitHub\delta-grande\game-assets\simulador\plants\webp_seq")

# 2. Set the path where you want to save the new spritesheets and metadata
#    (The user provided this path)
OUTPUT_ROOT = Path(r"D:\GitHub\delta-grande\game-assets\simulador\plants\sheets")

# 3. Set the name for the metadata file
METADATA_FILENAME = "spritesheet_meta.json"

# --- End of Configuration ---

def create_spritesheets():
    """
    Processes all animation subfolders in INPUT_ROOT, creates horizontal
    spritesheets for each, and saves them to OUTPUT_ROOT along with a
    single JSON metadata file.
    """
    if not INPUT_ROOT.exists():
        print(f"Error: Input directory not found at {INPUT_ROOT}")
        return

    # Ensure the output directory exists
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    
    all_metadata = {}
    processed_count = 0

    print(f"Starting spritesheet generation...")
    print(f"Input path: {INPUT_ROOT}")
    print(f"Output path: {OUTPUT_ROOT}\n")

    # Iterate over each subfolder in the input directory (e.g., "acacia-stage-0")
    for anim_folder in INPUT_ROOT.iterdir():
        if not anim_folder.is_dir():
            continue

        anim_name = anim_folder.name
        print(f"Processing animation: {anim_name}")

        # Find all .webp frames and sort them numerically/alphabetically
        # This relies on your naming convention (e.g., _000.webp, _001.webp)
        frames = sorted(anim_folder.glob("*.webp"))

        if not frames:
            print(f"  ... No .webp frames found. Skipping.")
            continue
            
        frame_count = len(frames)
        
        # --- Create the spritesheet ---
        
        # 1. Open the first frame to get dimensions
        with Image.open(frames[0]) as first_frame:
            # Ensure it's in RGBA mode to handle transparency
            first_frame = first_frame.convert("RGBA")
            frame_width, frame_height = first_frame.size

        if frame_width == 0 or frame_height == 0:
            print(f"  ... Invalid frame dimensions ({frame_width}x{frame_height}). Skipping.")
            continue

        # 2. Create a new, blank spritesheet (horizontal layout)
        sheet_width = frame_width * frame_count
        sheet_height = frame_height
        spritesheet = Image.new("RGBA", (sheet_width, sheet_height), (0, 0, 0, 0))

        # 3. Paste each frame into the spritesheet
        for i, frame_path in enumerate(frames):
            with Image.open(frame_path) as frame_img:
                frame_img = frame_img.convert("RGBA")
                x_offset = i * frame_width
                spritesheet.paste(frame_img, (x_offset, 0))
        
        # 4. Save the new spritesheet as a high-quality, lossless WEBP
        output_image_name = f"{anim_name}.webp"
        output_image_path = OUTPUT_ROOT / output_image_name
        
        try:
            spritesheet.save(
                output_image_path, 
                "WEBP", 
                lossless=True, 
                quality=100,
                method=6 # Use the slowest, highest-compression method
            )
            print(f"  ... Saved sheet with {frame_count} frames to {output_image_path}")
            processed_count += 1
        except Exception as e:
            print(f"  ... FAILED to save spritesheet: {e}")
            continue

        # 5. Store metadata for this spritesheet
        all_metadata[anim_name] = {
            "file": output_image_name,  # Relative path for the game to use
            "frameCount": frame_count,
            "frameWidth": frame_width,
            "frameHeight": frame_height,
            "layout": "horizontal"
        }

    # --- Save the final metadata file ---
    if not all_metadata:
        print("\nNo animations were processed.")
        return

    metadata_path = OUTPUT_ROOT / METADATA_FILENAME
    try:
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(all_metadata, f, indent=4)
        print(f"\n--- Success! ---")
        print(f"Processed {processed_count} animations.")
        print(f"Master metadata file saved to: {metadata_path}")
    except Exception as e:
        print(f"\n--- Error ---")
        print(f"Processed {processed_count} animations, but FAILED to save metadata: {e}")


if __name__ == "__main__":
    # Ensure you have Pillow installed: pip install pillow
    create_spritesheets()