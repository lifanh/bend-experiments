# Tiny intrinsically typed interpreter. JS calls run(raw), never eval directly.
import Base

type Ty is Data:
  TNumber{}
  TBoolean{}

# The result type depends on the object-language type, not a runtime value tag.
def Value(t: Ty) -> Type:
  match t:
    case TNumber{}:
      Nat
    case TBoolean{}:
      Bool

# Equality fields pin each constructor's result index (the Ford encoding).
# {==} is checked evidence, not an unchecked conversion between Nat and Bool.
type Expr<-t: Ty> is Data:
  NumberExpr{value: Nat, eq: {TNumber{} == t : Ty}}
  BooleanExpr{value: Bool, eq: {TBoolean{} == t : Ty}}
  AddExpr{left: Expr<TNumber{}>, right: Expr<TNumber{}>, eq: {TNumber{} == t : Ty}}
  MultiplyExpr{left: Expr<TNumber{}>, right: Expr<TNumber{}>, eq: {TNumber{} == t : Ty}}
  LessExpr{left: Expr<TNumber{}>, right: Expr<TNumber{}>, eq: {TBoolean{} == t : Ty}}
  IfExpr{condition: Expr<TBoolean{}>, yes: Expr<t>, no: Expr<t>}

# Thunks defer evaluation of the unchosen (already checked) branch.
def pick(-t: Ty, condition: Bool, yes: Unit -> Value(t), no: Unit -> Value(t)) -> Value(t):
  match condition:
    case True{}:
      yes(Unit{})
    case False{}:
      no(Unit{})

# Total on Expr<t>: no TypeError arm, cast, unsafe code, or host evaluator.
def eval(-t: Ty, expression: Expr<t>) -> Value(t):
  match expression:
    case NumberExpr{value, eq}:
      %eq : Value(_)
      value
    case BooleanExpr{value, eq}:
      %eq : Value(_)
      value
    case AddExpr{left, right, eq}:
      %eq : Value(_)
      Nat.add(eval(TNumber{}, left), eval(TNumber{}, right))
    case MultiplyExpr{left, right, eq}:
      %eq : Value(_)
      Nat.mul(eval(TNumber{}, left), eval(TNumber{}, right))
    case LessExpr{left, right, eq}:
      %eq : Value(_)
      Nat.is_lt(eval(TNumber{}, left), eval(TNumber{}, right))
    case IfExpr{condition, yes, no}:
      pick(t, eval(TBoolean{}, condition), _ => eval(t, yes), _ => eval(t, no))

type Raw is Data:
  Number{value: Nat}
  Boolean{value: Bool}
  Add{left: Raw, right: Raw}
  Multiply{left: Raw, right: Raw}
  Less{left: Raw, right: Raw}
  If{condition: Raw, yes: Raw, no: Raw}

# Successful elaboration carries an actual indexed expression, not a value.
type Checked is Data:
  CheckedNumber{expression: Expr<TNumber{}>}
  CheckedBoolean{expression: Expr<TBoolean{}>}
  Rejected{message: String}

def checkAdd(left: Checked, right: Checked) -> Checked:
  match left right:
    case Rejected{message} _:
      Rejected{message}
    case _ Rejected{message}:
      Rejected{message}
    case CheckedNumber{left} CheckedNumber{right}:
      CheckedNumber{AddExpr{left, right, {==}}}
    case _ _:
      Rejected{"Add expects two Nat operands"}

def checkMultiply(left: Checked, right: Checked) -> Checked:
  match left right:
    case Rejected{message} _:
      Rejected{message}
    case _ Rejected{message}:
      Rejected{message}
    case CheckedNumber{left} CheckedNumber{right}:
      CheckedNumber{MultiplyExpr{left, right, {==}}}
    case _ _:
      Rejected{"Multiply expects two Nat operands"}

def checkLess(left: Checked, right: Checked) -> Checked:
  match left right:
    case Rejected{message} _:
      Rejected{message}
    case _ Rejected{message}:
      Rejected{message}
    case CheckedNumber{left} CheckedNumber{right}:
      CheckedBoolean{LessExpr{left, right, {==}}}
    case _ _:
      Rejected{"Less expects two Nat operands"}

def checkIf(condition: Checked, yes: Checked, no: Checked) -> Checked:
  match condition yes no:
    case Rejected{message} _ _:
      Rejected{message}
    case _ Rejected{message} _:
      Rejected{message}
    case _ _ Rejected{message}:
      Rejected{message}
    case CheckedNumber{_} _ _:
      Rejected{"If condition must be Bool"}
    case CheckedBoolean{condition} CheckedNumber{yes} CheckedNumber{no}:
      CheckedNumber{IfExpr{condition, yes, no}}
    case CheckedBoolean{condition} CheckedBoolean{yes} CheckedBoolean{no}:
      CheckedBoolean{IfExpr{condition, yes, no}}
    case _ _ _:
      Rejected{"If branches must have the same type"}

# Structural recursion checks the complete tree, including both If branches.
# Only after this succeeds can finish invoke the indexed evaluator.
def elaborate(raw: Raw) -> Checked:
  match raw:
    case Number{value}:
      CheckedNumber{NumberExpr{value, {==}}}
    case Boolean{value}:
      CheckedBoolean{BooleanExpr{value, {==}}}
    case Add{left, right}:
      checkAdd(elaborate(left), elaborate(right))
    case Multiply{left, right}:
      checkMultiply(elaborate(left), elaborate(right))
    case Less{left, right}:
      checkLess(elaborate(left), elaborate(right))
    case If{condition, yes, no}:
      checkIf(elaborate(condition), elaborate(yes), elaborate(no))

# Base already defines Result; RunResult keeps the public constructor names.
type RunResult is Data:
  NumberResult{value: Nat}
  BooleanResult{value: Bool}
  TypeError{message: String}

def finish(checked: Checked) -> RunResult:
  match checked:
    case CheckedNumber{expression}:
      NumberResult{eval(TNumber{}, expression)}
    case CheckedBoolean{expression}:
      BooleanResult{eval(TBoolean{}, expression)}
    case Rejected{message}:
      TypeError{message}

# Public JS seam: run({$: 'Add', left: {$: 'Number', value: 2},
#   right: {$: 'Number', value: 3}}) -> {$: 'NumberResult', value: 5}.
# Raw is reusable; the host retains its input tree. Nat/Bool are JS number/bool.
# This checks object-language typing, not malformed JS objects or input bounds.
# Hosts must supply finite acyclic Raw trees with valid Nat/Bool literal fields.
# Bend 2.0.39 compiled Nat arithmetic stops above 2^48-1 (281474976710655),
# stricter than JS's safe-integer bound. Keep all evaluated intermediates within
# that range; the host owns size/value limits. No arbitrary-precision claim.
def run(+raw: Raw) -> RunResult:
  finish(elaborate(raw))
