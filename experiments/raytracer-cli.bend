# Fixed, bounded headless CPU render with a modulo-2^32 RGB checksum.
#   bend experiments/raytracer-cli.bend -o build/raytracer
#   build/raytracer +RTS --threads 1
#   build/raytracer +RTS --threads 4
import Base
import ./raytracer.bend as R

def sum_pixels(pixels: List<U32>, acc: U32) -> U32:
  match pixels:
    case Nil{}:
      acc
    case Con{pixel, rest}:
      sum_pixels(rest, (acc + pixel : U32))

def checksum(image: R.Raster) -> U32:
  match image:
    case R.Tile{x, y, size, pixels}:
      sum_pixels(pixels, 0)
    case R.Quad{tl, tr, bl, br}:
      a b c d = checksum(tl) checksum(tr) checksum(bl) checksum(br)
      (a + b + c + d : U32)

def main() -> IO(Unit):
  image = R.render(7n, 0.0, (0.0 - 3.0 : F32), 0.6, True{})
  IO.print("Marble museum 128x128, camera=0, light=-3, reflectivity=0.6, shadows=on, checksum="
    ++ U32.show(checksum(image)))
