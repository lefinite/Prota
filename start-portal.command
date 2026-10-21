#!/bin/bash

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

/bin/bash scripts/run.sh

echo ""
echo "按 Enter 键关闭窗口..."
read
