#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
SVG_PATH="$BUILD_DIR/icon.svg"
MASTER_PNG_PATH="$BUILD_DIR/icon-master.png"
PNG_PATH="$BUILD_DIR/icon.png"

mkdir -p "$BUILD_DIR"

if [[ -f "$MASTER_PNG_PATH" ]]; then
  cp "$MASTER_PNG_PATH" "$PNG_PATH"
else
  qlmanage -t -s 1024 -o "$BUILD_DIR" "$SVG_PATH" >/dev/null 2>&1
  mv "$BUILD_DIR/icon.svg.png" "$PNG_PATH"
fi

python3 - <<PY
from PIL import Image
img = Image.open("$PNG_PATH").convert("RGBA")
img.save("$BUILD_DIR/icon.icns")
PY
