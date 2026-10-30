#!/bin/sh
# Optional workaround for Bend 2.0.39's 4 GiB per-thread Lean stack request.
# This runs the SAME compiled kernel with a 64 MiB stack; it does not alter
# the proof, checker, or verdict. See docs/bend-notes.md for reproduction.
set -eu
: "${BENDTT_KERNEL:?Set BENDTT_KERNEL to the compiled BendTT executable}"
export LEAN_STACK_SIZE_KB=65536
exec "$BENDTT_KERNEL" "$@"
