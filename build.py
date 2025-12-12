import os
import shutil
import glob

def build():
    project_root = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(project_root, 'dist')

    # Clean previous build
    if os.path.exists(dist_dir):
        print(f"Cleaning previous build at {dist_dir}...")
        shutil.rmtree(dist_dir)

    os.makedirs(dist_dir)

    items_to_copy = [
        'index.html',
        'game',
        'assets',
        'game-assets'
    ]

    # Additional root-level files / patterns to include in the final build
    # (favicons, service worker, webmanifest, offline manifest, etc.)
    extra_patterns = [
        'service-worker.js',
        'offline-manifest.json',
        'manifest.webmanifest',
        'manifest.json',
        'favicon.ico',
        'favicon*.png',
        'apple-touch-icon*.png',
        'favicon*.svg'
    ]

    # List of specific large files to exclude that are not used in the game
    unused_large_files = [
        'environment_decimated.glb',
        'environment_with_branches_and_boat.glb',
        'with branches and boat.glb',
        'environment_no_branches_and_boat.glb',
        'environment_with_vegetation_not_decimated.glb',
        'environment_with_vegetation_decimated_better.glb',
        'environment - unzip to use.zip'
    ]

    print("Starting build...")

    for item in items_to_copy:
        src = os.path.join(project_root, item)
        dst = os.path.join(dist_dir, item)

        if not os.path.exists(src):
            print(f"Warning: {item} not found, skipping.")
            continue

        if os.path.isdir(src):
            print(f"Copying directory: {item}")
            
            def ignore_func(directory, files):
                ignored = []
                for f in files:
                    # Ignore common temporary/dev files
                    if f == '__pycache__' or f == '.git' or f == '.DS_Store' or f == 'Thumbs.db':
                        ignored.append(f)
                    # Ignore python and batch files inside the game/assets folders if any exist
                    elif f.endswith('.py') or f.endswith('.bat'):
                        ignored.append(f)
                    # Ignore source files and heavy unused assets
                    elif f.endswith('.psd') or f.endswith('.zip') or f.endswith('.blend') or f.endswith('.blend1') or f.endswith('.ai'):
                        ignored.append(f)
                    # Specific ignore for game/core/bak and other backup folders
                    elif f == 'bak' or f == '_old_data_files' or f == 'originals':
                        ignored.append(f)
                    elif f == 'bak' and os.path.basename(directory) == 'core' and 'game' in directory.split(os.sep):
                        ignored.append(f)
                    # Ignore specific unused large files
                    elif f in unused_large_files:
                        ignored.append(f)
                    
                    # --- NEW EXCLUSIONS ---
                    # Exclude unused folders in game-assets/sub
                    elif f == 'full_q_veg' or f == 'full_q_fish':
                        ignored.append(f)
                    
                    # Exclude unused folders in game-assets/simulador/plants
                    # NOTE: the Simulador scene loads its plant animations from
                    # `game-assets/simulador/plants/sheets` (json + webp). Do NOT exclude `sheets`.
                    elif 'simulador' in directory.split(os.sep) and 'plants' in directory.split(os.sep):
                        if f in ['9-16-images', 'low-poly-images', 'mp4s', 'realistic_images', 'transparent sequences', 'webps']:
                            ignored.append(f)

                    # Exclude unused files in game-assets/sub/others
                    # Only 'surface.webm' is used
                    elif 'sub' in directory.split(os.sep) and 'others' in directory.split(os.sep):
                        if f != 'surface.webm' and not os.path.isdir(os.path.join(directory, f)):
                             ignored.append(f)

                return ignored

            shutil.copytree(src, dst, ignore=ignore_func)
        else:
            print(f"Copying file: {item}")
            shutil.copy2(src, dst)

    print(f"Build complete! Output is in {dist_dir}")

    # Copy extra root files that match patterns so favicons, manifests and SW are included
    for pattern in extra_patterns:
        full_pattern = os.path.join(project_root, pattern)
        matches = glob.glob(full_pattern)
        for m in matches:
            try:
                dest = os.path.join(dist_dir, os.path.basename(m))
                print(f"Copying extra file: {m} -> {dest}")
                shutil.copy2(m, dest)
            except Exception as e:
                print(f"Warning: failed to copy extra file {m}: {e}")

if __name__ == "__main__":
    build()
