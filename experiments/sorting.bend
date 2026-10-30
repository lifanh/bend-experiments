# Balanced parallel merge sort of reusable U32 lists. No host sorting or IO.
# Public API: sort(values); frames(values) supplies full-array merge stages.
import Base

# A merge consumes at most n heads, where n is the combined input length.
# Base's merge is stable: equal heads are taken from the left run first.
def merge(n: Nat, left: List<&2, U32>, right: List<&2, U32>) -> List<&2, U32>:
  List.merge.go(~U32, ~U32.is_le, n, (Nil{}, left, right))

# Contiguous halves differ by at most one element. The structural fuel is
# initialized to the input length, which bounds the binary recursion depth.
def sort.go(+fuel: Nat, +n: Nat, +values: List<&2, U32>) -> List<&2, U32>:
  match fuel values:
    case 0n xs:
      xs
    case 1n+rest Nil{}:
      Nil{}
    case 1n+rest x <> Nil{}:
      [x]
    case 1n+rest x <> y <> tail:
      +half = Nat.div(n, 2n)
      left right = sort.go(rest, half, List.take(&2, U32, values, half)) sort.go(rest, Nat.sub(n, half), List.drop(&2, U32, values, half))
      merge(n, left, right)

# JS lists: {$: 'Nil'} or {$: 'Con', head: number, tail: list}.
# Values are U32 (0..4294967295); the reusable argument is not mutated.
def sort(+values: List<&2, U32>) -> List<&2, U32>:
  +n = List.length(&2, U32, values)
  sort.go(n, n, values)

# Zip child histories in lockstep, holding the shorter child's final frame.
# Once both finish, perform the parent merge and append its resulting frame.
# n bounds the number of child stages as well as the merged run length.
def frames.join(fuel: Nat, +n: Nat, left: List<&2, List<&2, U32>>, right: List<&2, List<&2, U32>>) -> List<&2, List<&2, U32>>:
  match fuel left right:
    case 0n _ _:
      Nil{}
    case 1n+rest Nil{} _:
      Nil{}
    case 1n+rest _ Nil{}:
      Nil{}
    case 1n+rest +l <> Nil{} +r <> Nil{}:
      [List.append(&2, U32, l, r), merge(n, l, r)]
    case 1n+rest +l <> Nil{} r <> rt:
      List.append(&2, U32, l, r) <> frames.join(rest, n, [l], rt)
    case 1n+rest l <> lt +r <> Nil{}:
      List.append(&2, U32, l, r) <> frames.join(rest, n, lt, [r])
    case 1n+rest l <> lt r <> rt:
      List.append(&2, U32, l, r) <> frames.join(rest, n, lt, rt)

def frames.go(+fuel: Nat, +n: Nat, +values: List<&2, U32>) -> List<&2, List<&2, U32>>:
  match fuel values:
    case 0n xs:
      [xs]
    case 1n+rest Nil{}:
      [Nil{}]
    case 1n+rest x <> Nil{}:
      [[x]]
    case 1n+rest x <> y <> tail:
      +half = Nat.div(n, 2n)
      left right = frames.go(rest, half, List.take(&2, U32, values, half)) frames.go(rest, Nat.sub(n, half), List.drop(&2, U32, values, half))
      frames.join(n, n, left, right)

# Reusable list of reusable snapshots. First is the input; last is sort(input).
# Each intervening stage finishes independent child merges, preserving every
# value. These are actual merge results, not per-comparison/write animations.
# Empty/singleton inputs have one frame (initial is already final). Otherwise
# there are ceil(log2(length)) + 1 stages; already-sorted stages may repeat.
# JS receives nested Con/Nil lists; playback, drawing and audio stay in JS.
def frames(+values: List<&2, U32>) -> List<&2, List<&2, U32>>:
  +n = List.length(&2, U32, values)
  frames.go(n, n, values)
