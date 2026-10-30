# 4x4 Lights Out. Bit (row * 4 + column) is a cell; 1 means lit.
# Public board/move masks are normalized to their low 16 bits.
import Base

# False means no solution; moves/count are then zero, not a valid solution.
# JS: {$: "Solution", solvable: boolean, moves: number, count: number}.
type SolveResult is Data:
  Solution{solvable: Bool, moves: U32, count: U32}

# Applying presses is linear over XOR. The edge masks prevent row wrapping.
def apply(board: U32, moves: U32) -> U32:
  +m = U32.and(moves, 65535)
  horizontal = U32.xor(U32.shl(U32.and(m, 30583)), U32.shr(U32.and(m, 61166)))
  vertical = U32.xor(U32.shln(m, 4n), U32.shrn(m, 4n))
  U32.and(U32.xor(board, U32.xor(m, U32.xor(horizontal, vertical))), 65535)

def press.checked(valid: Bool, board: U32, index: U32) -> U32:
  match valid:
    case True{}:
      apply(board, U32.shln(1, U32.to_nat(index)))
    case False{}:
      U32.and(board, 65535)

# Out-of-range indices are no-ops on the normalized board. Validate before
# converting an index to Nat, so even the largest U32 is safe and constant-time.
def press(board: U32, +index: U32) -> U32:
  press.checked(U32.is_lt(index, 16), board, index)

def solve.count(bits: Nat, +moves: U32) -> U32:
  match bits:
    case 0n:
      0
    case 1n+rest:
      U32.add(U32.and(moves, 1), solve.count(rest, U32.shr(moves)))

def solve.finish(solved: Bool, +moves: U32) -> SolveResult:
  match solved:
    case True{}:
      Solution{True{}, moves, solve.count(16n, moves)}
    case False{}:
      Solution{False{}, 0, 0}

# After choosing the first row, every lit cell in a completed row forces
# a press directly below it. Later rows cannot change earlier rows again.
def solve.chase(rows: Nat, +board: U32, moves: U32, +row: U32) -> SolveResult:
  match rows:
    case 0n:
      solve.finish(U32.is_eq(board, 0), moves)
    case 1n+rest:
      +next = U32.shln(U32.and(board, row), 4n)
      solve.chase(rest, apply(board, next), U32.or(moves, next), U32.shln(row, 4n))

# A total ordering: solvable before unsolvable, then (popcount, mask).
def solve.best(a: SolveResult, b: SolveResult) -> SolveResult:
  match a b:
    case Solution{True{}, +ma, +ca} Solution{True{}, +mb, +cb}:
      prefer_a = Bool.or(U32.is_lt(ca, cb), Bool.and(U32.is_eq(ca, cb), U32.is_le(ma, mb)))
      Bool.pick(SolveResult, prefer_a, Solution{True{}, ma, ca}, Solution{True{}, mb, cb})
    case Solution{True{}, ma, ca} Solution{False{}, _, _}:
      Solution{True{}, ma, ca}
    case Solution{False{}, _, _} Solution{True{}, mb, cb}:
      Solution{True{}, mb, cb}
    case Solution{False{}, _, _} Solution{False{}, _, _}:
      Solution{False{}, 0, 0}

# A balanced four-level binary fork/join tree covers all 16 first rows.
# Each leaf performs the same three forced-row steps (no early pruning).
def solve.search(+depth: Nat, +board: U32, +bit: U32, +moves: U32) -> SolveResult:
  match depth:
    case 0n:
      solve.chase(3n, apply(board, moves), moves, 15)
    case 1n+rest:
      +next = U32.shl(bit)
      a b = solve.search(rest, board, next, moves) solve.search(rest, board, next, U32.or(moves, bit))
      solve.best(a, b)

# Every possible solution has one of these first rows, and its other rows
# are forced. Thus comparing these 16 candidates is exact over all 65536
# press masks, including the global minimum and smallest-mask tie break.
def solve(board: U32) -> SolveResult:
  solve.search(4n, U32.and(board, 65535), 1, 0)
