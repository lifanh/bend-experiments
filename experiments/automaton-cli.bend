import Base
import ./automaton.bend as A

def seed(n: Nat, +index: U32) -> List<&2, A.Cell>:
  match n:
    case 0n:
      Nil{}
    case 1n+p:
      A.Cell{False{}, U32.is_eq(index, 64)} <> seed(p, (index + 1 : U32))

def same(a: List<&2, A.Cell>, b: List<&2, A.Cell>) -> Bool:
  match a b:
    case Nil{} Nil{}:
      True{}
    case Con{A.Cell{p, n}, rest} Con{A.Cell{q, m}, tail}:
      Bool.not(Bool.xor(p, q)) && Bool.not(Bool.xor(n, m)) && same(rest, tail)
    case _ _:
      False{}

def main() -> IO(Unit):
  +initial = seed(128n, 0)
  result = same(initial, A.rewind(1000n, A.travel(1000n, initial)))
  IO.print("128 cells / 1000 steps forward + 1000 backward / restored: " ++ Bool.show(result))
