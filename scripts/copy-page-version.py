#!/usr/bin/env python3
"""The CLI and Portal iteration share the same document-only canvas copier."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.canvas_runtime_package import copy_version
copy_version(sys.argv[1], sys.argv[2])
