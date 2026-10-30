# Native CPU demo: bend experiments/interpreter-cli.bend -o build/interpreter
# Then: build/interpreter +RTS --threads 4
import Base
import ./interpreter.bend as Interpreter

def show(result: Interpreter.RunResult) -> String:
  match result:
    case Interpreter.NumberResult{value}:
      "Nat " ++ Nat.show(value)
    case Interpreter.BooleanResult{value}:
      "Bool " ++ Bool.show(value)
    case Interpreter.TypeError{message}:
      "TypeError: " ++ message

def report(label: String, raw: Interpreter.Raw) -> IO(Unit):
  IO.print(label ++ "=" ++ show(Interpreter.run(raw)))

def main() -> IO(Unit):
  +shared = {Interpreter.Add{Interpreter.Number{3n}, Interpreter.Number{4n}} : Interpreter.Raw}
  do IO<Unit>:
    report("arithmetic", Interpreter.Add{Interpreter.Number{2n},
      Interpreter.Multiply{Interpreter.Number{3n}, Interpreter.Number{4n}}})
    report("numeric-if", Interpreter.If{
      Interpreter.Less{Interpreter.Number{3n}, Interpreter.Number{5n}},
      Interpreter.Multiply{Interpreter.Number{6n}, Interpreter.Number{7n}}, Interpreter.Number{0n}})
    report("boolean-if", Interpreter.If{
      Interpreter.Less{Interpreter.Number{1n}, Interpreter.Number{2n}},
      Interpreter.Less{Interpreter.Number{4n}, Interpreter.Number{5n}}, Interpreter.Boolean{False{}}})
    report("else-if", Interpreter.If{Interpreter.Boolean{False{}}, Interpreter.Number{7n}, Interpreter.Number{9n}})
    report("bad-add", Interpreter.Add{Interpreter.Boolean{True{}}, Interpreter.Number{1n}})
    report("bad-condition", Interpreter.If{Interpreter.Number{1n}, Interpreter.Number{7n}, Interpreter.Number{9n}})
    report("mixed-branches", Interpreter.If{Interpreter.Boolean{True{}}, Interpreter.Number{7n}, Interpreter.Boolean{False{}}})
    report("unchosen-bad-no", Interpreter.If{Interpreter.Boolean{True{}}, Interpreter.Number{7n},
      Interpreter.Add{Interpreter.Boolean{True{}}, Interpreter.Number{1n}}})
    report("unchosen-bad-yes", Interpreter.If{Interpreter.Boolean{False{}},
      Interpreter.Multiply{Interpreter.Boolean{False{}}, Interpreter.Number{1n}}, Interpreter.Number{9n}})
    report("reused-first", shared)
    report("reused-second", shared)
