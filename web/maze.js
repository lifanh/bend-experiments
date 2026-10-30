import Maze from './bend/maze.mjs';

const fromList = (list) => {
  const values = [];
  for (let node = list; node.$ === 'Con'; node = node.tail) values.push(node.head);
  return values;
};

export function initMaze() {
  const canvas = document.querySelector('#maze-canvas');
  const ctx = canvas.getContext('2d');
  const seed = document.querySelector('#maze-seed');
  const size = document.querySelector('#maze-size');
  const loops = document.querySelector('#maze-loops');
  const play = document.querySelector('#maze-play');
  const status = document.querySelector('#maze-status');
  let cells, searches;
  let dimension, looped;
  let revealed = Infinity;
  let timer = null;

  function pause() {
    if (timer !== null) status.textContent = 'Search playback paused.';
    clearInterval(timer);
    timer = null;
    play.innerHTML = 'Replay the searches <span>▶</span>';
    play.setAttribute('aria-pressed', 'false');
  }
  function draw() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!cells || width <= 48 || height <= 80) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#0b2324';
    ctx.fillRect(0, 0, width, height);
    const n = dimension;
    const side = Math.min(width / 2 - 24, height - 75);
    const unit = side / n;
    searches.forEach((search, index) => {
      const x = width * (index + .5) / 2 - side / 2;
      const y = (height - side) / 2;
      const color = index ? '#edb97a' : '#a7d2b2';
      ctx.textAlign = 'center';
      ctx.font = `${width < 450 ? 8 : 11}px ui-monospace, monospace`;
      ctx.fillStyle = color;
      ctx.fillText(index ? 'DEPTH FIRST' : 'BREADTH FIRST', x + side / 2, y - 18);
      ctx.fillStyle = index ? '#3f3930' : '#24493e';
      for (const cell of search.visited.slice(0, revealed)) {
        ctx.fillRect(x + cell % n * unit, y + Math.floor(cell / n) * unit, unit, unit);
      }
      ctx.strokeStyle = '#66857a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      cells.forEach((mask, cell) => {
        const left = x + cell % n * unit, top = y + Math.floor(cell / n) * unit;
        if (!(mask & 1)) { ctx.moveTo(left, top); ctx.lineTo(left + unit, top); }
        if (!(mask & 8)) { ctx.moveTo(left, top); ctx.lineTo(left, top + unit); }
        if (cell % n === n - 1) { ctx.moveTo(left + unit, top); ctx.lineTo(left + unit, top + unit); }
        if (cell >= n * (n - 1)) { ctx.moveTo(left, top + unit); ctx.lineTo(left + unit, top + unit); }
      });
      ctx.stroke();
      if (revealed >= search.visited.length) {
        ctx.beginPath();
        search.path.forEach((cell, point) => {
          const cx = x + (cell % n + .5) * unit, cy = y + (Math.floor(cell / n) + .5) * unit;
          if (point) ctx.lineTo(cx, cy);
          else ctx.moveTo(cx, cy);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, unit * .17);
        ctx.stroke();
      }
      for (const cell of [0, n * n - 1]) {
        ctx.fillStyle = cell === 0 ? '#def4bd' : '#f4b576';
        ctx.beginPath();
        ctx.arc(x + (cell % n + .5) * unit, y + (Math.floor(cell / n) + .5) * unit, unit * .23, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = '#8eaa9c';
      ctx.fillText(`${Math.min(revealed, search.visited.length)} CELLS EXPLORED`, x + side / 2, y + side + 23);
    });
  }
  function update() {
    const complete = searches.every(search => revealed >= search.visited.length);
    for (const [i, name] of ['bfs', 'dfs'].entries()) {
      document.querySelector(`#maze-${name}`).textContent = revealed >= searches[i].visited.length ? `${searches[i].path.length - 1} steps` : '…';
    }
    if (complete) {
      pause();
      status.textContent = looped ? 'Search complete. Breadth first is shortest.' : 'One tree, one route. Different exploration.';
      canvas.setAttribute('aria-label', `Maze with ${dimension} by ${dimension} cells. Breadth-first route: ${searches[0].path.length - 1} steps, ${searches[0].visited.length} cells explored. Depth-first route: ${searches[1].path.length - 1} steps, ${searches[1].visited.length} cells explored.`);
    } else {
      canvas.setAttribute('aria-label', `Maze search playback. Breadth first has explored ${Math.min(revealed, searches[0].visited.length)} cells; depth first ${Math.min(revealed, searches[1].visited.length)}.`);
    }
    draw();
  }
  function generate() {
    if (!seed.reportValidity()) return;
    pause();
    const n = Number(size.value);
    const grid = Maze.generate(n, Number(seed.value), loops.checked);
    dimension = n;
    looped = loops.checked;
    cells = fromList(grid);
    searches = [false, true].map(depthFirst => {
      const result = Maze.search(n, grid, 0, n * n - 1, depthFirst);
      return { path: fromList(result.path), visited: fromList(result.visited) };
    });
    revealed = Infinity;
    document.querySelector('#maze-detail').textContent = `${n} × ${n} CELLS / SEED ${seed.value}`;
    update();
  }
  play.addEventListener('click', () => {
    if (timer !== null) return pause();
    revealed = 0;
    status.textContent = 'Following the actual search traces.';
    play.innerHTML = 'Pause the searches <span>Ⅱ</span>';
    play.setAttribute('aria-pressed', 'true');
    update();
    timer = setInterval(() => { revealed += 3; update(); }, 45);
  });
  document.querySelector('#maze-next').addEventListener('click', () => {
    if (!seed.reportValidity()) return;
    seed.value = String((Number(seed.value) + 1) >>> 0);
    generate();
  });
  for (const control of [seed, size, loops]) control.addEventListener('change', generate);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  new ResizeObserver(draw).observe(canvas);
  return { show: () => { if (!cells) generate(); }, pause };
}
