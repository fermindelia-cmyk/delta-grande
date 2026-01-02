import os
import shutil
import subprocess
import build


def copy_portable_runtimes(src_dir, dst_dir):
    if not os.path.exists(src_dir):
        print("Portable runtimes not found (optional). Place them in ./portable to include in dist.")
        return
    try:
        print(f"Copying portable runtimes from {src_dir} -> {dst_dir}...")
        shutil.copytree(src_dir, dst_dir)
    except Exception as e:
        print(f"Warning: failed to copy portable runtimes: {e}")


def include_launchers(project_root, dist_dir):
    for launcher in ['usb-launcher.bat', 'usb-server.cjs']:
        src = os.path.join(project_root, launcher)
        dst = os.path.join(dist_dir, launcher)
        if os.path.exists(src):
            print(f"Including launcher: {launcher}")
            shutil.copy2(src, dst)
        else:
            print(f"Warning: {launcher} missing in project root; skipping.")


def make_quick_launch(dist_dir):
    quick_launch_bat = os.path.join(dist_dir, 'Delta Grande Launch.bat')
    with open(quick_launch_bat, 'w', encoding='utf-8') as f:
        f.write("""@echo off
setlocal
pushd %~dp0
call usb-launcher.bat
popd
endlocal
""")
    print(f"Created quick launcher: {quick_launch_bat}")
    return quick_launch_bat


def make_shortcut(dist_dir, quick_launch_bat):
    favicon_path = os.path.join(dist_dir, 'favicon.ico')
    shortcut_path = os.path.join(dist_dir, 'Delta Grande.lnk')
    if os.name == 'nt' and os.path.exists(favicon_path):
        ps_script = (
            '$shell = New-Object -ComObject WScript.Shell;'
            f'$shortcut = $shell.CreateShortcut("{shortcut_path}");'
            f'$shortcut.TargetPath = "{quick_launch_bat}";'
            f'$shortcut.WorkingDirectory = "{dist_dir}";'
            f'$shortcut.IconLocation = "{favicon_path},0";'
            '$shortcut.Save();'
        )
        try:
            subprocess.run(['powershell', '-NoProfile', '-Command', ps_script], check=True, capture_output=True)
            print(f"Created Windows shortcut with icon: {shortcut_path}")
        except Exception as e:
            print(f"Warning: could not create Windows shortcut: {e}")
    else:
        print("Skipping Windows shortcut creation (non-Windows or missing favicon).")


def build_windows():
    project_root = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(project_root, 'dist')
    app_dir = os.path.join(dist_dir, 'app')
    portable_src_dir = os.path.join(project_root, 'portable')
    portable_dst_dir = os.path.join(dist_dir, 'portable')

    # Run the base build first
    build.build()

    # Recreate app/ bundle inside dist
    if os.path.exists(app_dir):
        shutil.rmtree(app_dir)
    print(f"Creating portable app bundle at {app_dir}...")
    shutil.copytree(dist_dir, app_dir)

    # Copy portable runtimes if present
    copy_portable_runtimes(portable_src_dir, portable_dst_dir)

    # Copy launchers
    include_launchers(project_root, dist_dir)

    # Quick launcher + shortcut
    quick_launch = make_quick_launch(dist_dir)
    make_shortcut(dist_dir, quick_launch)

    print("Windows portable build complete. Output in dist/ with app/ and launchers.")


if __name__ == '__main__':
    build_windows()
