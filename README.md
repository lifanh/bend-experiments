# Bend experiments

Six small worlds computed in **Bend 2.0.39**, with a framework-free browser playground, native CPU programs, exhaustive checks, and machine-checked reversibility laws.

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
| 7 | Maze cartographer — generate, solve, and compare routes | Tree search and shortest-path certificates | Idea |
| 8 | Tiny typed interpreter — evaluate a language within a language | Dependent types rule out invalid programs | Idea |
| 9 | Reaction–diffusion garden — grow spots and stripes | Pure stencil computation over disjoint tiles | Idea |
| 10 | Proof-carrying vault — transfer tokens without creating money | Conservation laws over state transitions | Idea |

## Run the playground

Requirements: **Bend 2.0.39**, Node.js **22+**. There are no npm dependencies and no install step for the web app. Download Bend from [the official installation page](https://bend-lang.com); its current installer may move to a newer release, so use [v2.0.39 release assets](https://github.com/bendlang/bend/releases/tag/v2.0.39) to reproduce this version. The build intentionally refuses other versions rather than silently relying on a changing language.

```sh
export PATH="$HOME/.bend/bin:$PATH"
npm run dev
```

The server prints its port (3000 by default; override with `PORT`). In an Amp orb, expose it with a portal instead of sharing a loopback URL. `npm run dev` builds once; rerun `npm run build` and reload after editing. `npm start` serves an existing build.

The browser imports Bend-generated ES modules. JavaScript owns controls, input seeds, drawing and sound—not fractal orbits, solving, cellular dynamics, gravity, ray tracing or sorting. Fractal and ray rendering run in replaceable Web Workers so obsolete work cannot block interaction. Playback pauses when leaving its panel or hiding the page. **The JavaScript target is sequential; a Web Worker is not Bend multicore execution.**

### Persistent Amp orb setup and preview

`.agents/setup` installs checksum-verified **Bend 2.0.39** and **Lean 4.34.0** into `~/.local/share/bend-experiments`, installs missing system prerequisites, compiles the shipped BendTT kernel, checks the reversibility proofs with that kernel, and builds the playground. Node 22+ and Bun come from the orb image. No account secrets are required.

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

## Verify

```sh
npm test                # compile six modules; public-contract tests
npm run proof           # ordinary Bend proof/type/termination checker
npm run verdict         # additionally run the Lean-formalized BendTT kernel
npm run test:kernel-stack # Linux resource-limit regression; setup login environment
```

The stronger check needs Lean **4.34.0**. Stock Bend requests a 4 GiB Lean stack, causing thread creation to abort in this orb. The [patched launcher](docs/kernel-stack.md) defaults to 64 MiB and honors a nonempty `LEAN_STACK_SIZE_KB` override, including overrides that deliberately fail; it never bypasses proof checking. Orb setup configures this proof path automatically. The original fixed-stack wrapper remains available only as a legacy workaround. Ordinary checks are not silently promoted to kernel verification, and the proved laws still cover only automaton reversibility.

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
npm run bench
```

`native` also compiles JS CLI references under `build/`. `bench` compares every native output against its JS reference and reports the median of five interleaved runs after one warmup per thread count, including process startup. It uses 1 and up to 4 available CPU threads. Tiny parallel tasks can lose to scheduling overhead; the automaton is deliberately sequential and gravity forks only pairs of body updates.

Observed in this 2-CPU orb (not a portable speed claim):

| Native workload | 1 thread | 2 threads | Verified result |
| --- | ---: | ---: | --- |
| Mandelbrot, 256×256, 128 iterations | 14.0 ms | 9.7 ms | checksum 1,689,364 |
| Four Lights Out examples | 2.8 ms | 4.0 ms | same exact solutions |
| 128 cells, 1,000 forward + 1,000 backward | 56.1 ms | 59.6 ms | both layers restored |
| Binary gravity, 2,000 steps, two integrators | 6.7 ms | 64.1 ms | same energies and positions |
| Marble museum, 128×128, two reflections | 15.5 ms | 11.5 ms | checksum 1,421,989,472 |
| Four small merge-sort examples and stages | 3.2 ms | 3.6 ms | same values and stages |

No GPU was available or tested. The native fractal experiment prints a checksum; the browser provides the interactive image.

## Layout

- `experiments/`: pure Bend modules and native IO entry points.
- `LAWS.bend`, `PROOF.bend`: specifications and separate proofs.
- `web/`: static UI and rendering workers importing the generated Bend modules.
- `.agents/`, `.amp/services.yaml`: pinned orb setup, shell environment and supervised preview.
- `scripts/`: dependency-free build, static server, benchmarking, optional kernel stack wrapper.
- `tests/`: public APIs exercised after compilation, using Node's built-in test runner.
- `docs/bend-notes.md`: cited language exploration, version-specific findings, and verification limits.

Generated `dist/` and `build/` are ignored. No compiled code or third-party packages are vendored. MIT licensed.
