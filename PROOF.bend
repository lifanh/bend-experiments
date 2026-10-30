import Base
import ./experiments/automaton.bend as A
import ./LAWS.bend as Laws

def Laws.cell_reverses(left, right, past):
  match left right past:
    case False{} False{} False{}: {==}
    case False{} False{} True{}: {==}
    case False{} True{} False{}: {==}
    case False{} True{} True{}: {==}
    case True{} False{} False{}: {==}
    case True{} False{} True{}: {==}
    case True{} True{} False{}: {==}
    case True{} True{} True{}: {==}

def head_forward(+cells: List<&2, A.Cell>, +left: Bool)
  -> {A.first_past(A.advance(cells, left)) == A.first_now(cells) : Bool}:
  match cells:
    case Nil{}: {==}
    case Con{A.Cell{past, now}, rest}: {==}

def head_backward(+cells: List<&2, A.Cell>, +left: Bool)
  -> {A.first_now(A.retreat(cells, left)) == A.first_past(cells) : Bool}:
  match cells:
    case Nil{}: {==}
    case Con{A.Cell{past, now}, rest}: {==}

def row_forward(+cells: List<&2, A.Cell>, +left: Bool)
  -> {A.retreat(A.advance(cells, left), left) == cells : List<&2, A.Cell>}:
  match cells:
    case Nil{}: {==}
    case Con{A.Cell{+past, +now}, +rest}:
      %row_forward(rest, now) : {A.retreat(A.advance(A.Cell{past, now} <> rest, left), left) == A.Cell{past, now} <> _ : List<&2, A.Cell>}
      %Laws.cell_reverses(left, A.first_now(rest), past) : {A.retreat(A.advance(A.Cell{past, now} <> rest, left), left) == A.Cell{_, now} <> A.retreat(A.advance(rest, now), now) : List<&2, A.Cell>}
      %head_forward(rest, now) : {A.retreat(A.advance(A.Cell{past, now} <> rest, left), left) == A.Cell{A.evolve(left, _, A.evolve(left, A.first_now(rest), past)), now} <> A.retreat(A.advance(rest, now), now) : List<&2, A.Cell>}
      {==}

def row_backward(+cells: List<&2, A.Cell>, +left: Bool)
  -> {A.advance(A.retreat(cells, left), left) == cells : List<&2, A.Cell>}:
  match cells:
    case Nil{}: {==}
    case Con{A.Cell{+past, +now}, +rest}:
      %row_backward(rest, past) : {A.advance(A.retreat(A.Cell{past, now} <> rest, left), left) == A.Cell{past, now} <> _ : List<&2, A.Cell>}
      %Laws.cell_reverses(left, A.first_past(rest), now) : {A.advance(A.retreat(A.Cell{past, now} <> rest, left), left) == A.Cell{past, _} <> A.advance(A.retreat(rest, past), past) : List<&2, A.Cell>}
      %head_backward(rest, past) : {A.advance(A.retreat(A.Cell{past, now} <> rest, left), left) == A.Cell{past, A.evolve(left, _, A.evolve(left, A.first_past(rest), now))} <> A.advance(A.retreat(rest, past), past) : List<&2, A.Cell>}
      {==}

def Laws.time_reverses(cells):
  row_forward(cells, False{})

def Laws.time_runs_both_ways(cells):
  row_backward(cells, False{})
