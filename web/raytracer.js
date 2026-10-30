export function initRaytracer() {
  const canvas = document.querySelector('#raytracer-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.querySelector('#raytracer-status');
  const camera = document.querySelector('#ray-camera');
  const light = document.querySelector('#ray-light');
  const reflect = document.querySelector('#ray-reflect');
  const shadows = document.querySelector('#ray-shadows');
  const quality = document.querySelector('#ray-quality');
  let worker;
  let ready = false;

  function labels() {
    document.querySelector('#ray-camera-value').value = `${(Number(camera.value) / 100).toFixed(2)} rad`;
    document.querySelector('#ray-light-value').value = (Number(light.value) / 10).toFixed(1);
    document.querySelector('#ray-reflect-value').value = `${reflect.value}%`;
  }
  function render() {
    labels();
    worker?.terminate();
    worker = new Worker(new URL('./raytracer-worker.js', import.meta.url), { type: 'module' });
    ready = false;
    canvas.dataset.ready = 'false';
    canvas.setAttribute('aria-busy', 'true');
    status.textContent = 'Tracing rays in Bend…';
    const fail = (message) => {
      status.textContent = `Render failed: ${message}`;
      canvas.setAttribute('aria-busy', 'false');
      worker?.terminate();
      worker = null;
    };
    worker.onerror = () => fail('check the build and reload.');
    worker.onmessage = ({ data }) => {
      if (data.error) return fail(data.error);
      canvas.width = data.width;
      canvas.height = data.width;
      ctx.putImageData(new ImageData(data.pixels, data.width, data.width), 0, 0);
      document.querySelector('#raytracer-detail').textContent = `${data.width} × ${data.width} / ${shadows.checked ? 'SHADOWS ON' : 'SHADOWS OFF'}`;
      status.textContent = `Rendered in ${Math.round(data.elapsed)} ms`;
      canvas.setAttribute('aria-label', `Ray-traced teal, coral and gold spheres. Camera ${(Number(camera.value) / 100).toFixed(2)} radians, reflectivity ${reflect.value}%, shadows ${shadows.checked ? 'on' : 'off'}.`);
      canvas.setAttribute('aria-busy', 'false');
      canvas.dataset.ready = 'true';
      ready = true;
      worker.terminate();
      worker = null;
    };
    worker.postMessage({ args: [Number(quality.value), Number(camera.value) / 100, Number(light.value) / 10, Number(reflect.value) / 100, shadows.checked] });
  }
  for (const slider of [camera, light, reflect]) slider.addEventListener('input', labels);
  for (const control of [camera, light, reflect, shadows, quality]) control.addEventListener('change', render);
  document.querySelector('#ray-reset').addEventListener('click', () => {
    camera.value = 0;
    light.value = -30;
    reflect.value = 45;
    shadows.checked = true;
    quality.value = 8;
    render();
  });
  labels();
  return {
    show() { if (!ready && !worker) render(); },
    pause() {
      worker?.terminate();
      worker = null;
      canvas.setAttribute('aria-busy', 'false');
    },
  };
}
