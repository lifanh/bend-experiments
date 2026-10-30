import Base
import ./vault.bend as V
import ./vault-laws.bend as Laws

# Moving a successor from one addend to the other preserves their sum.
# This is induction over Base.Nat, not a bounded numeric calculation.
def add_successor(+left: Nat, +right: Nat)
  -> {Nat.add(left, 1n+right) == 1n+Nat.add(left, right) : Nat}:
  match left:
    case 0n:
      {==}
    case 1n+rest:
      %add_successor(rest, right) : {1n+Nat.add(rest, 1n+right) == 1n+_ : Nat}
      {==}

# A worker can start at any partial state whose total equals the snapshot.
# Its recursive argument is the remaining amount, so this covers all Nats.
def worker_conserves(amount: Nat, +current: V.Ledger, +original: V.Ledger,
  +toRight: Bool, same: {V.total(current) == V.total(original) : Nat})
  -> {V.total(V.result_ledger(V.transfer.go(amount, current, original, toRight))) == V.total(original) : Nat}:
  match amount:
    case 0n:
      same
    case 1n+rest:
      match current toRight:
        case V.Wallets{0n, _} True{}:
          {==}
        case V.Wallets{1n+left, right} True{}:
          worker_conserves(rest, V.Wallets{left, 1n+right}, original, True{},
            Equal.trans(Nat, Nat.add(left, 1n+right), 1n+Nat.add(left, right), V.total(original),
              add_successor(left, right), same))
        case V.Wallets{_, 0n} False{}:
          {==}
        case V.Wallets{left, 1n+right} False{}:
          worker_conserves(rest, V.Wallets{1n+left, right}, original, False{},
            Equal.trans(Nat, 1n+Nat.add(left, right), Nat.add(left, 1n+right), V.total(original),
              Equal.sym(Nat, Nat.add(left, 1n+right), 1n+Nat.add(left, right),
                add_successor(left, right)), same))

def Laws.conserves_total(ledger, amount, toRight):
  worker_conserves(amount, ledger, ledger, toRight, {==})

def worker_rejects_original(amount: Nat, current: V.Ledger, +original: V.Ledger,
  toRight: Bool)
  -> Laws.UnchangedOnRejection(original, V.transfer.go(amount, current, original, toRight)):
  match amount:
    case 0n:
      Unit{}
    case 1n+rest:
      match current toRight:
        case V.Wallets{0n, _} True{}:
          {==}
        case V.Wallets{1n+left, right} True{}:
          worker_rejects_original(rest, V.Wallets{left, 1n+right}, original, True{})
        case V.Wallets{_, 0n} False{}:
          {==}
        case V.Wallets{left, 1n+right} False{}:
          worker_rejects_original(rest, V.Wallets{1n+left, right}, original, False{})

def Laws.rejection_is_identity(ledger, amount, toRight):
  worker_rejects_original(amount, ledger, ledger, toRight)

def Laws.zero_is_accepted(ledger, toRight):
  {==}
