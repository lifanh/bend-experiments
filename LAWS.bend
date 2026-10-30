# The specification: all finite rows, including empty and one-cell rows.
# These laws cover the Bend dynamics, not JavaScript, graphics or the compiler.
import Base
import ./experiments/automaton.bend as A

law cell_reverses:
  for +left: Bool
  for +right: Bool
  for +past: Bool
  {A.evolve(left, right, A.evolve(left, right, past)) == past : Bool}

law time_reverses:
  for +cells: List<&2, A.Cell>
  {A.backward(A.forward(cells)) == cells : List<&2, A.Cell>}

law time_runs_both_ways:
  for +cells: List<&2, A.Cell>
  {A.forward(A.backward(cells)) == cells : List<&2, A.Cell>}
