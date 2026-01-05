#!/usr/bin/env python3
"""
Script para convertir videos WebM con canal alpha a formato HEVC (H.265) con alpha
compatible con Safari/Apple.

Requisitos:
- ffmpeg instalado con soporte para libx265

Uso:
python convert_webm_to_hevc.py [--dry-run] [--force]
"""

import os
import subprocess
import sys
import json
from pathlib import Path

# Directorios base del proyecto
BASE_DIR = Path(__file__).parent
ASSETS_DIR = BASE_DIR / 'assets'
GAME_ASSETS_DIR = BASE_DIR / 'game-assets'

# Lista de videos WebM con alpha que necesitan conversión
# Format: (webm_path, has_alpha, priority)
VIDEOS_TO_CONVERT = [
    # Landing page
    ('assets/birds.webm', True, 'high'),
    ('assets/logo_naranja_alpha.webm', True, 'high'),
    ('assets/mapa_gigante.webm', True, 'medium'),
    ('assets/D+_loader04.webm', True, 'high'),
    
    # Game assets - Menu/Lab
    ('game-assets/menu/loader_yellow.webm', True, 'high'),
    ('game-assets/menu/logo_naranja_alpha.webm', True, 'high'),
    
    # Laboratorio
    ('game-assets/laboratorio/screen-recorrido.webm', True, 'medium'),
    ('game-assets/laboratorio/screen-subacua.webm', True, 'medium'),
    
    # Recorrido - Interface
    ('game-assets/recorrido/interfaz/loading-text-box-animation.webm', True, 'high'),
    ('game-assets/recorrido/interfaz/logo_naranja_alpha.webm', True, 'high'),
    
    # Recorrido - Panels
    ('game-assets/recorrido/paneles/panel metadata.webm', True, 'medium'),
    
    # Sub/Others
    ('game-assets/sub/others/surface.webm', True, 'medium'),
]

# Encontrar todos los videos _glitch.webm y _data.webm en recorrido
def find_species_videos():
    """Encuentra todos los videos de especies en recorrido y sub"""
    species_videos = []
    
    # Recorrido criaturas
    recorrido_path = GAME_ASSETS_DIR / 'recorrido' / 'criaturas'
    if recorrido_path.exists():
        for species_dir in recorrido_path.iterdir():
            if species_dir.is_dir():
                for webm_file in species_dir.glob('*.webm'):
                    rel_path = webm_file.relative_to(BASE_DIR)
                    species_videos.append((str(rel_path), True, 'high'))
    
    # Sub data videos
    sub_data_path = GAME_ASSETS_DIR / 'sub' / 'data_videos'
    if sub_data_path.exists():
        for webm_file in sub_data_path.glob('*_data.webm'):
            rel_path = webm_file.relative_to(BASE_DIR)
            species_videos.append((str(rel_path), True, 'high'))
    
    # Transiciones
    trans_path = GAME_ASSETS_DIR / 'transiciones'
    if trans_path.exists():
        for webm_file in trans_path.glob('*.webm'):
            rel_path = webm_file.relative_to(BASE_DIR)
            species_videos.append((str(rel_path), True, 'medium'))
    
    # Cinematicas
    for cinematicas_path in GAME_ASSETS_DIR.rglob('cinematicas'):
        for webm_file in cinematicas_path.glob('*.webm'):
            rel_path = webm_file.relative_to(BASE_DIR)
            species_videos.append((str(rel_path), True, 'medium'))
    
    return species_videos


def check_ffmpeg():
    """Verifica que ffmpeg esté instalado y tenga soporte para libx265"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], 
                              capture_output=True, 
                              text=True, 
                              check=True)
        if 'libx265' not in result.stdout:
            print("⚠️  WARNING: ffmpeg no tiene soporte para libx265 (HEVC)")
            print("    Instala ffmpeg con: winget install FFmpeg")
            return False
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ ERROR: ffmpeg no está instalado")
        print("   Instala ffmpeg con: winget install FFmpeg")
        return False


def check_video_has_alpha(video_path):
    """Verifica si un video tiene canal alpha usando ffprobe"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=pix_fmt',
            '-of', 'json',
            str(video_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        pix_fmt = data['streams'][0]['pix_fmt']
        # Formatos con alpha: yuva420p, yuva444p, etc.
        return 'yuva' in pix_fmt or 'rgba' in pix_fmt
    except:
        return True  # Asumir que tiene alpha si no podemos verificar


def convert_webm_to_hevc(input_path, output_path, quality='medium'):
    """
    Convierte un video WebM con alpha a formato compatible con Safari
    Usa ProRes 4444 que soporta alpha y es nativo en Safari/Apple
    
    Args:
        input_path: Ruta al archivo WebM de entrada
        output_path: Ruta al archivo MOV de salida
        quality: 'high', 'medium', o 'low' (afecta profile: 4444XQ, 4444, 4444 Lt)
    """
    # ProRes profiles con alpha
    # 4444 XQ = máxima calidad (muy grande)
    # 4444 = excelente calidad (grande)
    # 4444 Lt = buena calidad (mediano)
    profile_map = {
        'high': '4',      # ProRes 4444 XQ
        'medium': '4',    # ProRes 4444
        'low': '4'        # ProRes 4444 (mismo que medium, ProRes no tiene 4444 Lt oficial)
    }
    profile = profile_map.get(quality, '4')
    
    # Comando ffmpeg para convertir WebM con alpha a ProRes 4444 con alpha
    cmd = [
        'ffmpeg',
        '-i', str(input_path),
        '-c:v', 'prores_ks',  # ProRes encoder (Kostya's)
        '-profile:v', profile,  # ProRes 4444
        '-pix_fmt', 'yuva444p10le',  # Formato con alpha 10-bit
        '-c:a', 'aac',  # Audio AAC
        '-b:a', '128k',  # Bitrate audio
        '-movflags', '+faststart',  # Optimización para streaming
        '-y',  # Sobrescribir sin preguntar
        str(output_path)
    ]
    
    print(f"  🔄 Convirtiendo: {input_path.name}")
    print(f"     CRF={crf} ({quality})")
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        
        # Mostrar tamaños
        input_size = input_path.stat().st_size / (1024 * 1024)
        output_size = output_path.stat().st_size / (1024 * 1024)
        ratio = (output_size / input_size) * 100 if input_size > 0 else 0
        
        print(f"  ✅ Completado: {output_path.name}")
        print(f"     {input_size:.2f} MB → {output_size:.2f} MB ({ratio:.1f}%)")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"  ❌ Error: {e}")
        if output_path.exists():
            output_path.unlink()
        return False


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Convierte videos WebM con alpha a HEVC para Safari')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Muestra qué se haría sin convertir')
    parser.add_argument('--force', action='store_true',
                       help='Reconvierte incluso si ya existe el archivo .mov')
    parser.add_argument('--quality', choices=['high', 'medium', 'low'], 
                       default='medium',
                       help='Calidad de conversión (default: medium)')
    
    args = parser.parse_args()
    
    print("🎬 Conversor de Videos WebM a HEVC para Safari\n")
    
    # Verificar ffmpeg
    if not args.dry_run and not check_ffmpeg():
        sys.exit(1)
    
    # Recopilar todos los videos
    all_videos = VIDEOS_TO_CONVERT + find_species_videos()
    
    # Remover duplicados
    seen = set()
    unique_videos = []
    for video_path, has_alpha, priority in all_videos:
        if video_path not in seen:
            seen.add(video_path)
            unique_videos.append((video_path, has_alpha, priority))
    
    print(f"📋 Encontrados {len(unique_videos)} videos para procesar\n")
    
    # Procesar cada video
    converted = 0
    skipped = 0
    failed = 0
    
    for video_path, has_alpha, priority in unique_videos:
        input_path = BASE_DIR / video_path
        
        if not input_path.exists():
            print(f"⚠️  No encontrado: {video_path}")
            skipped += 1
            continue
        
        # Generar ruta de salida (.webm → .mov)
        output_path = input_path.with_suffix('.mov')
        
        # Skip si ya existe y no es --force
        if output_path.exists() and not args.force:
            print(f"⏭️  Ya existe: {output_path.name}")
            skipped += 1
            continue
        
        if args.dry_run:
            print(f"🔍 [DRY RUN] Convertiría: {video_path}")
            print(f"   → {output_path.relative_to(BASE_DIR)}")
            continue
        
        # Verificar si tiene alpha
        if has_alpha and not check_video_has_alpha(input_path):
            print(f"ℹ️  Sin alpha: {video_path} (omitido)")
            skipped += 1
            continue
        
        # Convertir
        quality = 'high' if priority == 'high' else args.quality
        if convert_webm_to_hevc(input_path, output_path, quality):
            converted += 1
        else:
            failed += 1
        
        print()  # Línea en blanco entre conversiones
    
    # Resumen
    print("=" * 60)
    if args.dry_run:
        print(f"✨ DRY RUN completado")
        print(f"   {len(unique_videos)} videos serían procesados")
    else:
        print(f"✨ Conversión completada")
        print(f"   ✅ Convertidos: {converted}")
        print(f"   ⏭️  Omitidos: {skipped}")
        if failed > 0:
            print(f"   ❌ Fallidos: {failed}")


if __name__ == '__main__':
    main()
