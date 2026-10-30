# Gray-Scott reaction diffusion. All chemistry and periodic stencil math
# stays in Bend; JS only transports reusable values and draws them.
# JS Cell: {$: 'Chemical', u: number, v: number}; row-major n*n cells:
# {$: 'Con', head: cell, tail: list} ending in {$: 'Nil'}.
import Base

type Cell is Data:
  Chemical{u: F32, v: F32}

# Internal vertical window, never part of the public state representation.
type Column is Data:
  Column{north: Cell, center: Cell, south: Cell}

def Stencil.apply(left: Column, middle: Column, right: Column,
  +feed: F32, kill: F32) -> Cell:
  match left middle right:
    case Column{Chemical{nwU, nwV}, Chemical{wU, wV}, Chemical{swU, swV}}
      Column{Chemical{nU, nV}, Chemical{+u, +v}, Chemical{sU, sV}}
      Column{Chemical{neU, neV}, Chemical{eU, eV}, Chemical{seU, seV}}:
      lapU = (0.2 * (nU + sU + wU + eU)
        + 0.05 * (nwU + neU + swU + seU) - u : F32)
      lapV = (0.2 * (nV + sV + wV + eV)
        + 0.05 * (nwV + neV + swV + seV) - v : F32)
      +reaction = (u * v * v : F32)
      Chemical{(u + 0.16 * lapU - reaction + feed * (1.0 - u) : F32),
        (v + 0.08 * lapV + reaction - (feed + kill) * v : F32)}

def Row.columns(above: List<&2, Cell>, row: List<&2, Cell>,
  below: List<&2, Cell>) -> List<&2, Column>:
  match above row below:
    case a <> at b <> bt c <> ct:
      Column{a, b, c} <> Row.columns(at, bt, ct)
    case _ _ _:
      Nil{}

# Look ahead one column, retaining the old first and last for wraparound.
# Accumulate into the grid's reversed output; no per-cell indexing/append.
def Row.loop(columns: List<&2, Column>, left: Column, +first: Column,
  +feed: F32, +kill: F32, acc: List<&2, Cell>) -> List<&2, Cell>:
  match columns:
    case Nil{}:
      acc
    case middle <> Nil{}:
      Stencil.apply(left, middle, first, feed, kill) <> acc
    case +middle <> +right <> rest:
      Row.loop(right <> rest, middle, first, feed, kill,
        Stencil.apply(left, middle, right, feed, kill) <> acc)

def Row.start(+columns: List<&2, Column>, feed: F32, kill: F32,
  acc: List<&2, Cell>) -> List<&2, Cell>:
  match columns:
    case Nil{}:
      acc
    case +first <> rest:
      last = List.last.go(&2, Column, rest, first)
      Row.loop(columns, last, first, feed, kill, acc)

# Each take/drop consumes just the next row: total O(n*n), not O(n^4).
def Grid.rows(fuel: Nat, +size: Nat, +cells: List<&2, Cell>) -> List<&2, List<&2, Cell>>:
  match fuel:
    case 0n:
      Nil{}
    case 1n+rest:
      List.take(&2, Cell, cells, size)
        <> Grid.rows(rest, size, List.drop(&2, Cell, cells, size))

def Grid.loop(rows: List<&2, List<&2, Cell>>, above: List<&2, Cell>,
  +first: List<&2, Cell>, +feed: F32, +kill: F32,
  acc: List<&2, Cell>) -> List<&2, Cell>:
  match rows:
    case Nil{}:
      List.reverse(&2, Cell, acc)
    case row <> Nil{}:
      List.reverse(&2, Cell, Row.start(Row.columns(above, row, first), feed, kill, acc))
    case +row <> +below <> rest:
      Grid.loop(below <> rest, row, first, feed, kill,
        Row.start(Row.columns(above, row, below), feed, kill, acc))

def Grid.start(+rows: List<&2, List<&2, Cell>>, feed: F32, kill: F32) -> List<&2, Cell>:
  match rows:
    case Nil{}:
      Nil{}
    case +first <> rest:
      last = List.last.go(&2, List<&2, Cell>, rest, first)
      Grid.loop(rows, last, first, feed, kill, Nil{})

# Simultaneous explicit Euler, dt=1, Du=.16, Dv=.08, toroidal boundaries.
# Stencil weights: center -1, orthogonal .2, diagonal .05. No clamping:
# finite concentrations/rates and bounded runs are the caller's contract.
# Supply exactly size*size cells, with u,v in [0,1] and feed,kill in [.01,.08].
# Size zero is empty; sizes one/two count repeated periodic neighbors.
# O(size^2) work/storage per step. The row walks are sequential, not GPU work.
def step(+size: Nat, cells: List<&2, Cell>, feed: F32, kill: F32) -> List<&2, Cell>:
  Grid.start(Grid.rows(size, size, cells), feed, kill)

# Zero steps returns the original snapshot without rounding or allocation.
def advance(steps: Nat, +size: Nat, cells: List<&2, Cell>,
  +feed: F32, +kill: F32) -> List<&2, Cell>:
  match steps:
    case 0n:
      cells
    case 1n+rest:
      advance(rest, size, step(size, cells, feed, kill), feed, kill)

def Seed.distance2(+dx: F32, +dy: F32) -> F32:
  (dx * dx + dy * dy : F32)

def Seed.shape(spots: Bool, ring: Bool, +x: F32, +y: F32) -> Bool:
  match spots ring:
    case True{} _:
      Bool.or((Seed.distance2((x - 0.25 : F32), (y - 0.25 : F32)) <= 0.0036 : F32),
        Bool.or((Seed.distance2((x - 0.7 : F32), (y - 0.35 : F32)) <= 0.0036 : F32),
          (Seed.distance2((x - 0.45 : F32), (y - 0.7 : F32)) <= 0.0036 : F32)))
    case False{} True{}:
      +r2 = Seed.distance2((x - 0.5 : F32), (y - 0.5 : F32))
      Bool.and(Bool.and((r2 >= 0.0324 : F32), (r2 <= 0.0576 : F32)),
        Bool.or((x <= 0.5 : F32), (y >= 0.5 : F32)))
    case False{} False{}:
      Bool.and((F32.abs((x - 0.5 : F32)) <= 0.08 : F32),
        (F32.abs((y - 0.5 : F32)) <= 0.08 : F32))

def Seed.cell(active: Bool, x: Nat, y: Nat) -> Cell:
  match active:
    case False{}:
      Chemical{1.0, 0.0}
    case True{}:
      noise = Nat.mod(Nat.add(Nat.mul(17n, x), Nat.mul(31n, y)), 11n)
      Chemical{0.5, (0.25 + 0.002 * F32.from_nat(noise) : F32)}

def Seed.row(fuel: Nat, +x: Nat, +y: Nat, +size: F32, +cy: F32,
  +spots: Bool, +ring: Bool, acc: List<&2, Cell>) -> List<&2, Cell>:
  match fuel:
    case 0n:
      acc
    case 1n+rest:
      cx = ((F32.from_nat(x) + 0.5) / size : F32)
      cell = Seed.cell(Seed.shape(spots, ring, cx, cy), x, y)
      Seed.row(rest, 1n+x, y, size, cy, spots, ring, cell <> acc)

def Seed.rows(fuel: Nat, +y: Nat, +size: Nat, +spots: Bool,
  +ring: Bool, acc: List<&2, Cell>) -> List<&2, Cell>:
  match fuel:
    case 0n:
      List.reverse(&2, Cell, acc)
    case 1n+rest:
      +width = F32.from_nat(size)
      cy = ((F32.from_nat(y) + 0.5) / width : F32)
      Seed.rows(rest, 1n+y, size, spots, ring,
        Seed.row(size, 0n, y, width, cy, spots, ring, acc))

# 0: central patch; 1: three scattered disks; 2: broken ring (gap at upper
# right). Unknown U32 patterns select 0. No random state: a tiny, coordinate-
# keyed v perturbation breaks symmetry. Suggested display sizes: 48 or 64.
# Size zero returns empty without division. Very small grids undersample shapes.
def seed(+size: Nat, +pattern: U32) -> List<&2, Cell>:
  Seed.rows(size, 0n, size, U32.is_eq(pattern, 1), U32.is_eq(pattern, 2), Nil{})
