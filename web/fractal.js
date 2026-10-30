export function initFractal() {
  const canvas = document.querySelector('#fractal-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.querySelector('#fractal-status');
  const mode = document.querySelector('#fractal-mode');
  const iterations = document.querySelector('#iterations');
  const juliaX = document.querySelector('#julia-x');
  const juliaY = document.querySelector('#julia-y');
  let centerX = -0.5;
  let centerY = 0;
  let zoom = 1;
  let worker;

  function render() {
    const julia = mode.value === 'julia';
    if (julia && (!juliaX.reportValidity() || !juliaY.reportValidity() || !Number.isFinite(juliaX.valueAsNumber) || !Number.isFinite(juliaY.valueAsNumber))) {
      status.textContent = 'Enter Julia constants between −2 and 2.';
      return;
    }
    // Cancel obsolete work rather than queuing expensive renders while dragging.
    worker?.terminate();
    worker = new Worker(new URL('./fractal-worker.js', import.meta.url), { type: 'module' });
    const cap = Number(iterations.value);
    const name = julia ? 'JULIA SET' : 'MANDELBROT SET';
    document.querySelector('#fractal-label').textContent = name;
    canvas.setAttribute('aria-label', `${name}. Click to center and zoom; use zoom buttons with a keyboard.`);
    document.querySelector('#julia-controls').hidden = !julia;
    document.querySelector('#iteration-value').value = cap;
    document.querySelector('#zoom-value').textContent = `${zoom}×`;
    document.querySelector('#zoom-out').disabled = zoom <= 1;
    document.querySelector('#zoom-in').disabled = zoom >= 128;
    document.querySelector('#fractal-coordinates').textContent = `CENTER ${centerX.toFixed(5)}, ${centerY.toFixed(5)}`;
    status.textContent = 'Computing in Bend…';
    canvas.setAttribute('aria-busy', 'true');
    canvas.dataset.ready = 'false';
    const fail = (message) => {
      status.textContent = `Render failed: ${message}`;
      canvas.setAttribute('aria-busy', 'false');
    };
    worker.onerror = () => fail('check the build and reload.');
    worker.onmessage = ({ data }) => {
      if (data.error) return fail(data.error);
      const image = ctx.createImageData(512, 512);
      data.counts.forEach((count, index) => {
        // Coloring is presentation only; escape counts come from Bend.
        const t = Math.min(1, count / 38);
        const color = count >= cap ? [7, 24, 27] : [Math.round(13 + 200 * t ** 1.3), Math.round(48 + 180 * t ** .7), Math.round(53 + 137 * t ** .6)];
        image.data.set([...color, 255], index * 4);
      });
      ctx.putImageData(image, 0, 0);
      status.textContent = `512 × 512 / ${Math.round(data.elapsed)} ms`;
      canvas.dataset.ready = 'true';
      canvas.setAttribute('aria-busy', 'false');
    };
    worker.postMessage({ args: [9, centerX, centerY, 3.2 / zoom, cap, julia, juliaX.valueAsNumber, juliaY.valueAsNumber] });
  }
  function reset() {
    zoom = 1;
    centerX = mode.value === 'julia' ? 0 : -0.5;
    centerY = 0;
    render();
  }
  canvas.addEventListener('click', (event) => {
    if (zoom >= 128) return;
    const rect = canvas.getBoundingClientRect();
    centerX += ((event.clientX - rect.left) / rect.width - .5) * 3.2 / zoom;
    centerY -= ((event.clientY - rect.top) / rect.height - .5) * 3.2 / zoom;
    zoom *= 2;
    render();
  });
  document.querySelector('#zoom-in').addEventListener('click', () => { zoom = Math.min(128, zoom * 2); render(); });
  document.querySelector('#zoom-out').addEventListener('click', () => { zoom = Math.max(1, zoom / 2); render(); });
  document.querySelector('#fractal-reset').addEventListener('click', reset);
  mode.addEventListener('change', reset);
  iterations.addEventListener('input', () => { document.querySelector('#iteration-value').value = iterations.value; });
  iterations.addEventListener('change', render);
  juliaX.addEventListener('change', render);
  juliaY.addEventListener('change', render);
  render();
}
