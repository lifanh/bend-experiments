# Bend 2.0.39 kernel stack fix

The unmodified Bend 2.0.39 release reproduces the reported failure in this
Linux x64 orb. With the **same compiled BendTT kernel and emitted proof**:

| `LEAN_STACK_SIZE_KB` | Direct kernel result |
| --- | --- |
| `4194304` (4 GiB) | SIGABRT, `failed to create thread: Resource temporarily unavailable` |
| `65536` (64 MiB) | Exit 0, `ALL PROOFS CHECK` |

The full `--verdict` command fails with exit 1 and
`Error: BendTT infrastructure: kernel terminated by SIGABRT`. Setting
`LEAN_NUM_THREADS=1` does not fix it. Setting `LEAN_STACK_SIZE_KB=65536` on
the stock Bend command does not fix it either: `kernel_check` overwrites it.
A six-line Boolean reflexivity proof reproduces the same failure, so it does
not depend on the original automaton proof's complexity.

## Scope and tradeoff

This repository is `lifanh/bend-experiments`, not the upstream compiler.
[The patch](../patches/bend-2.0.39-kernel-stack.patch) targets upstream
[`v2.0.39`](https://github.com/bendlang/bend/tree/v2.0.39), commit
[`a3efe8a`](https://github.com/bendlang/bend/commit/a3efe8a3801f423827424227172eed9802c5e6cb).
It changes the kernel launcher's
default to 64 MiB and honors a nonempty `LEAN_STACK_SIZE_KB`. Unset or empty
uses the default; other values are passed through to Lean, not validated by
Bend. This applies to the cached kernel and a caller-selected `$BENDTT`.

Deep proofs may need a larger stack. For example, with the patched launcher,
`LEAN_STACK_SIZE_KB=131072` requests 128 MiB. A request that cannot fit still
fails as an infrastructure error: there is no automatic retry, skipped
kernel check, or fallback to the weaker checker. The patch changes neither
the proof elaboration nor the Lean kernel. It includes upstream guide text.

Orb setup applies the patch to a separate source checkout pinned to the exact
commit above. `npm run verdict` invokes that checkout through
`scripts/bend-verdict.sh` using Bun, while ordinary builds continue to use the
unmodified release executable. Merely editing TypeScript beside a compiled
release would not change its behavior. No upstream issue or pull request has
been filed.

The source checkout is cached by patch digest under
`~/.local/share/bend-experiments`; `source-path` and `kernel-path` record the
actual locations. The kernel's source is compared byte-for-byte against the
release copy during setup. The launcher uses that unchanged kernel by default
and honors a caller-selected `BENDTT`. It never changes `LEAN_STACK_SIZE_KB`:
the patched upstream source applies the default and preserves overrides.

After `.agents/setup`, a new repository login shell exports `BEND_SOURCE`,
`BENDTT_KERNEL` and `BEND_VERDICT`. The normal proof command also discovers the
installed launcher without needing to restart a currently open shell:

```sh
npm run verdict
LEAN_STACK_SIZE_KB=98304 npm run verdict
npm run test:kernel-stack
```

The stack regression command needs the exported source/kernel paths; use a
new login shell after setup. `scripts/kernel-limited.sh` remains an optional
legacy workaround for the stock executable, but is **not** part of the default
proof workflow and does not offer configurable launcher behavior.

Integration checks in the experiments orb passed: all five resource-limit
checks; normal `npm run verdict` with no override and with 96 MiB; and the
normal npm workflow with a caller-selected, 3-GiB-limited real kernel. That
workflow rejects an explicit 4-GiB stack as an infrastructure error instead
of ignoring it or retrying. Stock and patched launchers emit byte-identical
automaton proof input (SHA-256 listed below). The setup run installing the
source fix took 10.45 seconds with toolchains already cached; its warm repeat
took 3.64 seconds. Fresh login and supervised-service environments both select
the patched proof launcher, without the legacy `BENDTT` wrapper.

## Reproduce the regression check

Prerequisites: Linux, Node.js 22+, Bun, Git, and Lean **4.34.0** (`lean` and
`leanc` on `PATH`). No npm packages are needed. The check uses a real kernel,
not a replacement that prints a successful verdict.

From this repository's root, prepare a disposable upstream source checkout
and compile its unchanged kernel:

```sh
work="$(mktemp -d)"
git clone --depth 1 --branch v2.0.39 https://github.com/bendlang/bend.git "$work/bend"
export BEND_SOURCE="$work/bend"
export BENDTT_KERNEL="$work/bendtt"
lean --root="$BEND_SOURCE/bend2" -c "$work/bendtt.c" "$BEND_SOURCE/bend2/bendtt.lean"
leanc -O3 -DNDEBUG "$work/bendtt.c" -o "$BENDTT_KERNEL"
```

Run the check before applying the patch; expect **2 passes and 3 failures**:

```sh
node --test scripts/check-kernel-stack.mjs
```

Then apply the patch and repeat exactly the same check; expect **5 passes,
0 failures, 0 skips**:

```sh
git -C "$BEND_SOURCE" apply --check "$PWD/patches/bend-2.0.39-kernel-stack.patch"
git -C "$BEND_SOURCE" apply "$PWD/patches/bend-2.0.39-kernel-stack.patch"
node --test scripts/check-kernel-stack.mjs
```

The check caps only the kernel's virtual address space at **3 GiB**, leaving
the Bun launcher unrestricted. A 1 GiB cap also blocked Lean startup with
the smaller stack in this orb, so it did not isolate the reported bug.
The test fixes `LEAN_NUM_THREADS=1` to avoid a host-dependent worker count,
removes `LEAN_MAIN_USE_THREAD` so the stack thread cannot be bypassed, and
does not overwrite the launcher's stack request. It checks:

- The direct kernel fails at 4 GiB and accepts the same input at 64 MiB.
- `--verdict` succeeds with an unset or empty stack setting.
- A 96 MiB caller override succeeds; a 4 GiB override still fails, detecting
  a launcher that ignores overrides or silently retries with a smaller stack.
- The real kernel at 64 MiB rejects a false equality, rather than merely
  starting successfully.

Missing prerequisites fail the check, rather than silently skipping it.
Temporary fixtures are removed after the run. `BUN` may name an alternative
Bun executable.

## Verification recorded in the diagnostic thread

The following evidence was recorded in the
[diagnostic thread](https://ampcode.com/threads/T-01a18b5f-4735-735f-aa2c-47b73f1cb252),
before its patch and checks were transferred to this experiments repository.
The original automaton proof sources were copied into a temporary reproduction
directory there.
The original proof passes the patched source CLI's `--verdict` without
`BENDTT`, a stack override, or a workaround wrapper. Its emitted kernel
input is byte-identical before and after; the kernel executable is unchanged.

| Artifact | SHA-256 |
| --- | --- |
| Downloaded `bend-2.0.39-linux-x64.tar.gz` | `6cf462fd8f70b094a4950ebb709a9c4ffd8f1d1189d9cedf1fd63cd5d041c7ab` |
| Locally compiled BendTT executable | `e365eba1741602bb45261aa0eb6bd2c6f5db885d4b9d4cd603a27bc3c5a9ed18` |
| Original automaton proof's emitted input | `dde8c506ac2b387f9f7796e95fc964896877333a4e5b95b6ab57c59158d790b1` |

The integration check changed from 2 passes / 3 failures before the fix to
5 passes / 0 failures after it. Upstream's `gates/safe_node.ts` also ran all
107 files in `tests/proof` at the new default: 69 accepted by both checkers,
34 rejected by Bend, 2 unsafe, and 2 outside the kernel's scope. It reported
no checker mismatches, infrastructure errors, or timeouts. This is not a run
of the full upstream test suite or a guarantee that every proof fits 64 MiB.

Lean's [thread runtime at v4.34.0](https://github.com/leanprover/lean4/blob/v4.34.0/src/runtime/thread.cpp)
reads `LEAN_STACK_SIZE_KB`, sets the pthread stack size, and throws the
observed error when `pthread_create` fails. The stock launcher's hard-coded
setting is in
[`bend2/safe.ts`](https://github.com/bendlang/bend/blob/v2.0.39/bend2/safe.ts#L1667-L1668).
