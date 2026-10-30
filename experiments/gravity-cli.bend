# Fixed, bounded CPU comparison; no GPU, custom FFI, or unsafe recursion.
#   bend experiments/gravity-cli.bend -o /tmp/gravity-cli
#   /tmp/gravity-cli +RTS --threads 1
#   /tmp/gravity-cli +RTS --threads 4
# Diagnostics describe the final state, not the maximum drift along the path.
import Base
import ./gravity.bend as G

def first_position(bodies: List<&2, G.Body>) -> String:
  match bodies:
    case Nil{}:
      "empty"
    case Con{G.Body{_, x, y, _, _}, _}:
      "(" ++ F32.show(x) ++ ", " ++ F32.show(y) ++ ")"

def diagnostic(label: String, +initialEnergy: F32, +bodies: List<&2, G.Body>) -> String:
  +finalEnergy = G.energy(bodies)
  drift = (F32.abs((finalEnergy - initialEnergy : F32)) / F32.abs(initialEnergy) : F32)
  label ++ ": energy=" ++ F32.show(finalEnergy)
    ++ ", relative-drift=" ++ F32.show(drift)
    ++ ", first-position=" ++ first_position(bodies)

def main() -> IO(Unit):
  +initial = G.preset(0)
  +initialEnergy = G.energy(initial)
  euler = G.advance(2000n, initial, 0.02, False{})
  verlet = G.advance(2000n, initial, 0.02, True{})
  do IO<Unit>:
    IO.print("Binary / G=1 / epsilon=0.05 / steps=2000 / dt=0.02 / initial-energy="
      ++ F32.show(initialEnergy))
    IO.print(diagnostic("Explicit Euler", initialEnergy, euler))
    IO.print(diagnostic("Velocity Verlet", initialEnergy, verlet))
