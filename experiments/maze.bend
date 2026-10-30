# Maze cartographer: pure seeded generation and graph search in Bend.
# Row-major cells hold opening masks N=1, E=2, S=4, W=8.
# Public inputs: bounded square grids (0..32), U32 seeds, ordinary JS Bools.
# Nat inputs must be nonnegative integers, and masks must be U32 values.
# Size>32 is rejected (empty output), rather than clamped to another board.
# Lists cross JS as {$: 'Con', head, tail} ending in {$: 'Nil'}.
# No custom FFI, unsafe recursion, host randomness, or formal-proof claims.
import Base

type Edge is Data:
  Edge{next: Nat, wall: U32, back: U32}

def cell(cells: List<&2, U32>, index: Nat) -> U32:
  match cells index:
    case Nil{} _:
      0
    case value <> rest 0n:
      value
    case value <> rest 1n+previous:
      cell(rest, previous)

def edges.put(valid: Bool, edge: Edge, rest: List<&2, Edge>) -> List<&2, Edge>:
  match valid:
    case True{}:
      edge <> rest
    case False{}:
      rest

# Candidate order is always north, east, south, west; no row wrapping.
def edges(+size: Nat, +index: Nat) -> List<&2, Edge>:
  +x = Nat.mod(index, size)
  +y = Nat.div(index, size)
  west = edges.put(Nat.is_gt(x, 0n), Edge{Nat.sub(index, 1n), 8, 2}, Nil{})
  south = edges.put(Nat.is_lt(1n+y, size), Edge{Nat.add(index, size), 4, 1}, west)
  east = edges.put(Nat.is_lt(1n+x, size), Edge{1n+index, 2, 8}, south)
  edges.put(Nat.is_gt(y, 0n), Edge{Nat.sub(index, size), 1, 4}, east)

# LCG arithmetic wraps in U32. Selection uses upper bits, not the weak low bits.
# This is a reproducible procedural seed, not cryptographic randomness.
def random(seed: U32) -> U32:
  U32.add(U32.mul(seed, 1664525), 1013904223)

def carve(+cells: List<&2, U32>, +current: Nat, edge: Edge) -> List<&2, U32>:
  Edge{+next, wall, back} = edge
  opened = List.set(&2, U32, cells, current, U32.or(cell(cells, current), wall))
  List.set(&2, U32, opened, next, U32.or(cell(cells, next), back))

def unvisited(candidates: List<&2, Edge>, +cells: List<&2, U32>) -> List<&2, Edge>:
  match candidates:
    case Nil{}:
      Nil{}
    case Edge{+next, wall, back} <> rest:
      edges.put(U32.is_eq(cell(cells, next), 0), Edge{next, wall, back}, unvisited(rest, cells))

type Carver is Data:
  Carver{cells: List<&2, U32>, stack: List<&2, Nat>, seed: U32}

def carve.chosen(choice: Maybe<&2, Edge>, cells: List<&2, U32>,
  +current: Nat, stack: List<&2, Nat>, seed: U32) -> Carver:
  match choice:
    case None{}:
      Carver{cells, stack, seed}
    case Some{Edge{+next, wall, back}}:
      Carver{carve(cells, current, Edge{next, wall, back}), next <> current <> stack, seed}

def carve.step(+candidates: List<&2, Edge>, cells: List<&2, U32>,
  current: Nat, stack: List<&2, Nat>, +seed: U32) -> Carver:
  match candidates:
    case Nil{}:
      Carver{cells, stack, seed}
    case edge <> rest:
      pick = U32.to_nat(U32.mod(U32.shrn(seed, 16n), U32.from_nat(List.length(&2, Edge, candidates))))
      carve.chosen(List.get(&2, Edge, candidates, pick), cells, current, stack, seed)

# A randomized depth-first backtracker pushes each new cell once, then pops
# each cell once. 2*V fuel bounds the entire walk, not just a lucky random run.
def carve.go(fuel: Nat, +size: Nat, state: Carver) -> List<&2, U32>:
  match fuel state:
    case 0n Carver{cells, _, _}:
      cells
    case 1n+rest Carver{cells, Nil{}, _}:
      cells
    case 1n+rest Carver{+cells, +current <> stack, seed}:
      carve.go(rest, size, carve.step(unvisited(edges(size, current), cells),
        cells, current, stack, random(seed)))

def clean(cells: List<&2, U32>) -> List<&2, U32>:
  match cells:
    case Nil{}:
      Nil{}
    case mask <> rest:
      U32.and(mask, 15) <> clean(rest)

type Looper is Data:
  Looper{cells: List<&2, U32>, seed: U32, added: Bool}

def loops.open(open: Bool, current: Nat, edge: Edge, cells: List<&2, U32>,
  seed: U32, added: Bool) -> Looper:
  match open:
    case False{}:
      Looper{cells, seed, added}
    case True{}:
      Looper{carve(cells, current, edge), seed, True{}}

def loops.edge(eligible: Bool, current: Nat, edge: Edge,
  cells: List<&2, U32>, seed: U32, +added: Bool) -> Looper:
  match eligible:
    case False{}:
      Looper{cells, seed, added}
    case True{}:
      +nextSeed = random(seed)
      loops.open(Bool.or(Bool.not(added), U32.is_eq(U32.shrn(nextSeed, 30n), 0)),
        current, edge, cells, nextSeed, added)

def loops.edges(candidates: List<&2, Edge>, +current: Nat, state: Looper) -> Looper:
  match candidates:
    case Nil{}:
      state
    case Edge{next, +wall, back} <> rest:
      Looper{+cells, seed, added} = state
      eligible = Bool.and(Bool.or(U32.is_eq(wall, 2), U32.is_eq(wall, 4)),
        U32.is_eq(U32.and(cell(cells, current), wall), 0))
      loops.edges(rest, current,
        loops.edge(eligible, current, Edge{next, wall, back}, cells, seed, added))

# Visit each undirected grid edge once (east/south only). Open the first
# closed edge and a seeded quarter of the remaining closed edges. For every
# square of size>=2 this guarantees a cycle while preserving the base tree.
def loops.go(fuel: Nat, +size: Nat, +current: Nat, state: Looper) -> List<&2, U32>:
  match fuel:
    case 0n:
      Looper{cells, _, _} = state
      cells
    case 1n+rest:
      loops.go(rest, size, 1n+current, loops.edges(edges(size, current), current, state))

def loops.select(enabled: Bool, +size: Nat, seed: U32, cells: List<&2, U32>) -> List<&2, U32>:
  match enabled:
    case False{}:
      cells
    case True{}:
      loops.go(Nat.mul(size, size), size, 0n, Looper{cells, U32.xor(seed, 2654435769), False{}})

# The root's temporary bit16 marks it visited before it has any passages;
# every subsequently visited cell has a nonzero passage mask. Strip bit16.
# size=0 is empty; size=1 is [0]. The same seed always makes the same tree.
def generate.checked(valid: Bool, +size: Nat, +seed: U32, loops: Bool) -> List<&2, U32>:
  match valid:
    case False{}:
      Nil{}
    case True{}:
      +count = Nat.mul(size, size)
      cells = {16 <> List.replicate(U32, Nat.sub(count, 1n), 0) : List<&2, U32>}
      tree = clean(carve.go(Nat.double(count), size, Carver{cells, [0n], seed}))
      loops.select(loops, size, seed, tree)

# loops=false: connected acyclic spanning tree; true: the same tree plus loops.
def generate(+size: Nat, seed: U32, loops: Bool) -> List<&2, U32>:
  generate.checked(Bool.and(Nat.is_gt(size, 0n), Nat.is_le(size, 32n)), size, seed, loops)

# JS: {$: 'Search', path: Con/Nil list of Nat, visited: Con/Nil list of Nat}.
type SearchResult is Data:
  Search{path: List<&2, Nat>, visited: List<&2, Nat>}

type SearchWork is Data:
  Running{pending: List<&2, List<&2, Nat>>, visited: List<&2, Nat>}
  Finished{path: List<&2, Nat>, visited: List<&2, Nat>}

# External maps may be asymmetric or have boundary bits: only reciprocal,
# in-bounds edges are traversable. High bits do not create extra passages.
def passages(candidates: List<&2, Edge>, +cells: List<&2, U32>, +mask: U32) -> List<&2, Edge>:
  match candidates:
    case Nil{}:
      Nil{}
    case Edge{+next, +wall, +back} <> rest:
      open = Bool.and(U32.is_ne(U32.and(mask, wall), 0),
        U32.is_ne(U32.and(cell(cells, next), back), 0))
      edges.put(open, Edge{next, wall, back}, passages(rest, cells, mask))

# Pending entries share reversed ancestor paths; no host parent map is needed.
def routes(candidates: List<&2, Edge>, +trail: List<&2, Nat>) -> List<&2, List<&2, Nat>>:
  match candidates:
    case Nil{}:
      Nil{}
    case Edge{next, _, _} <> rest:
      (next <> trail) <> routes(rest, trail)

def frontier(depthFirst: Bool, pending: List<&2, List<&2, Nat>>,
  next: List<&2, List<&2, Nat>>) -> List<&2, List<&2, Nat>>:
  match depthFirst:
    case False{}:
      List.append(&2, List<&2, Nat>, pending, next)
    case True{}:
      List.append(&2, List<&2, Nat>, next, pending)

def search.step(seen: Bool, goal: Bool, +size: Nat, +cells: List<&2, U32>,
  +current: Nat, trail: List<&2, Nat>, pending: List<&2, List<&2, Nat>>,
  visited: List<&2, Nat>, depthFirst: Bool) -> SearchWork:
  match seen goal:
    case True{} _:
      Running{pending, visited}
    case False{} True{}:
      Finished{List.reverse(&2, Nat, current <> trail), current <> visited}
    case False{} False{}:
      next = routes(passages(edges(size, current), cells, cell(cells, current)), current <> trail)
      Running{frontier(depthFirst, pending, next), current <> visited}

# Each cell expands once and adds at most four pending entries. 4*V+1 fuel
# covers every pop, including duplicates. Visited records expansions, not
# discovery/enqueue order; the goal is included and terminates the search.
def search.go(fuel: Nat, +size: Nat, +cells: List<&2, U32>, +goal: Nat,
  +depthFirst: Bool, work: SearchWork) -> SearchResult:
  match fuel work:
    case _ Finished{path, visited}:
      Search{path, List.reverse(&2, Nat, visited)}
    case 0n Running{_, visited}:
      Search{Nil{}, List.reverse(&2, Nat, visited)}
    case 1n+rest Running{Nil{}, visited}:
      Search{Nil{}, List.reverse(&2, Nat, visited)}
    case 1n+rest Running{Nil{} <> pending, visited}:
      search.go(rest, size, cells, goal, depthFirst, Running{pending, visited})
    case 1n+rest Running{Con{Con{+current, trail}, pending}, +visited}:
      search.go(rest, size, cells, goal, depthFirst,
        search.step(List.contains(~Nat, ~Nat.is_eq, visited, current), Nat.is_eq(current, goal),
          size, cells, current, trail, pending, visited, depthFirst))

def search.checked(valid: Bool, +size: Nat, cells: List<&2, U32>, start: Nat,
  goal: Nat, depthFirst: Bool) -> SearchResult:
  match valid:
    case False{}:
      Search{Nil{}, Nil{}}
    case True{}:
      count = Nat.mul(size, size)
      search.go(1n+Nat.mul(4n, count), size, cells, goal, depthFirst, Running{[[start]], Nil{}})

def search.sized(valid: Bool, +size: Nat, +cells: List<&2, U32>, +start: Nat,
  +goal: Nat, depthFirst: Bool) -> SearchResult:
  match valid:
    case False{}:
      Search{Nil{}, Nil{}}
    case True{}:
      +count = Nat.mul(size, size)
      endpoints = Bool.and(Nat.is_lt(start, count), Nat.is_lt(goal, count))
      search.checked(Bool.and(endpoints, Nat.is_eq(List.length(&2, U32, cells), count)),
        size, cells, start, goal, depthFirst)

# false selects FIFO breadth-first search (shortest unweighted path).
# true selects LIFO depth-first search (not necessarily shortest). Both use
# N,E,S,W tie breaking. Marking on expansion preserves recursive DFS order:
# a pending sibling may first be reached through the currently active branch.
# Paths include start and goal; unreachable gives an empty path and the full
# reachable expansion order. size=0, size>32, wrong length or endpoints outside
# [0,size*size) give Search{[],[]}. For size=1 and start=goal=0 both lists are [0].
# Lists are reusable and never mutated. List-based work is intended for small
# interactive mazes, not large graphs; there is no parallel speedup claim.
def search(+size: Nat, cells: List<&2, U32>, start: Nat, goal: Nat,
  depthFirst: Bool) -> SearchResult:
  search.sized(Nat.is_le(size, 32n), size, cells, start, goal, depthFirst)
