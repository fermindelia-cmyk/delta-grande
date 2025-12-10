#!/usr/bin/env python3
import os
import sys
from build_spritesheet import make_sprite_sheet

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Plants
    plants_seq_dir = os.path.join(base_dir, "game-assets", "simulador", "plants", "webp_seq")
    plants_sheets_dir = os.path.join(base_dir, "game-assets", "simulador", "plants", "sheets")
    
    if not os.path.exists(plants_sheets_dir):
        os.makedirs(plants_sheets_dir)
        
    if os.path.exists(plants_seq_dir):
        for item in os.listdir(plants_seq_dir):
            item_path = os.path.join(plants_seq_dir, item)
            if os.path.isdir(item_path):
                output_path = os.path.join(plants_sheets_dir, f"{item}.webp")
                print(f"Building plant sheet: {item} -> {output_path}")
                try:
                    make_sprite_sheet(item_path, output_path, target_frame_size=512)
                except Exception as e:
                    print(f"Error building {item}: {e}")

    # 2. Weather Top
    weather_top_dir = os.path.join(base_dir, "game-assets", "simulador", "UI", "weather_top")
    weather_top_output = os.path.join(weather_top_dir, "weather_top.webp")
    if os.path.exists(weather_top_dir):
        print(f"Building weather top sheet: {weather_top_dir} -> {weather_top_output}")
        try:
            make_sprite_sheet(weather_top_dir, weather_top_output, target_frame_size=512)
        except Exception as e:
            print(f"Error building weather top: {e}")

    # 3. Weather Bottom
    weather_bottom_dir = os.path.join(base_dir, "game-assets", "simulador", "UI", "weather_bottom")
    weather_bottom_output = os.path.join(weather_bottom_dir, "weather_bottom.webp")
    if os.path.exists(weather_bottom_dir):
        print(f"Building weather bottom sheet: {weather_bottom_dir} -> {weather_bottom_output}")
        try:
            make_sprite_sheet(weather_bottom_dir, weather_bottom_output, target_frame_size=512)
        except Exception as e:
            print(f"Error building weather bottom: {e}")

if __name__ == "__main__":
    main()
