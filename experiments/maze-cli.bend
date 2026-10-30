# Bounded native/JS comparison, including the UI's 12x12 and 16x16 sizes.
# bend experiments/maze-cli.bend -o build/maze
# build/maze +RTS --threads 1   (also test --threads 2)
# Hashes cover every cell, route node and expansion, not just their lengths.
# These are diagnostics, not certificates or a formal shortest-path proof.
import Base
import ./maze.bend as Maze

def masks.hash(cells: List<&2, U32>, acc: U32) -> U32:
  match cells:
    case Nil{}:
      acc
    case mask <> rest:
      masks.hash(rest, U32.mul(U32.xor(acc, mask), 16777619))

def nodes.hash(nodes: List<&2, Nat>, acc: U32) -> U32:
  match nodes:
    case Nil{}:
      acc
    case index <> rest:
      nodes.hash(rest, U32.mul(U32.xor(acc, U32.from_nat(index)), 16777619))

def report(label: String, found: Maze.SearchResult) -> IO(Unit):
  Maze.Search{+path, +visited} = found
  IO.print(label ++ " path-nodes=" ++ Nat.show(List.length(&2, Nat, path))
    ++ " expanded=" ++ Nat.show(List.length(&2, Nat, visited))
    ++ " path-hash=" ++ U32.show(nodes.hash(path, 2166136261))
    ++ " visited-hash=" ++ U32.show(nodes.hash(visited, 2166136261)))

def demo(+size: Nat, +seed: U32, +loops: Bool) -> IO(Unit):
  +cells = Maze.generate(size, seed, loops)
  +goal = Nat.sub(Nat.mul(size, size), 1n)
  do IO<Unit>:
    IO.print("size=" ++ Nat.show(size) ++ " seed=" ++ U32.show(seed)
      ++ " loops=" ++ Bool.show(loops) ++ " cells-hash=" ++ U32.show(masks.hash(cells, 2166136261)))
    report("BFS", Maze.search(size, cells, 0n, goal, False{}))
    report("DFS", Maze.search(size, cells, 0n, goal, True{}))

def main() -> IO(Unit):
  do IO<Unit>:
    demo(12n, 42, False{})
    demo(12n, 42, True{})
    demo(16n, 4294967295, True{})
    report("Unreachable", Maze.search(2n, [2, 8, 2, 8], 0n, 3n, False{}))
