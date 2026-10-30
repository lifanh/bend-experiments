# Exploring Bend 2.0.39

Explored 29 October 2026. Installed the version advertised by [bend-lang.com](https://bend-lang.com/), read `bend guide`, `bend guide shaders`, and inspected the compiler's source and demos. The local repo initially contained only an MIT license.

## What this Bend is

This is the current **bendlang/bend** language, not an assumption about older Bend/HVM releases. [The v2.0.39 guide](https://github.com/bendlang/bend/blob/v2.0.39/guide/GUIDE.md) describes Python-shaped syntax, affine values, dependent types, mandatory termination, separate laws/proofs, native CPU/GPU targets, and an ES-module target.

- Values are affine by default; `+` allows copying Data-kinded values. `List<Cell>` and `List<&2, Cell>` are distinct types, not interchangeable annotations. We use the reusable list kind for automaton rows because the current cell and its neighbor need shared reads. [Guide: quantities and kinds](https://github.com/bendlang/bend/blob/v2.0.39/guide/GUIDE.md#quantities).
- Recursion must structurally decrease; `@unsafe` leaves proof guarantees. All experiments here use structural Nat fuel or shorter lists, with no unsafe code or custom FFI. [Guide: recursion](https://github.com/bendlang/bend/blob/v2.0.39/guide/GUIDE.md#recursion-and-termination).
- Parallel lets express independent, approximately balanced calls. Native CPU builds execute them on the thread pool; JavaScript ignores the parallelism. We used spatial tiles and first-row search branches, not a browser speed claim. [Guide: parallelism](https://github.com/bendlang/bend/blob/v2.0.39/guide/GUIDE.md#parallelism).
- A file can export non-IO definitions with `bend module.bend -o module.mjs`. Our execution checks confirm a default export object; `Nat` is a JS number, `Bool` is a JS boolean, and user constructors are `{$: 'Name', field: value}`. `List` has `head` and `tail`. [Guide: IO and interoperability](https://github.com/bendlang/bend/blob/v2.0.39/guide/GUIDE.md#io-and-concurrency), [upstream browser demo](https://github.com/bendlang/bend/blob/v2.0.39/demos/app_win_is_bug_2d/web/main.js).
- Native CPU builds require clang 14+, while GPU builds require newer tooling and hardware/runtime support. We installed Debian clang 14.0.6 and used CPU parallel lets without `!`. [Compiler toolchain selection](https://github.com/bendlang/bend/blob/v2.0.39/bend2/main.ts).
- The shader guide recommends a fork tree ending in flat loops rather than per-pixel forks. Our fractal stops forking at 8×8 tiles. The guide's GPU performance numbers are upstream measurements, not measurements of this project. [Shaders guide](https://github.com/bendlang/bend/tree/v2.0.39/guide).
- A `main` returning IO executes compiled code; a pure value-returning `main` is normalized by the checker and is unsuitable for big performance measurements. Our native entry points use IO. [Guide: tooling](https://github.com/bendlang/bend/blob/v2.0.39/guide/GUIDE.md#tooling).

The upstream main checkout inspected during exploration was `4982c105b9e8e06cc1d1e2d0d63c546dac4aa377`. It already contained APIs absent from installed 2.0.39 (notably `U32.popcount`), so the release's `bend base` and actual compile/run results were the authority. Build scripts pin 2.0.39.

## Why these three

The ranked shortlist is in the README. Fractals exercise independent numeric computation; Lights Out exercises exact finite search; reversible automata exercise proofs of state transitions. Their core computations live in Bend, while standard browser APIs provide the UI. This avoids learning a web framework instead of learning Bend.

The Lights Out implementation deliberately exploits row forcing: all 16 first-row choices are sufficient. An independent coordinate-based oracle enumerates every one of the 65,536 full press masks and checks the solver on every board. This is exhaustive finite verification, not a formal Bend optimality proof.

For the automaton, reversibility is universally quantified over arbitrary finite rows and arbitrary Boolean contents in **both** layers. The proof does not assume a zero past, a particular seed, or 128 cells. Two helper lemmas connect the neighbor reads in forward/backward rows; induction proves the complete list round trip. Browser round-trip checks are additional integration evidence, not replacements for the proof.

## Stronger proof check in this orb

**Update:** orb setup now installs the [configurable launcher fix](kernel-stack.md).
`npm run verdict` uses patched v2.0.39 source through Bun and the unchanged kernel;
the fixed-stack wrapper below is retained only as the original reproduction.

`bend PROOF.bend` printed `ALL PROOFS CHECK` followed by `Use --verdict for mathematical validity.` The distinction matters: [the guide](https://github.com/bendlang/bend/blob/v2.0.39/guide/GUIDE.md#laws-and-proofs) says `--verdict` checks again with the Lean-formalized kernel. The compiler-to-kernel translation itself is not formally proved.

We installed official [Lean 4.34.0](https://github.com/leanprover/lean4/releases/tag/v4.34.0), then let Bend compile its shipped `bendtt.lean` kernel. The stock invocation failed:

```text
Error: BendTT infrastructure: kernel terminated by SIGABRT
```

Running the cached kernel directly exposed `failed to create thread: Resource temporarily unavailable`. [Bend's kernel launcher](https://github.com/bendlang/bend/blob/v2.0.39/bend2/safe.ts) forces `LEAN_STACK_SIZE_KB=4194304` (4 GiB); setting that in the parent cannot override it. Changing only this resource setting to 65,536 KiB made the identical binary and emitted proof return `ALL PROOFS CHECK`.

The optional wrapper is explicit and fail-closed. After a first `npm run verdict` has built the kernel, identify its executable under `$HOME/.bend/bendtt/<source-and-Lean-hash>/bendtt`. **Use the kernel built by this Bend version**, not an arbitrary old cached kernel. Then:

```sh
export BENDTT_KERNEL="$HOME/.bend/bendtt/<the-current-hash>/bendtt"
export BENDTT="$PWD/scripts/kernel-limited.sh"
npm run verdict
```

Verified output from that command:

```text
ALL PROOFS CHECK
```

The wrapper does not change proofs, ignore checker failures, edit the kernel, or invent a verdict. It executes the selected kernel with a smaller stack and preserves its exit status. If more stack is needed, verification will still fail. The upstream resource issue remains separate from this project; no upstream issue was posted.

## Verification boundaries

- Kept tests exercise generated public APIs, not private helpers. They compare Lights Out with a full independent enumeration; exercise known fractal orbits, asymmetric coordinates, tile coverage and a native/JS checksum; and exhaust automaton state pairs through width four plus multi-step round trips.
- Proofs cover the automaton dynamics. They do not establish F32 numerical fidelity, browser accessibility, native compiler correctness, or solver optimality.
- Fractal escape counts reaching the cap are inconclusive, not membership certificates. F32 imposes precision limits.
- The UI is a sequential JS preview. CPU benchmarking uses native executables and checks equal outputs across thread counts. No GPU result or broad speedup claim is implied.
- This is a local experimental playground, not a hardened public hosting service. The server serves only generated `dist/` assets and supports GET/HEAD.
