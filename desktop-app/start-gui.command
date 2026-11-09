#!/usr/bin/env bash
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
NODE_CMD="$(which node 2>/dev/null || echo 'node')"
"$NODE_CMD" cli.js gui
