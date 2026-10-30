# Native CPU demo: bend experiments/sorting-cli.bend -o build/sorting
# Then: build/sorting +RTS --threads 4
import Base
import ./sorting.bend as Sorting

def print_frames(history: List<&2, List<&2, U32>>, +index: U32) -> IO(Unit):
  match history:
    case Nil{}:
      IO.pure(Unit, Unit{})
    case frame <> rest:
      do IO<Unit>:
        IO.print("frame " ++ U32.show(index) ++ "=" ++ List.show(~&2, ~U32, ~U32.show, frame))
        print_frames(rest, U32.add(index, 1))

def demo(+values: List<&2, U32>) -> IO(Unit):
  +sorted = Sorting.sort(values)
  +history = Sorting.frames(values)
  do IO<Unit>:
    IO.print("input=" ++ List.show(~&2, ~U32, ~U32.show, values))
    IO.print("sorted=" ++ List.show(~&2, ~U32, ~U32.show, sorted))
    IO.print("length=" ++ Nat.show(List.length(&2, U32, sorted))
      ++ " frames=" ++ Nat.show(List.length(&2, List<&2, U32>, history)))
    print_frames(history, 0)

def main() -> IO(Unit):
  do IO<Unit>:
    demo([8, 7, 6, 5, 4, 3, 2, 1])
    demo([4294967295, 3, 0, 3, 2147483648])
    demo([])
    demo([7])
