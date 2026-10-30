#!/usr/bin/env bash
# Run the patched source launcher, not the unmodified release executable.
# The actual proof checker remains the pinned, unchanged BendTT kernel.
set -euo pipefail
tools="$HOME/.local/share/bend-experiments"
source_dir=${BEND_SOURCE:-$(cat "$tools/source-path")}
export BENDTT=${BENDTT:-${BENDTT_KERNEL:-$(cat "$tools/kernel-path")}}
export BEND_NO_TELEMETRY=1
exec "${BUN:-bun}" "$source_dir/bend2/main.ts" "$@"
