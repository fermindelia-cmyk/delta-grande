#!/usr/bin/env python3
"""
Generate offline-manifest.json for service worker caching.
Includes all assets needed for offline functionality.
"""

import os
import json
from pathlib import Path
from urllib.parse import quote

# Extensions to include in the offline manifest
ASSET_EXTENSIONS = {
    '.webm', '.webp', '.ogg', '.mp3', '.png', '.jpg', '.jpeg',
    '.js', '.css', '.html', '.glb', '.ply', '.json'
}

# Directories to exclude
EXCLUDE_DIRS = {
    'node_modules', '.git', '__pycache__', 'dist', 
    '.antigravity', 'tools', 'bak', '_backup'
}

# Patterns to exclude from paths
EXCLUDE_PATTERNS = ['_old', '/dist/', '/.git/', '/node_modules/']

def should_exclude(path_str):
    """Check if a path should be excluded."""
    for pattern in EXCLUDE_PATTERNS:
        if pattern in path_str:
            return True
    return False

def collect_assets(root_dir):
    """Collect all asset files recursively."""
    assets = []
    root_path = Path(root_dir)
    
    for file_path in root_path.rglob('*'):
        # Skip directories
        if file_path.is_dir():
            continue
        
        # Skip excluded directories
        if any(excluded in file_path.parts for excluded in EXCLUDE_DIRS):
            continue
        
        # Check if file has a relevant extension
        if file_path.suffix.lower() in ASSET_EXTENSIONS:
            # Get relative path from root
            rel_path = file_path.relative_to(root_path)
            url_path = '/' + str(rel_path).replace('\\', '/')
            
            # Skip excluded patterns
            if should_exclude(url_path):
                continue
            
            # URL encode special characters (spaces, etc.)
            parts = url_path.split('/')
            encoded_parts = [quote(part, safe='') for part in parts]
            encoded_url = '/'.join(encoded_parts)
            
            assets.append(encoded_url)
    
    return sorted(set(assets))

def generate_manifest(root_dir, output_file):
    """Generate the offline manifest JSON file."""
    
    # Core files that must be included
    core_files = [
        '/',
        '/index.html',
        '/game/index.html',
        '/game/',
        '/game/main.js',
        '/game/styles/sub/deck-style.css',
    ]
    
    # Collect all assets
    print("Collecting assets...")
    assets = collect_assets(root_dir)
    
    # Combine core files with assets
    all_files = core_files + assets
    
    # Remove duplicates and sort
    all_files = sorted(set(all_files))
    
    # Filter out excluded patterns one more time
    all_files = [f for f in all_files if not should_exclude(f)]
    
    # Write to JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_files, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Generated {output_file}")
    print(f"✓ Total files: {len(all_files)}")
    
    # Print summary by extension
    extensions = {}
    for file in all_files:
        ext = Path(file).suffix.lower() or 'no-ext'
        extensions[ext] = extensions.get(ext, 0) + 1
    
    print("\nFiles by type:")
    for ext, count in sorted(extensions.items()):
        print(f"  {ext}: {count}")

if __name__ == '__main__':
    root_dir = Path(__file__).parent
    output_file = root_dir / 'offline-manifest.json'
    generate_manifest(root_dir, output_file)
