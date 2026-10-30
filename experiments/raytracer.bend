# A fixed three-sphere museum, traced in pure Bend. No assets or host renderer.
import Base

type Vec3 is Data:
  Vec{x: F32, y: F32, z: F32}

def Vec.add(a: Vec3, b: Vec3) -> Vec3:
  Vec{ax, ay, az} = a
  Vec{bx, by, bz} = b
  Vec{(ax + bx : F32), (ay + by : F32), (az + bz : F32)}

def Vec.sub(a: Vec3, b: Vec3) -> Vec3:
  Vec{ax, ay, az} = a
  Vec{bx, by, bz} = b
  Vec{(ax - bx : F32), (ay - by : F32), (az - bz : F32)}

def Vec.scale(a: Vec3, +s: F32) -> Vec3:
  Vec{x, y, z} = a
  Vec{(x * s : F32), (y * s : F32), (z * s : F32)}

def Vec.dot(a: Vec3, b: Vec3) -> F32:
  Vec{ax, ay, az} = a
  Vec{bx, by, bz} = b
  (ax * bx + ay * by + az * bz : F32)

def Sphere.forward(valid: Bool, t: F32) -> F32:
  match valid:
    case True{}:
      t
    case False{}:
      (0.0 - 1.0 : F32)

def Sphere.root(nearValid: Bool, near: F32, +far: F32) -> F32:
  match nearValid:
    case True{}:
      near
    case False{}:
      Sphere.forward((far > 0.001 : F32), far)

def Sphere.discriminant(valid: Bool, +a: F32, +b: F32, discriminant: F32) -> F32:
  match valid:
    case False{}:
      (0.0 - 1.0 : F32)
    case True{}:
      +root = F32.sqrt(discriminant)
      +near = ((0.0 - b - root) / a : F32)
      far = ((0.0 - b + root) / a : F32)
      Sphere.root((near > 0.001 : F32), near, far)

# Public geometry seam: origin + t*direction. Returns nearest t > 0.001,
# or -1 for a miss / behind-camera / zero-direction ray. Direction need not
# be normalized. Tangencies and rays starting inside a sphere are supported.
# Inputs must be finite, radius positive, and magnitudes small enough for F32.
# JS vectors: {$: 'Vec', x, y, z}; scalar arguments/results are JS numbers.
def raySphere(origin: Vec3, +direction: Vec3, center: Vec3, +radius: F32) -> F32:
  +offset = Vec.sub(origin, center)
  +a = Vec.dot(direction, direction)
  +b = Vec.dot(offset, direction)
  c = (Vec.dot(offset, offset) - radius * radius : F32)
  +discriminant = (b * b - a * c : F32)
  Sphere.discriminant((a > 0.0 : F32) && (discriminant >= 0.0 : F32),
    a, b, discriminant)

def Vec.unit(+v: Vec3) -> Vec3:
  Vec.scale(v, (1.0 / F32.sqrt(F32.max(0.0000001, Vec.dot(v, v))) : F32))

def Vec.cross(a: Vec3, b: Vec3) -> Vec3:
  Vec{+ax, +ay, +az} = a
  Vec{+bx, +by, +bz} = b
  Vec{(ay * bz - az * by : F32), (az * bx - ax * bz : F32), (ax * by - ay * bx : F32)}

def Vec.mix(a: Vec3, b: Vec3, +amount: F32) -> Vec3:
  Vec.add(Vec.scale(a, (1.0 - amount : F32)), Vec.scale(b, amount))

type Hit is Data:
  Miss{}
  Surface{t: F32, point: Vec3, normal: Vec3, color: Vec3, mirror: F32}

def Hit.choose(first: Bool, a: Hit, b: Hit) -> Hit:
  match first:
    case True{}:
      a
    case False{}:
      b

def Hit.nearest(a: Hit, b: Hit) -> Hit:
  match a b:
    case Miss{} other:
      other
    case other Miss{}:
      other
    case Surface{+ta, pa, na, ca, ma} Surface{+tb, pb, nb, cb, mb}:
      Hit.choose((ta < tb : F32), Surface{ta, pa, na, ca, ma}, Surface{tb, pb, nb, cb, mb})

def Sphere.surface(valid: Bool, +t: F32, origin: Vec3, direction: Vec3,
  center: Vec3, radius: F32, color: Vec3) -> Hit:
  match valid:
    case False{}:
      Miss{}
    case True{}:
      +point = Vec.add(origin, Vec.scale(direction, t))
      normal = Vec.scale(Vec.sub(point, center), (1.0 / radius : F32))
      Surface{t, point, normal, color, 0.7}

def Sphere.hit(+origin: Vec3, +direction: Vec3, +center: Vec3,
  +radius: F32, color: Vec3) -> Hit:
  +t = raySphere(origin, direction, center, radius)
  Sphere.surface((t > 0.0 : F32), t, origin, direction, center, radius, color)

def Floor.color(dark: Bool) -> Vec3:
  match dark:
    case True{}:
      Vec{0.32, 0.37, 0.38}
    case False{}:
      Vec{0.60, 0.63, 0.61}

def Floor.material(point: Vec3) -> Vec3:
  Vec{x, y, z} = point
  checker = F32.mod(F32.abs((F32.floor(x) + F32.floor(z) : F32)), 2.0)
  Floor.color((checker < 1.0 : F32))

def Floor.surface(valid: Bool, +t: F32, origin: Vec3, direction: Vec3) -> Hit:
  match valid:
    case False{}:
      Miss{}
    case True{}:
      +point = Vec.add(origin, Vec.scale(direction, t))
      Surface{t, point, Vec{0.0, 1.0, 0.0}, Floor.material(point), 0.3}

def Floor.downward(down: Bool, +origin: Vec3, +direction: Vec3) -> Hit:
  match down:
    case False{}:
      Miss{}
    case True{}:
      Vec{ox, oy, oz} = origin
      Vec{dx, dy, dz} = direction
      +t = ((0.0 - oy) / dy : F32)
      Floor.surface((t > 0.001 : F32), t, origin, direction)

def Floor.hit(origin: Vec3, +direction: Vec3) -> Hit:
  Vec{dx, dy, dz} = direction
  Floor.downward((dy < (0.0 - 0.0001 : F32) : F32), origin, direction)

# The scene is fixed and small: no shared scene tree or per-ray traversal.
# Teal/coral/gold centers all rest exactly on the y=0 checker floor.
def Scene.hit(+origin: Vec3, +direction: Vec3) -> Hit:
  teal = Sphere.hit(origin, direction, Vec{(0.0 - 1.2 : F32), 1.0, 0.0},
    1.0, Vec{0.045, 0.52, 0.46})
  coral = Sphere.hit(origin, direction, Vec{1.15, 0.78, 0.55},
    0.78, Vec{0.88, 0.22, 0.14})
  gold = Sphere.hit(origin, direction, Vec{0.45, 0.55, (0.0 - 1.35 : F32)},
    0.55, Vec{0.92, 0.65, 0.12})
  Hit.nearest(Hit.nearest(teal, coral), Hit.nearest(gold, Floor.hit(origin, direction)))

def Sky.color(direction: Vec3) -> Vec3:
  Vec{x, y, z} = direction
  amount = F32.clamp((y * 1.4 + 0.25 : F32), 0.0, 1.0)
  Vec.mix(Vec{0.70, 0.79, 0.83}, Vec{0.18, 0.30, 0.43}, amount)

def Shadow.amount(blocked: Bool) -> F32:
  match blocked:
    case True{}:
      0.0
    case False{}:
      1.0

def Shadow.hit(hit: Hit, distance: F32) -> F32:
  match hit:
    case Miss{}:
      1.0
    case Surface{t, point, normal, color, mirror}:
      Shadow.amount((t < distance : F32))

# Offset secondary rays off the surface and reject blockers beyond the light.
def Shadow.visibility(enabled: Bool, point: Vec3, normal: Vec3, light: Vec3) -> F32:
  match enabled:
    case False{}:
      1.0
    case True{}:
      +start = Vec.add(point, Vec.scale(normal, 0.003))
      +delta = Vec.sub(light, start)
      distance = F32.sqrt(Vec.dot(delta, delta))
      Shadow.hit(Scene.hit(start, Vec.unit(delta)), distance)

def Shade.local(+point: Vec3, +normal: Vec3, color: Vec3,
  direction: Vec3, +light: Vec3, shadows: Bool) -> Vec3:
  +visibility = Shadow.visibility(shadows, point, normal, light)
  +towardLight = Vec.unit(Vec.sub(light, point))
  diffuse = F32.max(0.0, Vec.dot(normal, towardLight))
  halfVector = Vec.unit(Vec.sub(towardLight, direction))
  +specular = (visibility * 0.65 * F32.pow(F32.max(0.0, Vec.dot(normal, halfVector)), 48.0) : F32)
  Vec.add(Vec.scale(color, (0.17 + visibility * 0.83 * diffuse : F32)), Vec{specular, specular, specular})

def Trace.budget(reflective: Bool) -> Nat:
  match reflective:
    case False{}:
      0n
    case True{}:
      2n

# At most two reflected rays after the primary ray. The last surface receives
# direct lighting, rather than black. Nat fuel decreases on every bounce.
def Trace.color(fuel: Nat, hit: Hit, +direction: Vec3, +light: Vec3,
  +reflectivity: F32, +shadows: Bool) -> Vec3:
  match fuel hit:
    case _ Miss{}:
      Sky.color(direction)
    case 0n Surface{t, point, normal, color, mirror}:
      Shade.local(point, normal, color, direction, light, shadows)
    case 1n+rest Surface{t, +point, +normal, color, mirror}:
      local = Shade.local(point, normal, color, direction, light, shadows)
      +reflectedDirection = Vec.unit(Vec.sub(direction,
        Vec.scale(normal, (2.0 * Vec.dot(direction, normal) : F32))))
      start = Vec.add(point, Vec.scale(normal, 0.003))
      reflected = Trace.color(rest, Scene.hit(start, reflectedDirection),
        reflectedDirection, light, reflectivity, shadows)
      Vec.mix(local, reflected, (mirror * reflectivity : F32))

def Color.channel(value: F32) -> U32:
  F32.to_u32((255.0 * F32.sqrt(F32.clamp(value, 0.0, 1.0)) + 0.5 : F32))

def Color.pack(color: Vec3) -> U32:
  Vec{r, g, b} = color
  (Color.channel(r) * 65536 + Color.channel(g) * 256 + Color.channel(b) : U32)

type Camera is Data:
  View{origin: Vec3, forward: Vec3, right: Vec3, up: Vec3}

def Camera.make(+angle: F32) -> Camera:
  +origin = {Vec{(6.8 * F32.sin(angle) : F32), 2.65, (6.8 * F32.cos(angle) : F32)} : Vec3}
  +forward = Vec.unit(Vec.sub(Vec{0.0, 0.8, 0.0}, origin))
  +right = Vec.unit(Vec.cross(forward, Vec{0.0, 1.0, 0.0}))
  up = Vec.cross(right, forward)
  View{origin, forward, right, up}

def Camera.sample(u: F32, v: F32, camera: Camera, light: Vec3,
  +reflectivity: F32, shadows: Bool) -> U32:
  View{+origin, forward, right, up} = camera
  +direction = Vec.unit(Vec.add(forward,
    Vec.add(Vec.scale(right, (u * 0.52 : F32)), Vec.scale(up, (v * 0.52 : F32)))))
  Color.pack(Trace.color(Trace.budget((reflectivity > 0.0 : F32)),
    Scene.hit(origin, direction), direction, light, reflectivity, shadows))

# Public single-ray sampler: u/v in [-1,1], x right and y up, image center 0/0.
# Useful for validating tile placement without duplicating a renderer in JS.
def sample(u: F32, v: F32, camera: F32, light: F32,
  reflectivity: F32, shadows: Bool) -> U32:
  Camera.sample(u, v, Camera.make(camera), Vec{light, 6.0, 4.0},
    F32.clamp(reflectivity, 0.0, 1.0), shadows)

# JS shape: {$:'Quad',tl,tr,bl,br} or {$:'Tile',x,y,size,pixels}.
# pixels is row-major *within this tile*: {$:'Con',head:<0xRRGGBB>,tail:...}
# ending in {$:'Nil'}. Place entry i at (x+i%size,y+floor(i/size)).
type Raster is Type:
  Tile{x: Nat, y: Nat, size: Nat, pixels: List<U32>}
  Quad{tl: Raster, tr: Raster, bl: Raster, br: Raster}

def Tile.row(fuel: Nat, +x: Nat, +v: F32, +step: F32, +camera: Camera,
  +light: Vec3, +reflectivity: F32, +shadows: Bool, pixels: List<U32>) -> List<U32>:
  match fuel:
    case 0n:
      pixels
    case 1n+rest:
      u = ((F32.from_nat(x) + 0.5) * step - 1.0 : F32)
      pixel = Camera.sample(u, v, camera, light, reflectivity, shadows)
      Tile.row(rest, 1n+x, v, step, camera, light, reflectivity, shadows, pixel <> pixels)

def Tile.rows(fuel: Nat, +size: Nat, +x: Nat, +y: Nat, +step: F32,
  +camera: Camera, +light: Vec3, +reflectivity: F32, +shadows: Bool,
  pixels: List<U32>) -> List<U32>:
  match fuel:
    case 0n:
      List.reverse(&1, U32, pixels)
    case 1n+rest:
      v = (1.0 - (F32.from_nat(y) + 0.5) * step : F32)
      row = Tile.row(size, x, v, step, camera, light, reflectivity, shadows, pixels)
      Tile.rows(rest, size, x, 1n+y, step, camera, light, reflectivity, shadows, row)

# Balanced spatial forks, tail-recursive row loops at <=8x8 leaves. Reflection
# recursion is bounded but non-tail; this CPU implementation does not use !.
# Per-ray hit counts differ, so equal regions do not promise identical runtime.
def Render.tree(depth: Nat, +size: Nat, +x: Nat, +y: Nat, +step: F32,
  +camera: Camera, +light: Vec3, +reflectivity: F32, +shadows: Bool) -> Raster:
  match depth:
    case 0n:
      Tile{x, y, size, Tile.rows(size, size, x, y, step, camera, light, reflectivity, shadows, [])}
    case 1n++rest:
      +half = Nat.div(size, 2n)
      +right = Nat.add(x, half)
      +bottom = Nat.add(y, half)
      tl tr bl br =
        Render.tree(rest, half, x, y, step, camera, light, reflectivity, shadows)
        Render.tree(rest, half, right, y, step, camera, light, reflectivity, shadows)
        Render.tree(rest, half, x, bottom, step, camera, light, reflectivity, shadows)
        Render.tree(rest, half, right, bottom, step, camera, light, reflectivity, shadows)
      Quad{tl, tr, bl, br}

# Public renderer: 2^depth square, pixel-center samples, packed gamma-corrected
# RGB without alpha. Camera is an orbit angle in radians around the y axis;
# 0 looks from +z, positive rotates toward +x. Recommended camera -0.8..0.8,
# light -6..6 (point-light x; fixed y=6,z=4), reflectivity 0..1 (clamped).
# Finite controls only. Suggested depth 5..8; caller must bound memory/time.
def render(+depth: Nat, camera: F32, light: F32,
  reflectivity: F32, shadows: Bool) -> Raster:
  +size = Nat.pow(2n, depth)
  step = (2.0 / F32.from_nat(size) : F32)
  Render.tree(Nat.sub(depth, 3n), size, 0n, 0n, step, Camera.make(camera),
    Vec{light, 6.0, 4.0}, F32.clamp(reflectivity, 0.0, 1.0), shadows)
