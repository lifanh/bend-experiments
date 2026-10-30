# Second-order Rule 90 on a finite row with fixed-off boundary cells.
# A cell remembers two consecutive instants, not a stored history.
import Base

type Cell is Data:
  Cell{past: Bool, now: Bool}

def evolve(left: Bool, right: Bool, past: Bool) -> Bool:
  Bool.xor(past, Bool.xor(left, right))

def first_now(cells: List<&2, Cell>) -> Bool:
  match cells:
    case Nil{}:
      False{}
    case Con{Cell{_, now}, _}:
      now

def first_past(cells: List<&2, Cell>) -> Bool:
  match cells:
    case Nil{}:
      False{}
    case Con{Cell{past, _}, _}:
      past

def advance(cells: List<&2, Cell>, left: Bool) -> List<&2, Cell>:
  match cells:
    case Nil{}:
      Nil{}
    case Con{Cell{past, +now}, +rest}:
      Cell{now, evolve(left, first_now(rest), past)} <> advance(rest, now)

def retreat(cells: List<&2, Cell>, left: Bool) -> List<&2, Cell>:
  match cells:
    case Nil{}:
      Nil{}
    case Con{Cell{+past, now}, +rest}:
      Cell{evolve(left, first_past(rest), now), past} <> retreat(rest, past)

def forward(cells: List<&2, Cell>) -> List<&2, Cell>:
  advance(cells, False{})

def backward(cells: List<&2, Cell>) -> List<&2, Cell>:
  retreat(cells, False{})

def travel(steps: Nat, cells: List<&2, Cell>) -> List<&2, Cell>:
  match steps:
    case 0n:
      cells
    case 1n+n:
      travel(n, forward(cells))

def rewind(steps: Nat, cells: List<&2, Cell>) -> List<&2, Cell>:
  match steps:
    case 0n:
      cells
    case 1n+n:
      rewind(n, backward(cells))
