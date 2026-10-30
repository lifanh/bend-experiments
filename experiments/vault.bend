# Exact Nat transfers: no fees, minting, burning, or U32 arithmetic.
# JS boundary: Wallets is {$: "Wallets", left: number, right: number};
# results are {$: "Accepted" | "Rejected", ledger: Wallets}.
# Callers must validate nonnegative safe integer balances and amount, a
# boolean direction, and left+right <= 281474976710655 (2^48-1): Bend 2.0.39
# uses bounded immediate Nats at runtime, in JS as well as native code. This
# is stricter than Number.MAX_SAFE_INTEGER. Nested record fields are NOT
# validated by the generated JS wrapper. The UI bounds amount to 10000 and
# starts at (80,20). Invalid JS values are outside this typed API, not
# overdrafts. Work is O(min(amount, source balance)); use bounded requests.
# The universal laws describe Bend Nats, not unchecked JS numbers or a proof
# of the compiler/runtime. No equality evidence is stored in the JS records.
import Base

type Ledger is Data:
  Wallets{left: Nat, right: Nat}

type TransferResult is Data:
  Accepted{ledger: Ledger}
  Rejected{ledger: Ledger}

def total(ledger: Ledger) -> Nat:
  match ledger:
    case Wallets{left, right}:
      Nat.add(left, right)

def result_ledger(result: TransferResult) -> Ledger:
  match result:
    case Accepted{ledger}:
      ledger
    case Rejected{ledger}:
      ledger

# Move one token at a time, retaining the original snapshot for rollback.
# amount is first so the recursive call is structurally decreasing.
def transfer.go(amount: Nat, current: Ledger, original: Ledger,
  toRight: Bool) -> TransferResult:
  match amount:
    case 0n:
      Accepted{current}
    case 1n+rest:
      match current toRight:
        case Wallets{0n, _} True{}:
          Rejected{original}
        case Wallets{1n+left, right} True{}:
          transfer.go(rest, Wallets{left, 1n+right}, original, True{})
        case Wallets{_, 0n} False{}:
          Rejected{original}
        case Wallets{left, 1n+right} False{}:
          transfer.go(rest, Wallets{1n+left, right}, original, False{})

# True moves left -> right; False moves right -> left. Zero always succeeds.
# Rejection is atomic even when the recursive worker already moved tokens.
def transfer(+ledger: Ledger, amount: Nat, toRight: Bool) -> TransferResult:
  transfer.go(amount, ledger, ledger, toRight)
