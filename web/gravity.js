import Gravity from './bend/gravity.mjs';

const bodiesArray = (list) => {
  const bodies = [];
  for (let node = list; node.$ === 'Con'; node = node.tail) bodies.push(node.head);
  return bodies;
};

export function initGravity() {
  const canvas = document.querySelector('#gravity-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.querySelector('#gravity-status');
  const play = document.querySelector('#gravity-play');
  const preset = document.querySelector('#gravity-preset');
  const dt = document.querySelector('#gravity-dt');
  const colors = ['#c0db9c', '#edb97a', '#73c5c1'];
  let systems;
  let initialEnergy;
  let steps = 0;
  let timer = null;

  function pause() {
    if (timer !== null) status.textContent = 'Paused.';
    clearInterval(timer);
    timer = null;
    play.innerHTML = 'Run both simulations <span>▶</span>';
    play.setAttribute('aria-pressed', 'false');
  }
  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    // ResizeObserver can see a transient box smaller than the plot margins.
    if (width <= 48 || height <= 80) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#0b2324';
    ctx.fillRect(0, 0, width, height);
    let extent = preset.value === '2' ? 3.6 : 2.6;
    for (const system of systems) {
      for (const trail of system.trails) {
        for (const body of trail) extent = Math.max(extent, Math.abs(body.x) * 1.15, Math.abs(body.y) * 1.15);
      }
    }
    const panelWidth = width / 2;
    const scale = Math.min(panelWidth - 24, height - 80) / (extent * 2);
    systems.forEach((system, index) => {
      const cx = panelWidth * (index + .5);
      const cy = height / 2 + 9;
      ctx.save();
      ctx.beginPath();
      ctx.rect(index * panelWidth, 0, panelWidth, height);
      ctx.clip();
      ctx.strokeStyle = '#254340';
      ctx.lineWidth = 1;
      for (const radius of [.33, .66, 1]) {
        ctx.beginPath();
        ctx.arc(cx, cy, extent * scale * radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - extent * scale, cy);
      ctx.lineTo(cx + extent * scale, cy);
      ctx.moveTo(cx, cy - extent * scale);
      ctx.lineTo(cx, cy + extent * scale);
      ctx.stroke();
      ctx.fillStyle = index ? '#edb97a' : '#c0db9c';
      ctx.textAlign = 'center';
      ctx.font = `${width < 500 ? 10 : 12}px ui-monospace, monospace`;
      ctx.fillText(index ? 'EXPLICIT EULER' : 'VELOCITY VERLET', cx, 18);
      system.trails.forEach((trail, bodyIndex) => {
        ctx.beginPath();
        trail.forEach((body, point) => {
          const x = cx + body.x * scale;
          const y = cy - body.y * scale;
          if (point) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.strokeStyle = colors[bodyIndex];
        ctx.globalAlpha = .65;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        const body = trail.at(-1);
        ctx.beginPath();
        ctx.arc(cx + body.x * scale, cy - body.y * scale, 3.5 + Math.sqrt(body.mass) * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = colors[bodyIndex];
        ctx.shadowColor = colors[bodyIndex];
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      ctx.fillStyle = '#809e92';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(`SAME SCALE · ±${extent.toFixed(1)}`, cx, height - 5);
      ctx.restore();
    });
    ctx.strokeStyle = '#34504a';
    ctx.beginPath();
    ctx.moveTo(panelWidth, 0);
    ctx.lineTo(panelWidth, height);
    ctx.stroke();
  }
  function update() {
    systems.forEach((system, index) => {
      const drift = 100 * (Gravity.energy(system.bodies) - initialEnergy) / Math.abs(initialEnergy);
      document.querySelector(index ? '#gravity-euler-drift' : '#gravity-verlet-drift').textContent = `${drift >= 0 ? '+' : ''}${drift.toFixed(3)}%`;
    });
    document.querySelector('#gravity-time').textContent = `TIME ${(steps * Number(dt.value) / 1000).toFixed(2)} / ${steps} STEPS`;
    draw();
  }
  function advance(count) {
    if (timer === null) status.textContent = 'Paused after advancing.';
    for (let i = 0; i < count; i++) {
      if (steps >= 50000) {
        pause();
        update();
        status.textContent = '50,000-step limit. Reset to explore again.';
        return;
      }
      const next = systems.map((system, index) => Gravity.step(system.bodies, Number(dt.value) / 1000, index === 0));
      if (next.some(list => bodiesArray(list).some(body => ![body.x, body.y, body.vx, body.vy].every(Number.isFinite)))) {
        pause();
        update();
        status.textContent = 'Numerical overflow. Reset with a smaller step.';
        return;
      }
      systems.forEach((system, index) => {
        system.bodies = next[index];
        bodiesArray(system.bodies).forEach((body, bodyIndex) => {
          const trail = system.trails[bodyIndex];
          trail.push(body);
          if (trail.length > 1800) trail.shift();
        });
      });
      steps++;
    }
    update();
  }
  function reset() {
    pause();
    steps = 0;
    const bodies = Gravity.preset(Number(preset.value));
    initialEnergy = Gravity.energy(bodies);
    systems = [true, false].map(() => ({ bodies, trails: bodiesArray(bodies).map(body => [body]) }));
    status.textContent = 'Paused at the initial state.';
    update();
  }
  play.addEventListener('click', () => {
    if (timer !== null) return pause();
    play.innerHTML = 'Pause simulations <span>Ⅱ</span>';
    play.setAttribute('aria-pressed', 'true');
    status.textContent = 'Computing both futures.';
    timer = setInterval(() => advance(8), 40);
  });
  document.querySelector('#gravity-step').addEventListener('click', () => { pause(); advance(100); });
  document.querySelector('#gravity-reset').addEventListener('click', reset);
  preset.addEventListener('change', reset);
  dt.addEventListener('input', () => { pause(); document.querySelector('#gravity-dt-value').value = (Number(dt.value) / 1000).toFixed(3); });
  dt.addEventListener('change', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  new ResizeObserver(draw).observe(canvas);
  reset();
  // A paused, genuinely simulated orbit preview; Reset returns to time zero.
  advance(600);
  status.textContent = '600-step preview. Run or reset.';
  return pause;
}
