# Native demo: bend experiments/lights-cli.bend -o /tmp/lights-cli
# Then: /tmp/lights-cli +RTS --threads 4
import Base
import ./lights.bend as Lights

def print_result(board: U32, result: Lights.SolveResult) -> IO(Unit):
  match result:
    case Lights.Solution{solvable, moves, count}:
      IO.print("board=" ++ U32.show(board) ++ " solvable=" ++ Bool.show(solvable)
        ++ " moves=" ++ U32.show(moves) ++ " count=" ++ U32.show(count))

def main() -> IO(Unit):
  do IO<Unit>:
    # All lights on: minimum is four presses, smallest mask is 10260.
    print_result(65535, Lights.solve(65535))
    # One press at the top-left, already solved, and unsolvable respectively.
    print_result(19, Lights.solve(19))
    print_result(0, Lights.solve(0))
    print_result(1, Lights.solve(1))
