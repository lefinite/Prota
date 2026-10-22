#!/bin/bash
# Compatibility entry: the Finder app runs services without a terminal window.
PRODUCT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec /usr/bin/open "$PRODUCT_DIR/Prota.app"
