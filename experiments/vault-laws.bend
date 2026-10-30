# Universal specifications over mathematical Nats and the public transition.
# These laws do not assert compiler correctness or validate JavaScript inputs.
import Base
import ./vault.bend as V

law conserves_total:
  for +ledger: V.Ledger
  for amount: Nat
  for toRight: Bool
  {V.total(V.result_ledger(V.transfer(ledger, amount, toRight))) == V.total(ledger) : Nat}

# Success has no rejection obligation; rejection must return the whole input
# ledger, not merely another ledger with the same total.
def UnchangedOnRejection(+before: V.Ledger, result: V.TransferResult) -> Type:
  match result:
    case V.Accepted{_}:
      Unit
    case V.Rejected{after}:
      {after == before : V.Ledger}

law rejection_is_identity:
  for +ledger: V.Ledger
  for amount: Nat
  for toRight: Bool
  UnchangedOnRejection(ledger, V.transfer(ledger, amount, toRight))

law zero_is_accepted:
  for +ledger: V.Ledger
  for toRight: Bool
  {V.transfer(ledger, 0n, toRight) == V.Accepted{ledger} : V.TransferResult}
