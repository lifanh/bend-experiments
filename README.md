# Bend experiments

Ten small worlds computed in **Bend 2.0.39**, with a framework-free browser playground, native CPU programs, exhaustive checks, and machine-checked reversibility and token-conservation laws.

## Ten ideas, ranked

Ranked for hands-on interest, distinct Bend features, and a useful experiment that can actually be verified.

| Rank | Idea | Why Bend? | Status |
| --- | --- | --- | --- |
| 1 | **Fractal atlas** — explore Mandelbrot and Julia sets | Independent spatial tiles become a fork/join tree | Implemented |
| 2 | **Lights Out laboratory** — play, edit, and find a minimum solution | Pure bitwise transitions, balanced exact search | Implemented |
| 3 | **Reversible universe** — run a cellular automaton backward without an undo log | State transitions plus universally quantified proofs | Implemented |
| 4 | Gravity sandbox — orbiting bodies and energy drift | Paired force calculations; compare numerical integrators | Implemented |
| 5 | Ray-traced marble museum — spheres, shadows, reflections | Recursive rays and independently shaded tiles | Implemented |
| 6 | Sorting orchestra — hear and see parallel merge sort | Structural recursion; tested ordering and value preservation | Implemented |
| 7 | Maze cartographer — generate, solve, and compare routes | Pure graph generation and observable search traces | Implemented |
| 8 | Tiny typed interpreter — evaluate a language within a language | Dependent types rule out invalid typed expressions | Implemented |
| 9 | Reaction–diffusion garden — grow spots and stripes | Pure simultaneous stencil computation | Implemented |
| 10 | Proof-carrying vault — transfer tokens without creating money | Conservation laws over state transitions | Implemented |

## Run the playground

Requirements: **Bend 2.0.39**, Node.js **22+**. There are no npm dependencies and no install step for the web app. Download Bend from [the official installation page](https://bend-lang.com); its current installer may move to a newer release, so use [v2.0.39 release assets](https://github.com/bendlang/bend/releases/tag/v2.0.39) to reproduce this version. The build intentionally refuses other versions rather than silently relying on a changing language.

```sh
export PATH="$HOME/.bend/bin:$PATH"
npm run dev
```

The server prints its port (3000 by default; override with `PORT`). In an Amp orb, expose it with a portal instead of sharing a loopback URL. `npm run dev` builds once; rerun `npm run build` and reload after editing. `npm start` serves an existing build.

The browser imports Bend-generated ES modules. JavaScript owns controls, input construction, drawing and sound—not the ten experiments' algorithms. Fractal and ray rendering run in replaceable Web Workers; the garden uses a stateful worker. Playback pauses when leaving its panel or hiding the page (a garden batch already in flight finishes, then stops). **The JavaScript target is sequential; a Web Worker is not Bend multicore execution.**

### Persistent Amp orb setup and preview

`.agents/setup` installs checksum-verified **Bend 2.0.39** and **Lean 4.34.0** into `~/.local/share/bend-experiments`, installs missing system prerequisites, compiles the shipped BendTT kernel, checks the reversibility and vault proofs with that kernel, and builds all ten experiments. Node 22+ and Bun come from the orb image. No account secrets are required.

The script caches release archives and the kernel, and installs one repository-scoped login-shell hook sourcing `.agents/env`. It also applies [the configurable stack patch](docs/kernel-stack.md) to an exact pinned upstream source checkout. `npm run verdict` runs this patched launcher through Bun, not the unchanged release binary; normal builds still use the release. Lean's initial archive is approximately 580 MB; downloads are verified against pinned SHA-256 digests. Cold startup depends on download speed and kernel compilation; warm setup reuses both.

```sh
.agents/setup
amp orb services ensure
```

`.amp/services.yaml` declares the supervised `bend-lab` service: build, serve port 3000, health-check `/`, and publish a portal. `services ensure` prints the current shareable portal URL and is safe to rerun. The service supervisor handles restart/resume; no server is launched from setup and no resume hook is needed. Generated portal metadata stays ignored. These repository files must reach the project's default branch before new project orbs can use them.

### 01 · Fractal atlas

Switch between Mandelbrot and Julia, change the iteration budget, and click to center and zoom. Keyboard users can use the zoom buttons. The browser renders 512×512 pixels, with zoom capped at 128× because arithmetic is F32. Julia constants are limited to −2…2 per coordinate in the UI. The Bend API handles larger finite constants with an appropriately larger bailout radius, but extreme overflowing magnitudes are outside its contract.

The renderer forks four ways until 8×8 tiles, then runs sequential pixel loops. Equal pixel counts are not equal runtimes; boundary pixels take longer. A point that reaches the iteration budget is **not proved to belong to the set**.

### 02 · Lights Out

Each press flips one cell and its orthogonal neighbors, without wrapping. Find and apply a globally minimum solution, create solvable puzzles, edit arbitrary boards, or try the unsolvable one-light example. The outlined cells are the answer; their order does not matter.

Rather than blindly trying 65,536 press masks, Bend forks over the 16 first-row masks. Each fixes all remaining rows: a lit cell forces a press immediately below. This still represents every possible solution. Ties choose the smallest numeric mask. The test suite independently enumerates **all 65,536 boards**, finding 4,096 solvable and 61,440 unsolvable, and checks exact minima and tie-breaking.

### 03 · Reversible universe

Each cell has `past` and `now`. The next value is `past XOR left XOR right`, using its neighbors' current values. A finite row has fixed-off exterior neighbors. Run, pause, move forward or backward, and check a 256-step round trip. Both state layers are reconstructed; no history is used for rewind. The diagram previews 128 future generations from the current one.

`LAWS.bend` states, for **every finite row**, both `backward(forward(s)) = s` and `forward(backward(s)) = s`. `PROOF.bend` proves them by Boolean case analysis and structural induction, including empty and one-cell rows. These are laws of the Bend dynamics—not a proof of the browser, compiler, numerical renderer, or Lights Out optimality.

### 04 · Gravity sandbox

Compare **velocity Verlet** and **explicit Euler** side by side, with identical initial bodies, forces and step sizes. Presets cover equal-mass binary stars, a barycentric sun/planet pair, and a sun with two small planets. Both plots share an automatically fitted scale. The initial display is a paused 600-step simulation; Reset returns to time zero. Changing the timestep resets both methods. Trails retain the last 1,800 positions; each run stops at 50,000 steps.

Bend computes all forces, motion and energy using F32, G=1 and Plummer softening ε=0.05. Softening prevents a collision singularity; it does not fix numerical instability. The UI offers dt=0.005…0.08 deliberately so large-step drift is visible; 0.005…0.02 is the recommended range. No adaptive stepping, collisions or mergers are modeled. The energy readouts show signed **current** drift relative to the initial energy, not maximum drift.

The regression checks every step of a 2,000-step binary orbit at dt=0.02: maximum relative drift was 0.232175 for explicit Euler versus 0.00000310 for Verlet. Tests also check independently worked force/position values, unequal-mass momentum, ballistic motion, coincident bodies and negative/zero steps. This is numerical evidence, not a formal conservation proof or a promise of indefinite stability.

### 05 · Ray-traced marble museum

Orbit the camera, move a point light, vary reflectivity or disable shadows around three teal/coral/gold spheres above a patterned floor. Bend computes sphere/floor intersections, local lighting, shadow rays and bounded reflection paths; JavaScript only unpacks RGB pixels. Resolution ranges from 128×128 to 512×512, with 256×256 by default. Camera angles are radians; the light slider controls its x coordinate.

The renderer forks spatially down to at most 8×8 tiles, like the fractal atlas. It is a small deterministic ray tracer, not global illumination or a GPU renderer. Tests cover nearest forward hits, tangency, rays inside/behind spheres, shadows, reflection and camera controls, tile placement, bounded RGB, and a native/JS checksum.

### 06 · Sorting orchestra

Play or step through a 32-value merge sort, including descending, already-sorted and repeated-note inputs. Every displayed frame is computed by Bend: it shows completed merge levels, not individual comparisons. Independent halves use parallel lets. JavaScript never sorts the displayed data.

**Sound starts off.** Enable it explicitly to hear up to eight changed values per stage as short, quiet sine notes; visual playback works without Web Audio. Pause, reset, mute and navigation stop scheduled notes. The speed slider controls time between merge stages. Tests exhaust all 3,280 lists of length 0–7 over three values, cover U32 boundaries and larger inputs, and verify every frame preserves length and multiplicities. These properties are tested, not formally proved.

### 07 · Maze cartographer

Compare breadth-first and depth-first search on the **same seeded 12×12 or 16×16 grid**. Bend generates reciprocal passages, computes both routes, and supplies actual cell-expansion order for replay. The browser draws explored cells and the final paths; it does not generate or solve the maze. Green marks the start in the upper-left corner; gold marks the goal in the lower-right.

Without added loops the graph is a spanning tree, so both searches must find the same unique route. With loops, depth first can take a detour; breadth first finds a shortest route because every passage has equal cost. Tests compare against an independent graph-search oracle. **No formal shortest-path certificate or theorem is claimed.** Seeds are U32 integers; the UI bounds grid sizes to keep work small.

### 08 · Tiny typed interpreter

A structured editor builds raw syntax from natural-number and Boolean literals, addition, multiplication, less-than and conditionals. Choose a program and edit its literals, then check and evaluate it in Bend. Successful checking produces a genuinely **type-indexed expression tree**: the typed evaluator cannot receive an addition with a Boolean operand or a conditional with differently typed branches.

The checker inspects both branches, including the one a condition will not select. Three intentionally invalid examples show addition, branch-type and unchosen-branch errors. This is not a general text parser, JavaScript `eval`, or a separately proved semantic-preservation theorem. JavaScript builds syntax and displays results; Bend owns checking and evaluation. The fixed UI templates and literals limited to 0…100 keep every result at most 10,000. Bend 2.0.39 runtime Nats stop at 2^48−1, stricter than JavaScript's safe-integer range; arbitrary caller-supplied trees must keep all evaluated intermediates within that limit.

### 09 · Reaction–diffusion garden

The **Gray–Scott** model evolves chemicals U and V on a periodic 64×64 grid. Each cell reads the previous generation; updates are simultaneous, not in-place. The nine-point Laplacian weights are −1 at the center, 0.2 for orthogonal neighbors and 0.05 for diagonals. Diffusion rates are Du=0.16 and Dv=0.08, with dt=1. Bend computes diffusion and reaction; the worker converts V concentrations to a dark-teal → pale-gold palette.

Opening the garden computes a real 3,000-step **wandering-stripes** preview (feed=0.029, kill=0.057). Continue it, advance 200 steps, or reseed. Recipe changes compute a new preview; individual feed/kill or seed changes return to step zero. Each run is capped at 20,000 steps. Parameter changes terminate obsolete work, and navigation stops further batches. Some parameter combinations fade to uniformity; F32 and fixed-step simulation do not guarantee arbitrary numerical stability or biological realism.

### 10 · Proof-carrying vault

Two in-memory accounts start with **80 + 20 = 100 tokens**. Transfer in either direction, send zero, empty an account, or attempt an overdraft. Bend accepts a fully funded transfer and rejects an overdraft without moving any tokens. The UI shows the last three attempts; a reset starts a new ledger. This is a closed teaching economy with no fees, minting or real assets.

`experiments/vault-laws.bend` and its separate proof establish conservation, rejection identity and zero-transfer acceptance over the public transition for **all natural-number balances, amounts and directions**. The normal proof and kernel-verdict commands check these alongside automaton reversibility. The evidence lives in separate universal proofs, not runtime transaction fields. Runtime callers must keep the total within Bend 2.0.39's 2^48−1 Nat limit; the UI's fixed total of 100 and amounts bounded to 10,000 stay well inside it. The theorems do not prove browser input handling, the compiler, concurrency, authentication or persistence. This is not a production ledger.

## Verify

```sh
npm test                # compile ten modules; public-contract tests
npm run proof           # ordinary Bend proof/type/termination checker
npm run verdict         # additionally run the Lean-formalized BendTT kernel
npm run test:kernel-stack # Linux resource-limit regression; setup login environment
```

The stronger check needs Lean **4.34.0**. Stock Bend requests a 4 GiB Lean stack, causing thread creation to abort in this orb. The [patched launcher](docs/kernel-stack.md) defaults to 64 MiB and honors a nonempty `LEAN_STACK_SIZE_KB` override, including overrides that deliberately fail; it never bypasses proof checking. Orb setup configures this proof path automatically. The original fixed-stack wrapper remains available only as a legacy workaround. Ordinary checks are not silently promoted to kernel verification. The proved laws cover automaton reversibility and vault transitions; numerical, rendering, sorting and graph behavior have executable tests, not general correctness proofs.

## Native CPU experiments

Install clang 14+ (Debian/Ubuntu: `sudo apt-get install clang`). These programs do not use GPU bangs or require CUDA.

```sh
npm run native
./build/fractal +RTS --threads 2
./build/lights +RTS --threads 2
./build/automaton +RTS --threads 2
./build/gravity +RTS --threads 2
./build/raytracer +RTS --threads 2
./build/sorting +RTS --threads 2
./build/maze +RTS --threads 2
./build/interpreter +RTS --threads 2
./build/garden +RTS --threads 2
./build/vault +RTS --threads 2
npm run bench
```

`native` also compiles JS CLI references under `build/`. `bench` compares every native output against its JS reference and reports the median of five interleaved runs after one warmup per thread count, including process startup. It uses 1 and up to 4 available CPU threads. Tiny parallel tasks can lose to scheduling overhead; the automaton and four newest experiments are deliberately sequential, and gravity forks only pairs of body updates. Thread-count comparisons for sequential workloads check reproducibility, not parallel scaling.

Observed in this 2-CPU orb (not a portable speed claim):

| Native workload | 1 thread | 2 threads | Verified result |
| --- | ---: | ---: | --- |
| Mandelbrot, 256×256, 128 iterations | 8.9 ms | 6.1 ms | checksum 1,689,364 |
| Four Lights Out examples | 2.0 ms | 2.5 ms | same exact solutions |
| 128 cells, 1,000 forward + 1,000 backward | 43.0 ms | 43.0 ms | both layers restored |
| Binary gravity, 2,000 steps, two integrators | 3.6 ms | 39.9 ms | same energies and positions |
| Marble museum, 128×128, two reflections | 5.6 ms | 4.4 ms | checksum 1,421,989,472 |
| Four small merge-sort examples and stages | 2.0 ms | 2.2 ms | same values and stages |
| Three seeded maze comparisons + unreachable case | 12.8 ms | 12.7 ms | same passage, path and expansion hashes |
| Eleven typed expression / rejection examples | 2.0 ms | 2.0 ms | same values and type errors |
| Three 48×48 chemical gardens, 1,000 steps each | 1,038.2 ms | 1,047.5 ms | same concentrations and state checksums |
| Thirteen vault diagnostics | 2.0 ms | 2.0 ms | same balances and acceptance/rejection |

No GPU was available or tested. The native fractal experiment prints a checksum; the browser provides the interactive image.

## Layout

- `experiments/`: pure Bend modules and native IO entry points.
- `LAWS.bend`, `PROOF.bend`: automaton specifications and separate proofs; the vault has its own laws/proof pair under `experiments/`.
- `web/`: static UI and rendering workers importing the generated Bend modules.
- `.agents/`, `.amp/services.yaml`: pinned orb setup, shell environment and supervised preview.
- `scripts/`: shared experiment manifest, dependency-free build, static server, benchmarking, optional kernel stack wrapper.
- `tests/`: public APIs exercised after compilation, using Node's built-in test runner.
- `docs/bend-notes.md`: cited language exploration, version-specific findings, and verification limits.

Generated `dist/` and `build/` are ignored. No compiled code or third-party packages are vendored. MIT licensed.
