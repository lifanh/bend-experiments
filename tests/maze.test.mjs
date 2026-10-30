import test from 'node:test';
import assert from 'node:assert/strict';
import Maze from '../dist/bend/maze.mjs';

const list = values => values.reduceRight((tail, head) => ({ $: 'Con', head, tail }), { $: 'Nil' });
function array(values) {
  const result = [];
  while (values.$ === 'Con') {
    result.push(values.head);
    values = values.tail;
  }
  assert.equal(values.$, 'Nil');
  return result;
}

// Independent graph interpretation: only reciprocal, in-bounds openings count.
function neighbors(size, cells, index) {
  const x = index % size, y = Math.floor(index / size);
  return [[y > 0, index - size, 1, 4], [x + 1 < size, index + 1, 2, 8],
    [y + 1 < size, index + size, 4, 1], [x > 0, index - 1, 8, 2]]
    .filter(([inside, next, bit, opposite]) => inside && (cells[index] & bit) && (cells[next] & opposite))
    .map(([, next]) => next);
}

function checkGraph(size, cells) {
  assert.equal(cells.length, size * size);
  let edges = 0;
  for (let i = 0; i < cells.length; i++) {
    assert.ok(Number.isInteger(cells[i]) && cells[i] >= 0 && cells[i] <= 15);
    const x = i % size, y = Math.floor(i / size);
    for (const [bit, inside, next, opposite] of [
      [1, y > 0, i - size, 4], [2, x + 1 < size, i + 1, 8],
      [4, y + 1 < size, i + size, 1], [8, x > 0, i - 1, 2],
    ]) {
      if (!(cells[i] & bit)) continue;
      assert.ok(inside, `boundary leak at ${i}, bit ${bit}`);
      assert.ok(cells[next] & opposite, `nonreciprocal passage ${i} -> ${next}`);
      edges++;
    }
  }
  const seen = new Set(cells.length ? [0] : []), pending = [...seen];
  for (const current of pending) for (const next of neighbors(size, cells, current)) {
    if (!seen.has(next)) { seen.add(next); pending.push(next); }
  }
  assert.equal(seen.size, cells.length, 'every cell is connected');
  return edges / 2;
}

test('Maze: seeded generation produces varied, reciprocal spanning trees without boundary leaks', () => {
  const fingerprints = new Set();
  for (const size of [0, 1, 2, 3, 5, 12, 16]) {
    for (const seed of [0, 1, 2, 3, 7, 42, 127, 255, 0x7fffffff, 0x80000000, 0xffffffff]) {
      const cells = array(Maze.generate(size, seed, false));
      assert.equal(checkGraph(size, cells), Math.max(0, size * size - 1), 'connected + V-1 edges is a tree');
      assert.deepEqual(array(Maze.generate(size, seed, false)), cells, 'same seed is repeatable');
      if (size === 12) fingerprints.add(cells.join(','));
    }
  }
  assert.ok(fingerprints.size >= 9, 'seed materially changes the layout');
  assert.deepEqual(array(Maze.generate(0, 0, false)), []);
  assert.deepEqual(array(Maze.generate(1, 0, false)), [0]);
});

function result(size, cells, start, goal, depthFirst = false) {
  const found = Maze.search(size, list(cells), start, goal, depthFirst);
  assert.equal(found.$, 'Search');
  return { path: array(found.path), visited: array(found.visited) };
}

test('Maze: BFS expands a FIFO frontier, returns a shortest path and stops on goal expansion', () => {
  // Fully open 3x3: several shortest routes exist; N,E,S,W breaks ties.
  const cells = [6, 14, 12, 7, 15, 13, 3, 11, 9];
  assert.deepEqual(result(3, cells, 0, 8), {
    path: [0, 1, 2, 5, 8], visited: [0, 1, 3, 2, 4, 6, 5, 7, 8],
  });
  assert.deepEqual(result(3, cells, 0, 3), { path: [0, 3], visited: [0, 1, 3] });
  assert.deepEqual(result(3, cells, 4, 4), { path: [4], visited: [4] });
  assert.deepEqual(result(2, [2, 8, 2, 8], 0, 3), { path: [], visited: [0, 1] });
  assert.deepEqual(result(2, [2, 0, 0, 0], 0, 1), { path: [], visited: [0] },
    'one-sided openings are walls, not directed passages');
});

test('Maze: DFS follows one branch before its siblings, backtracks, and need not be shortest', () => {
  const cells = [6, 14, 12, 7, 15, 13, 3, 11, 9];
  const dfs = result(3, cells, 0, 6, true);
  assert.deepEqual(dfs, {
    path: [0, 1, 2, 5, 8, 7, 4, 3, 6], visited: [0, 1, 2, 5, 8, 7, 4, 3, 6],
  });
  assert.deepEqual(result(3, cells, 0, 6).path, [0, 3, 6]);
  assert.deepEqual(result(2, [6, 8, 3, 8], 0, 3, true), {
    path: [0, 2, 3], visited: [0, 1, 2, 3],
  }, 'dead ends remain in the expansion trace, not in the final route');
});

test('Maze: optional loops only add reciprocal passages and guarantee a cycle for size >= 2', () => {
  for (const size of [0, 1, 2, 3, 5, 12, 16]) for (let seed = 0; seed < 32; seed++) {
    const tree = array(Maze.generate(size, seed, false));
    const loopy = array(Maze.generate(size, seed, true));
    const edges = checkGraph(size, loopy);
    assert.deepEqual(array(Maze.generate(size, seed, true)), loopy);
    for (let i = 0; i < tree.length; i++) assert.equal(loopy[i] & tree[i], tree[i], 'no tree edge is removed');
    if (size < 2) assert.deepEqual(loopy, tree);
    else assert.ok(edges >= size * size, 'at least one extra edge creates a cycle');
  }
});

test('Maze: size/endpoints/length guards are explicit, while boundary and high mask bits are ignored', () => {
  const empty = { path: [], visited: [] };
  for (const depthFirst of [false, true]) {
    assert.deepEqual(result(0, [], 0, 0, depthFirst), empty);
    assert.deepEqual(result(1, [0], 0, 0, depthFirst), { path: [0], visited: [0] });
    for (const [start, goal] of [[4, 0], [0, 4], [0xffffffff, 1], [0, 0xffffffff]]) {
      assert.deepEqual(result(2, [6, 12, 3, 9], start, goal, depthFirst), empty);
    }
    for (const cells of [[], [6], [6, 12, 3], [6, 12, 3, 9, 0]]) {
      assert.deepEqual(result(2, cells, 0, 3, depthFirst), empty, 'reject wrong-length maps');
    }
    assert.deepEqual(result(33, [], 0, 0, depthFirst), empty);
    assert.deepEqual(result(2, [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff], 0, 3, depthFirst),
      result(2, [6, 12, 3, 9], 0, 3, depthFirst));
  }
  for (const loops of [false, true]) assert.deepEqual(array(Maze.generate(33, 42, loops)), []);
  const largest = array(Maze.generate(32, 42, false));
  assert.equal(checkGraph(32, largest), 1023, 'the documented upper bound is supported');
});

// Floyd-Warshall is deliberately not the queue/stack algorithm used by Bend.
function distances(size, cells) {
  const d = cells.map((_, i) => cells.map((_, j) => i === j ? 0 : Infinity));
  cells.forEach((_, i) => neighbors(size, cells, i).forEach(j => { d[i][j] = 1; }));
  for (let k = 0; k < cells.length; k++) for (let i = 0; i < cells.length; i++) {
    for (let j = 0; j < cells.length; j++) d[i][j] = Math.min(d[i][j], d[i][k] + d[k][j]);
  }
  return d;
}

// A recursive walk is an independent oracle for the iterative DFS frontier.
function recursiveDFS(size, cells, start, goal) {
  const seen = new Set(), visited = [];
  function walk(current, trail) {
    seen.add(current);
    visited.push(current);
    const path = [...trail, current];
    if (current === goal) return path;
    for (const next of neighbors(size, cells, current)) {
      if (seen.has(next)) continue;
      const found = walk(next, path);
      if (found) return found;
    }
    return null;
  }
  return { path: walk(start, []) ?? [], visited };
}

function checkSearch(size, cells, start, goal, d) {
  const bfs = result(size, cells, start, goal), dfs = result(size, cells, start, goal, true);
  for (const found of [bfs, dfs]) {
    assert.equal(new Set(found.visited).size, found.visited.length, 'expand a cell at most once');
    assert.equal(found.visited[0], start);
    assert.ok(found.visited.every(i => i >= 0 && i < cells.length));
    assert.equal(new Set(found.path).size, found.path.length, 'route contains no repeated vertex');
    if (found.path.length) {
      assert.equal(found.path[0], start);
      assert.equal(found.path.at(-1), goal);
      assert.equal(found.visited.at(-1), goal, 'stop exactly when the goal expands');
      for (let i = 1; i < found.path.length; i++) {
        assert.ok(neighbors(size, cells, found.path[i - 1]).includes(found.path[i]), 'every route step is a real passage');
      }
      assert.ok(found.path.every(i => found.visited.includes(i)));
    }
  }
  assert.deepEqual(dfs, recursiveDFS(size, cells, start, goal), 'true recursive DFS behavior, not reversed BFS');
  const shortest = d[start][goal];
  assert.equal(bfs.path.length, Number.isFinite(shortest) ? shortest + 1 : 0, 'independent all-pairs shortest distance');
  for (let i = 1; i < bfs.visited.length; i++) {
    assert.ok(d[start][bfs.visited[i - 1]] <= d[start][bfs.visited[i]], 'BFS expands in nondecreasing distance');
  }
  for (let i = 0; i < cells.length; i++) {
    if (d[start][i] < shortest) assert.ok(bfs.visited.includes(i), 'complete all earlier layers');
  }
  if (!Number.isFinite(shortest)) {
    const reachable = cells.map((_, i) => i).filter(i => Number.isFinite(d[start][i]));
    for (const found of [bfs, dfs]) {
      assert.deepEqual([...found.visited].sort((a, b) => a - b), reachable, 'unreachable exhausts the component');
    }
  }
}

test('Maze: all 4096 reciprocal 3x3 grid graphs agree with independent shortest-distance and recursive DFS oracles', () => {
  const edges = [];
  for (let i = 0; i < 9; i++) {
    if (i % 3 < 2) edges.push([i, i + 1, 2, 8]);
    if (i < 6) edges.push([i, i + 3, 4, 1]);
  }
  for (let code = 0; code < 2 ** edges.length; code++) {
    const cells = Array(9).fill(0);
    edges.forEach(([a, b, bit, opposite], i) => {
      if (code & (1 << i)) { cells[a] |= bit; cells[b] |= opposite; }
    });
    const d = distances(3, cells);
    for (const [start, goal] of [[0, 8], [8, 0], [4, code % 9]]) checkSearch(3, cells, start, goal, d);
  }
});

test('Maze: all 65536 raw 2x2 masks treat asymmetric openings and boundary leaks as walls', () => {
  for (let code = 0; code < 65536; code++) {
    const cells = [code & 15, (code >>> 4) & 15, (code >>> 8) & 15, code >>> 12];
    checkSearch(2, cells, 0, 3, distances(2, cells));
  }
});

test('Maze: generated UI sizes have valid shortest BFS routes and actual DFS traces for many seeds', () => {
  for (const size of [12, 16]) for (let seed = 0; seed < 24; seed++) for (const loops of [false, true]) {
    const cells = array(Maze.generate(size, seed, loops));
    // A host distance-only wavefront scales to UI sizes without sharing Bend's
    // reversed-route frontier. The tiny exhaustive cases use Floyd-Warshall.
    const distance = Array(cells.length).fill(Infinity);
    distance[0] = 0;
    let layer = [0];
    while (layer.length) {
      const nextLayer = [];
      for (const current of layer) for (const next of neighbors(size, cells, current)) {
        if (Number.isFinite(distance[next])) continue;
        distance[next] = distance[current] + 1;
        nextLayer.push(next);
      }
      layer = nextLayer;
    }
    checkSearch(size, cells, 0, cells.length - 1, [distance]);
  }
});

test('Maze: the 32x32 bound supports dense frontiers and fully exhausts an unreachable component', () => {
  const cells = Array(1024).fill(15);
  const bfs = result(32, cells, 0, 1023);
  assert.equal(bfs.path.length, 63, 'opposite corners have Manhattan distance 62');
  assert.equal(bfs.visited.length, 1024);
  cells[1023] = 0;
  for (const depthFirst of [false, true]) {
    const found = result(32, cells, 0, 1023, depthFirst);
    assert.deepEqual(found.path, []);
    assert.equal(found.visited.length, 1023, 'fuel covers duplicate frontier entries, not just unique cells');
    assert.deepEqual([...found.visited].sort((a, b) => a - b), Array.from({ length: 1023 }, (_, i) => i));
  }
});

test('Maze: frozen reusable maps and returned traces survive repeated searches', () => {
  const input = Maze.generate(16, 0xffffffff, true);
  for (let node = input; node.$ === 'Con'; node = node.tail) Object.freeze(node);
  const snapshot = structuredClone(input);
  const first = Maze.search(16, input, 0, 255, false), saved = structuredClone(first);
  Maze.search(16, input, 255, 0, true);
  assert.deepEqual(Maze.search(16, input, 0, 255, false), first);
  assert.deepEqual(first, saved);
  assert.deepEqual(input, snapshot);
});
