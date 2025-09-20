#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from pathlib import Path
from shutil import which
from concurrent.futures import ThreadPoolExecutor, as_completed

from rich.console import Console
from rich.table import Table
from tqdm import tqdm

console = Console()

def run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return p.returncode, p.stdout, p.stderr

def optimize_one(
    src: Path,
    out_dir: Path,
    simplify_ratio: float,
    aggressive: bool,
    texture_quality: int,
    texture_scale: float,
    power_of_two: bool,
    merge_meshes: bool,
    keep_names: bool,
    verbose: bool,
):
    out_dir.mkdir(parents=True, exist_ok=True)
    dst = out_dir / (src.stem + "_OPT.glb")
    report = out_dir / (src.stem + "_OPT.report.json")

    cmd = [
        "gltfpack",
        "-i", str(src),
        "-o", str(dst),
        # Simplification
        "-si", str(simplify_ratio),
        # Textures -> KTX2 BasisU
        "-tc",
        "-tq", str(texture_quality),
        "-ts", str(texture_scale),
        # Scene/mesh options
    ]

    if aggressive:
        cmd.append("-sa")  # simplify aggressively
    if power_of_two:
        cmd.append("-tp")  # force power-of-two textures (helps old/mobile GPUs)
    if merge_meshes:
        cmd.append("-mm")  # merge identical meshes to reduce draw calls
    if keep_names:
        cmd.extend(["-kn", "-km"])  # keep named nodes/materials (avoid merges that break references)

    # Produce compressed output variant (better JSON/GLB compression)
    cmd.append("-cc")

    # Write a per-file JSON report (size/mesh/material stats)
    cmd.extend(["-r", str(report)])

    if verbose:
        cmd.append("-v")

    code, out, err = run(cmd)
    size_in = src.stat().st_size
    size_out = dst.stat().st_size if dst.exists() else 0

    return {
        "file": src.name,
        "input_bytes": size_in,
        "output_bytes": size_out,
        "ratio": (size_out / size_in) if size_in else 0,
        "exit_code": code,
        "stdout": out.strip(),
        "stderr": err.strip(),
        "output": str(dst),
        "report": str(report),
    }

def main():
    ap = argparse.ArgumentParser(description="Batch optimize & simplify all .glb in a directory using gltfpack.")
    ap.add_argument("root", nargs="?", default=".", help="Root directory to scan (recursively) for .glb")
    ap.add_argument("--out-dir", default=None, help="Write optimized files here (mirrors structure). Default: alongside sources.")
    ap.add_argument("--ratio", type=float, default=0.35, help="Simplify ratio [0..1], e.g., 0.35 keeps ~35%% of triangles (default: 0.35).")
    ap.add_argument("--aggressive", action="store_true", help="Use aggressive simplification (-sa).")
    ap.add_argument("--tq", type=int, default=8, help="Texture quality 1..10 (BasisU), default: 8.")
    ap.add_argument("--ts", type=float, default=1.0, help="Texture size scale factor (0..1). E.g., 0.5 halves width/height. Default: 1.0")
    ap.add_argument("--pot", action="store_true", help="Resize textures to nearest power-of-two (-tp).")
    ap.add_argument("--merge", action="store_true", help="Merge identical meshes (-mm) to reduce draw calls.")
    ap.add_argument("--keep-names", action="store_true", help="Keep named nodes/materials (-kn -km).")
    ap.add_argument("--workers", type=int, default= max(1, (len(list(Path('.').glob('*')))) and 4), help="Parallel workers (default: 4).")
    ap.add_argument("-v", "--verbose", action="store_true", help="Verbose gltfpack output.")
    args = ap.parse_args()

    if which("gltfpack") is None:
        console.print("[red]gltfpack not found in PATH. Install it first (brew/apt/windows release) and try again.[/red]")
        sys.exit(1)

    root = Path(args.root).resolve()
    if not root.exists():
        console.print(f"[red]Root path not found: {root}[/red]")
        sys.exit(1)

    # discover .glb files
    glbs = [p for p in root.rglob("*.glb") if p.is_file()]
    if not glbs:
        console.print("[yellow]No .glb files found.[/yellow]")
        sys.exit(0)

    # determine output dirs
    results = []
    console.print(f"[cyan]Found {len(glbs)} GLB files. Starting optimization…[/cyan]")

    def outdir_for(p: Path) -> Path:
        if args.out_dir:
            # mirror relative structure
            rel = p.parent.relative_to(root)
            return Path(args.out_dir).resolve() / rel
        else:
            return p.parent

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = []
        for src in glbs:
            futures.append(
                ex.submit(
                    optimize_one,
                    src,
                    outdir_for(src),
                    args.ratio,
                    args.aggressive,
                    args.tq,
                    args.ts,
                    args.pot,
                    args.merge,
                    args.keep_names,
                    args.verbose,
                )
            )

        for f in tqdm(as_completed(futures), total=len(futures), desc="Optimizing"):
            results.append(f.result())

    # print a little table
    table = Table(title="gltfpack batch results")
    table.add_column("File")
    table.add_column("Input MB", justify="right")
    table.add_column("Output MB", justify="right")
    table.add_column("Shrink", justify="right")
    table.add_column("Exit")
    for r in sorted(results, key=lambda x: x["ratio"] or 1.0):
        inp = r["input_bytes"] / (1024 * 1024)
        outp = r["output_bytes"] / (1024 * 1024) if r["output_bytes"] else 0.0
        shrink = f"{(1 - (r['ratio'] or 0))*100:.1f}%" if r["input_bytes"] and r["output_bytes"] else "—"
        table.add_row(r["file"], f"{inp:.2f}", f"{outp:.2f}", shrink, str(r["exit_code"]))
    console.print(table)

    # dump a machine-readable summary
    summary_path = Path(args.out_dir or root).resolve() / "gltfpack_batch_summary.json"
    with open(summary_path, "w") as f:
        json.dump(results, f, indent=2)
    console.print(f"[green]Saved summary:[/green] {summary_path}")

if __name__ == "__main__":
    main()
