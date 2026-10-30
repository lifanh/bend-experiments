export function initGarden() {
  const canvas = document.querySelector('#garden-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.querySelector('#garden-status');
  const play = document.querySelector('#garden-play');
  const step = document.querySelector('#garden-step');
  const recipe = document.querySelector('#garden-recipe');
  const pattern = document.querySelector('#garden-pattern');
  const feed = document.querySelector('#garden-feed');
  const kill = document.querySelector('#garden-kill');
  const recipes = { spots: [367, 649], stripes: [290, 570], coral: [540, 620] };
  const limit = 20000;
  let worker;
  let busy = false;
  let running = false;
  let failed = false;
  let steps = 0;
  let preview = 0;

  function controls() {
    play.disabled = failed || steps >= limit;
    step.disabled = failed || busy || steps >= limit;
    const growing = !failed && (running || steps < preview);
    play.setAttribute('aria-pressed', String(growing));
    play.innerHTML = growing ? 'Pause the garden <span>Ⅱ</span>' : 'Keep growing <span>▶</span>';
  }
  function pause() {
    running = false;
    preview = 0;
    if (worker && !failed) status.textContent = busy ? 'Finishing the current batch, then pausing.' : 'Paused. Nothing evolves off screen.';
    controls();
  }
  function request(count) {
    if (busy || failed || steps >= limit) return;
    busy = true;
    controls();
    worker.postMessage({ count: Math.min(count, limit - steps) });
  }
  function reset(warmup = false) {
    worker?.terminate();
    steps = 0;
    running = false;
    failed = false;
    busy = true;
    preview = warmup ? 3000 : 0;
    controls();
    document.querySelector('#garden-time').textContent = 'STEP 0 / 64 × 64';
    status.textContent = warmup ? 'Growing a 3,000-step preview…' : 'Planting new seeds…';
    worker = new Worker(new URL('./garden-worker.js', import.meta.url), { type: 'module' });
    const current = worker;
    const parameters = { size: 64, pattern: Number(pattern.value), feed: Number(feed.value) / 10000, kill: Number(kill.value) / 10000 };
    function failure(message) {
      if (worker !== current) return;
      failed = true;
      running = false;
      busy = false;
      status.textContent = `${message} Reseed to try again.`;
      controls();
    }
    worker.onmessage = ({ data }) => {
      if (worker !== current) return;
      if (data.error) return failure(data.error);
      busy = false;
      steps = data.steps;
      canvas.width = data.size;
      canvas.height = data.size;
      ctx.putImageData(new ImageData(data.pixels, data.size, data.size), 0, 0);
      document.querySelector('#garden-time').textContent = `STEP ${steps.toLocaleString()} / ${data.size} × ${data.size}`;
      canvas.setAttribute('aria-label', `Chemical V concentration after ${steps} Gray–Scott steps. Feed ${parameters.feed.toFixed(4)}, kill ${parameters.kill.toFixed(4)}. Pale gold is higher concentration.`);
      if (steps >= limit) {
        running = false;
        status.textContent = '20,000-step limit. Reseed to start again.';
      } else if (steps < preview) {
        status.textContent = `Growing preview · ${steps} / ${preview} steps…`;
        request(Math.min(40, preview - steps));
      } else if (running) {
        status.textContent = 'Reaction and diffusion, one batch at a time.';
        request(40);
      } else {
        status.textContent = preview ? '3,000-step preview. Continue or reseed.' : 'Paused. Change a parameter or keep growing.';
      }
      controls();
    };
    worker.onerror = () => failure('The simulation worker could not run.');
    worker.postMessage({ reset: true, count: 0, ...parameters });
  }
  function values() {
    document.querySelector('#garden-feed-value').value = (Number(feed.value) / 10000).toFixed(4);
    document.querySelector('#garden-kill-value').value = (Number(kill.value) / 10000).toFixed(4);
  }
  play.addEventListener('click', () => {
    if (running || preview > steps) return pause();
    running = true;
    preview = 0;
    controls();
    request(40);
  });
  step.addEventListener('click', () => { pause(); request(200); });
  document.querySelector('#garden-reset').addEventListener('click', () => reset());
  pattern.addEventListener('change', () => reset());
  recipe.addEventListener('change', () => {
    [feed.value, kill.value] = recipes[recipe.value];
    values();
    reset(true);
  });
  for (const control of [feed, kill]) {
    control.addEventListener('input', () => { pause(); recipe.value = 'custom'; values(); });
    control.addEventListener('change', () => reset());
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  return { show: () => { if (!worker) reset(true); }, pause };
}
