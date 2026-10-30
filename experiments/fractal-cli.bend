# Headless CPU demo. Build once, then compare native thread counts:
#   bend experiments/fractal-cli.bend -o /tmp/fractal-cli
#   /tmp/fractal-cli +RTS --threads 1
#   /tmp/fractal-cli +RTS --threads 4
# The checksum is the sum of all escape counts, not a cryptographic hash.
import Base
import ./fractal.bend as F

def sum_counts(counts: List<Nat>, acc: Nat) -> Nat:
  match counts:
    case Nil{}:
      acc
    case Con{count, rest}:
      sum_counts(rest, Nat.add(acc, count))

def checksum(image: F.Raster) -> Nat:
  match image:
    case F.Tile{x, y, size, counts}:
      sum_counts(counts, 0n)
    case F.Quad{tl, tr, bl, br}:
      a b c d = checksum(tl) checksum(tr) checksum(bl) checksum(br)
      Nat.add(Nat.add(a, b), Nat.add(c, d))

def main() -> IO(Unit):
  image = F.render(8n, (0.0 - 0.5 : F32), 0.0, 3.0, 128n,
    False{}, 0.0, 0.0)
  IO.print("Mandelbrot 256x256, iterations=128, checksum=" ++ Nat.show(checksum(image)))
