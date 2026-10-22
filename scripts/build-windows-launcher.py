#!/usr/bin/env python3
"""Maintainer-only: reproducibly build the Windows GUI entry and embed the existing logo.

Requires Go and Pillow. rsrc is a build tool only; no user-side Go installation.
"""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
image = Image.open(ROOT / 'portal/assets/prota/app-icon.png')
image.save(ROOT / 'portal/assets/prota/app-icon.ico', sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
with tempfile.TemporaryDirectory(prefix='prota-windows-build-') as folder:
    stage = Path(folder)
    shutil.copy2(ROOT / 'tools/windows-launcher/main.go', stage / 'main.go')
    (stage / 'go.mod').write_text('module prota.local/launcher\n\ngo 1.22\n')
    subprocess.run(['go', 'run', 'github.com/akavel/rsrc@v0.10.2', '-arch', 'amd64', '-ico', str(ROOT / 'portal/assets/prota/app-icon.ico'), '-o', str(stage / 'resource.syso')], cwd=stage, check=True)
    subprocess.run(['go', 'build', '-trimpath', '-buildvcs=false', '-ldflags=-H=windowsgui -s -w -buildid=', '-o', str(ROOT / 'Prota.exe'), '.'],
                   cwd=stage, env={**os.environ, 'GOOS': 'windows', 'GOARCH': 'amd64', 'CGO_ENABLED': '0'}, check=True)
