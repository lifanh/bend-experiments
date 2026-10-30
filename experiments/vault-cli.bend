# Native smoke demo: bend experiments/vault-cli.bend -o build/vault
# Run build/vault +RTS --threads 1 (or 2). No parallel speedup is claimed.
import Base
import ./vault.bend as V

def print_ledger(label: String, +ledger: V.Ledger) -> IO(Unit):
  match ledger:
    case V.Wallets{left, right}:
      IO.print(label ++ " left=" ++ Nat.show(left) ++ " right=" ++ Nat.show(right)
        ++ " total=" ++ Nat.show(V.total(ledger)))

def print_result(label: String, result: V.TransferResult) -> IO(Unit):
  match result:
    case V.Accepted{ledger}:
      print_ledger(label ++ " Accepted", ledger)
    case V.Rejected{ledger}:
      print_ledger(label ++ " Rejected", ledger)

def main() -> IO(Unit):
  +initial = {V.Wallets{80n, 20n} : V.Ledger}
  +after = V.result_ledger(V.transfer(initial, 25n, True{}))
  do IO<Unit>:
    print_ledger("initial", initial)
    print_result("right 25", V.transfer(initial, 25n, True{}))
    print_result("left 15", V.transfer(initial, 15n, False{}))
    print_result("right exact 80", V.transfer(initial, 80n, True{}))
    print_result("left exact 20", V.transfer(initial, 20n, False{}))
    print_result("right overdraft 81", V.transfer(initial, 81n, True{}))
    print_result("left overdraft 21", V.transfer(initial, 21n, False{}))
    print_result("zero empty", V.transfer(V.Wallets{0n, 0n}, 0n, True{}))
    print_result("UI limit 10000", V.transfer(initial, 10000n, True{}))
    print_result("then left 10", V.transfer(after, 10n, False{}))
    print_result("then reject left 46", V.transfer(after, 46n, False{}))
    print_result("past U32", V.transfer(V.Wallets{4294967295n, 1n}, 1n, False{}))
    print_ledger("unchanged input", initial)
