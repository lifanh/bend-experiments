# Mandelbrot / Julia: pure F32 arithmetic and structurally bounded iteration.
# Compile the public, non-IO defs for a browser or Node:
#   bend experiments/fractal.bend -o fractal.mjs
#   import Fractal from './fractal.mjs'
# Bool arguments are JS false / true; Nat and F32 are JS numbers.
import Base

# Check the current z before stepping. At the cap, the count means "not
# observed escaping within this budget", not a proof of set membership.
def Escape.loop(fuel: Nat, outside: Bool, +zx: F32, +zy: F32,
  +cx: F32, +cy: F32, +radius2: F32, done: Nat) -> Nat:
  match fuel outside:
    case 0n _:
      done
    case 1n+rest True{}:
      done
    case 1n+rest False{}:
      +nx = (zx * zx - zy * zy + cx : F32)
      +ny = (2.0 * zx * zy + cy : F32)
      Escape.loop(rest, (nx * nx + ny * ny > radius2 : F32),
        nx, ny, cx, cy, radius2, 1n+done)

# Mandelbrot: z0=0, c=(x,y). Julia: z0=(x,y), c=(juliaX,juliaY).
# Returns completed steps before escape, or iterations if the budget expires.
# A Julia point already outside the bailout radius returns 0. The radius is
# max(2, |c|) for Julia, so constants outside the usual |c|<=2 also work.
# Callers supply finite F32 inputs and nonnegative integral Nat budgets.
# Extreme magnitudes that overflow F32 squared arithmetic are unsupported.
def escape(iterations: Nat, +x: F32, +y: F32, julia: Bool,
  +juliaX: F32, +juliaY: F32) -> Nat:
  match julia:
    case False{}:
      Escape.loop(iterations, False{}, 0.0, 0.0, x, y, 4.0, 0n)
    case True{}:
      +radius2 = F32.max(4.0, (juliaX * juliaX + juliaY * juliaY : F32))
      Escape.loop(iterations, (x * x + y * y > radius2 : F32),
        x, y, juliaX, juliaY, radius2, 0n)

# JS representation (constructor tags are strings, not numeric enum values):
#   {$: 'Quad', tl, tr, bl, br}
#   {$: 'Tile', x, y, size, counts}
# Tile x/y are integer pixel offsets from the image's top-left. Each tile is
# at most 8x8; counts is row-major within that tile, not the whole image:
#   {$: 'Con', head: <number>, tail: <list>} ... {$: 'Nil'}
# Place tile entry i at (x + i % size, y + floor(i / size)). Do not concatenate
# quadrant lists: that would put entire top-left tiles before top-right rows.
type Raster is Type:
  Tile{x: Nat, y: Nat, size: Nat, counts: List<Nat>}
  Quad{tl: Raster, tr: Raster, bl: Raster, br: Raster}

# Tail loops, not parallel calls, compute all the pixels within one tile.
# Use global integer pixel coordinates rather than accumulating F32 deltas;
# this keeps pixel sampling independent of the fork/tile boundary.
def Tile.row(fuel: Nat, +originX: F32, +step: F32, +x: Nat, +cy: F32,
  +iterations: Nat, +julia: Bool, +juliaX: F32, +juliaY: F32,
  counts: List<Nat>) -> List<Nat>:
  match fuel:
    case 0n:
      counts
    case 1n+rest:
      cx = (originX + F32.from_nat(x) * step : F32)
      count = escape(iterations, cx, cy, julia, juliaX, juliaY)
      Tile.row(rest, originX, step, 1n+x, cy,
        iterations, julia, juliaX, juliaY, count <> counts)

def Tile.rows(fuel: Nat, +size: Nat, +x: Nat, +y: Nat,
  +originX: F32, +originY: F32, +step: F32, +iterations: Nat,
  +julia: Bool, +juliaX: F32, +juliaY: F32, counts: List<Nat>) -> List<Nat>:
  match fuel:
    case 0n:
      List.reverse(&1, Nat, counts)
    case 1n+rest:
      cy = (originY - F32.from_nat(y) * step : F32)
      row = Tile.row(size, originX, step, x, cy,
        iterations, julia, juliaX, juliaY, counts)
      Tile.rows(rest, size, x, 1n+y, originX, originY, step,
        iterations, julia, juliaX, juliaY, row)

# Balanced spatial fork/join: four equally sized regions, then flat 8x8 tiles.
# Escape times differ across a fractal, so equal pixel counts do not guarantee
# equal runtime. No per-pixel tasks, GPU bang, unsafe recursion or custom FFI.
def Render.tree(depth: Nat, +size: Nat, +x: Nat, +y: Nat,
  +originX: F32, +originY: F32, +step: F32, +iterations: Nat,
  +julia: Bool, +juliaX: F32, +juliaY: F32) -> Raster:
  match depth:
    case 0n:
      Tile{x, y, size, Tile.rows(size, size, x, y, originX, originY, step,
        iterations, julia, juliaX, juliaY, [])}
    case 1n++rest:
      +half = Nat.div(size, 2n)
      +right = Nat.add(x, half)
      +bottom = Nat.add(y, half)
      tl tr bl br =
        Render.tree(rest, half, x, y, originX, originY, step, iterations, julia, juliaX, juliaY)
        Render.tree(rest, half, right, y, originX, originY, step, iterations, julia, juliaX, juliaY)
        Render.tree(rest, half, x, bottom, originX, originY, step, iterations, julia, juliaX, juliaY)
        Render.tree(rest, half, right, bottom, originX, originY, step, iterations, julia, juliaX, juliaY)
      Quad{tl, tr, bl, br}

# Public renderer: a 2^depth square covering span complex-plane units in both
# axes, sampled at pixel centers. X increases right; imaginary Y increases up.
# Depth 0 is one sample at the center. Suggested interactive depths: 5..9;
# callers must bound depth/iterations to their own memory and time budget.
# span must be positive and finite. F32 precision limits meaningful deep zoom.
def render(+depth: Nat, centerX: F32, centerY: F32, +span: F32,
  iterations: Nat, julia: Bool, juliaX: F32, juliaY: F32) -> Raster:
  +size = Nat.pow(2n, depth)
  +step = (span / F32.from_nat(size) : F32)
  +inset = ((span - step) / 2.0 : F32)
  originX = (centerX - inset : F32)
  originY = (centerY + inset : F32)
  Render.tree(Nat.sub(depth, 3n), size, 0n, 0n, originX, originY, step,
    iterations, julia, juliaX, juliaY)
