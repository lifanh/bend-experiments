# Bounded headless CPU/JS comparison; no GPU or custom FFI.
#   bend experiments/garden-cli.bend -o build/garden
#   build/garden +RTS --threads 1
#   build/garden +RTS --threads 2
# The stencil walks are sequential: thread counts check reproducibility,
# not a promised parallel speedup. JS IO build uses .js, renamed to .cjs.
import Base
import ./garden.bend as G

# Checksum = sum(floor(10000*u_i) + (i+1)*floor(10000*v_i));
# quantization is F32 then truncation to Nat. Not a cryptographic hash.
# Sums are also accumulated in F32, in row-major order on both targets.
def diagnostic(cells: List<&2, G.Cell>, +position: Nat,
  sumU: F32, sumV: F32, checksum: Nat, active: Nat) -> String:
  match cells:
    case Nil{}:
      "sum-u=" ++ F32.show(sumU) ++ ", sum-v=" ++ F32.show(sumV)
        ++ ", active(v>0.1)=" ++ Nat.show(active)
        ++ ", checksum=" ++ Nat.show(checksum)
    case G.Chemical{+u, +v} <> rest:
      quantizedU = F32.to_nat((10000.0 * u : F32))
      quantizedV = F32.to_nat((10000.0 * v : F32))
      diagnostic(rest, 1n+position, (sumU + u : F32), (sumV + v : F32),
        Nat.add(checksum, Nat.add(quantizedU, Nat.mul(position, quantizedV))),
        Nat.add(active, Bool.pick(Nat, (v > 0.1 : F32), 1n, 0n)))

def run(+pattern: U32, +feed: F32, +kill: F32) -> String:
  cells = G.advance(1000n, 48n, G.seed(48n, pattern), feed, kill)
  "pattern=" ++ U32.show(pattern) ++ ", feed=" ++ F32.show(feed)
    ++ ", kill=" ++ F32.show(kill) ++ ": "
    ++ diagnostic(cells, 1n, 0.0, 0.0, 0n, 0n)

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Gray-Scott 48x48 / steps=1000 / dt=1 / Du=0.16 / Dv=0.08 / periodic")
    IO.print(run(0, 0.035, 0.062))
    IO.print(run(1, 0.025, 0.06))
    IO.print(run(2, 0.055, 0.062))
