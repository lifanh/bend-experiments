# Softened Newtonian gravity in 2D. G=1; all physics stays in Bend.
# Body and List<&2, Body> are reusable values; steps never mutate the input.
# JS: {$: 'Body', mass, x, y, vx, vy}, with ordinary number fields;
# lists: {$: 'Con', head: body, tail: list} ending in {$: 'Nil'}.
# Bool arguments are JS false/true, Nat budgets are nonnegative integers.
# Inputs must be finite, masses positive, and steps bounded by the caller.
# Arithmetic is F32: extreme magnitudes/overflow are unsupported. Softening
# removes the collision singularity, not timestep error or close-encounter
# stiffness. No collisions/mergers, adaptive stepping, or physical units.
# Suggested preset dt: 0.005..0.02; large dt deliberately exposes instability.
import Base

type Body is Data:
  Body{mass: F32, x: F32, y: F32, vx: F32, vy: F32}

# Plummer softening epsilon=0.05: force and potential share this distance.
# a_i = sum_j m_j (r_j-r_i) / (|r_j-r_i|^2 + epsilon^2)^(3/2).
# The self term has zero displacement, hence zero acceleration.
def distance(+dx: F32, +dy: F32) -> F32:
  F32.sqrt((dx * dx + dy * dy + 0.0025 : F32))

def Force.sum(bodies: List<&2, Body>, +x: F32, +y: F32,
  ax: F32, ay: F32) -> F32 & F32:
  match bodies:
    case Nil{}:
      (ax, ay)
    case Con{Body{mass, bx, by, _, _}, rest}:
      +dx = (bx - x : F32)
      +dy = (by - y : F32)
      +r = distance(dx, dy)
      +scale = (mass / (r * r * r) : F32)
      Force.sum(rest, x, y, (ax + scale * dx : F32), (ay + scale * dy : F32))

def Euler.apply(force: F32 & F32, mass: F32, x: F32, y: F32,
  +vx: F32, +vy: F32, +dt: F32) -> Body:
  (ax, ay) = force
  Body{mass, (x + dt * vx : F32), (y + dt * vy : F32),
    (vx + dt * ax : F32), (vy + dt * ay : F32)}

def Body.euler(body: Body, all: List<&2, Body>, +dt: F32) -> Body:
  match body:
    case Body{mass, +x, +y, +vx, +vy}:
      Euler.apply(Force.sum(all, x, y, 0.0, 0.0), mass, x, y, vx, vy, dt)

# Two equal-cost body updates fork at a time; each scans the same snapshot.
# The outer list traversal is sequential, not a balanced all-body task tree.
# For these 2-3 body presets, task overhead may dominate any CPU speedup.
# The JavaScript target evaluates parallel calls sequentially.
def Euler.map(bodies: List<&2, Body>, +all: List<&2, Body>,
  +dt: F32) -> List<&2, Body>:
  match bodies:
    case Nil{}:
      Nil{}
    case Con{a, Nil{}}:
      [Body.euler(a, all, dt)]
    case Con{a, Con{b, rest}}:
      first second = Body.euler(a, all, dt) Body.euler(b, all, dt)
      first <> second <> Euler.map(rest, all, dt)

def Verlet.finish(drift: Bool, mass: F32, x: F32, y: F32,
  +vx: F32, +vy: F32, +dt: F32) -> Body:
  match drift:
    case True{}:
      Body{mass, (x + dt * vx : F32), (y + dt * vy : F32), vx, vy}
    case False{}:
      Body{mass, x, y, vx, vy}

def Verlet.apply(force: F32 & F32, mass: F32, x: F32, y: F32,
  vx: F32, vy: F32, +dt: F32, drift: Bool) -> Body:
  (ax, ay) = force
  +half = (0.5 * dt : F32)
  Verlet.finish(drift, mass, x, y, (vx + half * ax : F32),
    (vy + half * ay : F32), dt)

def Body.verlet(body: Body, all: List<&2, Body>, dt: F32, drift: Bool) -> Body:
  match body:
    case Body{mass, +x, +y, vx, vy}:
      Verlet.apply(Force.sum(all, x, y, 0.0, 0.0), mass, x, y, vx, vy, dt, drift)

def Verlet.map(bodies: List<&2, Body>, +all: List<&2, Body>,
  +dt: F32, +drift: Bool) -> List<&2, Body>:
  match bodies:
    case Nil{}:
      Nil{}
    case Con{a, Nil{}}:
      [Body.verlet(a, all, dt, drift)]
    case Con{a, Con{b, rest}}:
      first second = Body.verlet(a, all, dt, drift) Body.verlet(b, all, dt, drift)
      first <> second <> Verlet.map(rest, all, dt, drift)

def Step.select(zero: Bool, +bodies: List<&2, Body>, +dt: F32,
  verlet: Bool) -> List<&2, Body>:
  match zero verlet:
    case True{} _:
      bodies
    case False{} False{}:
      Euler.map(bodies, bodies, dt)
    case False{} True{}:
      +moved = Verlet.map(bodies, bodies, dt, True{})
      Verlet.map(moved, moved, dt, False{})

# false: explicit Euler, NOT semi-implicit/symplectic Euler.
# true: velocity Verlet, half kick / full drift / half kick.
# Every force pass sees one complete snapshot, never partly updated bodies.
# dt=0 returns the input untouched; negative dt permits backward stepping.
def step(bodies: List<&2, Body>, +dt: F32, verlet: Bool) -> List<&2, Body>:
  Step.select(F32.is_eq(dt, 0.0), bodies, dt, verlet)

def advance(steps: Nat, bodies: List<&2, Body>, +dt: F32,
  +verlet: Bool) -> List<&2, Body>:
  match steps:
    case 0n:
      bodies
    case 1n+rest:
      advance(rest, step(bodies, dt, verlet), dt, verlet)

def Potential.sum(bodies: List<&2, Body>, +mass: F32, +x: F32, +y: F32,
  acc: F32) -> F32:
  match bodies:
    case Nil{}:
      acc
    case Con{Body{otherMass, bx, by, _, _}, rest}:
      potential = (mass * otherMass / distance((bx - x : F32), (by - y : F32)) : F32)
      Potential.sum(rest, mass, x, y, (acc - potential : F32))

# E = sum_i m_i |v_i|^2/2 - sum_{i<j} m_i*m_j/sqrt(r_ij^2+epsilon^2).
# Only the tail contributes potential: no self energy or double counting.
def energy(bodies: List<&2, Body>) -> F32:
  match bodies:
    case Nil{}:
      0.0
    case Con{Body{+mass, x, y, +vx, +vy}, +rest}:
      kinetic = (0.5 * mass * (vx * vx + vy * vy) : F32)
      potential = Potential.sum(rest, mass, x, y, 0.0)
      (kinetic + potential + energy(rest) : F32)

# Circular relative speed for the same softened force, not an unsoftened
# Kepler speed. Binary positions and velocities are barycentric.
def Orbit.speed(totalMass: F32, +separation: F32) -> F32:
  +r = distance(separation, 0.0)
  F32.sqrt((totalMass * separation * separation / (r * r * r) : F32))

def Preset.binary(+m1: F32, +m2: F32, +separation: F32) -> List<&2, Body>:
  +total = (m1 + m2 : F32)
  +speed = Orbit.speed(total, separation)
  +left = (m2 / total : F32)
  +right = (m1 / total : F32)
  [Body{m1, (0.0 - left * separation : F32), 0.0, 0.0, (0.0 - left * speed : F32)},
   Body{m2, (right * separation : F32), 0.0, 0.0, (right * speed : F32)}]

def Preset.select(sun: Bool, three: Bool) -> List<&2, Body>:
  match sun three:
    case True{} _:
      Preset.binary(10.0, 0.01, 2.0)
    case False{} True{}:
      +inner = Orbit.speed(10.0, 1.0)
      +outer = Orbit.speed(10.0, 3.0)
      # Two small planets with separated orbits; sun recoil cancels momentum.
      # Their mutual perturbation is real: this is not an exact periodic orbit.
      [Body{10.0, 0.0, 0.0, 0.0, (0.001 * (outer - inner) : F32)},
       Body{0.01, 1.0, 0.0, 0.0, inner},
       Body{0.01, (0.0 - 3.0 : F32), 0.0, 0.0, (0.0 - outer : F32)}]
    case False{} False{}:
      Preset.binary(1.0, 1.0, 2.0)

# 0: equal-mass circular binary (x=+-1); 1: sun+planet; 2: three-body system.
# Unknown U32 indices select 0. All have approximately zero total momentum.
def preset(+index: U32) -> List<&2, Body>:
  Preset.select(U32.is_eq(index, 1), U32.is_eq(index, 2))
