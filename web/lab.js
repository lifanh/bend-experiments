import { initFractal } from './fractal.js';
import { initLights } from './lights.js';
import { initAutomaton } from './automaton.js';
import { initGravity } from './gravity.js';
import { initRaytracer } from './raytracer.js';
import { initSorting } from './sorting.js';

const pauseAutomaton = initAutomaton();
const pauseGravity = initGravity();
const pauseSorting = initSorting();
const raytracer = initRaytracer();
initLights();
initFractal();
function navigate() {
  const id = ['fractal', 'lights', 'automaton', 'gravity', 'raytracer', 'sorting'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'fractal';
  for (const panel of document.querySelectorAll('.panel')) panel.hidden = panel.id !== id;
  for (const button of document.querySelectorAll('[data-panel]')) {
    const selected = button.dataset.panel === id;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  if (id !== 'automaton') pauseAutomaton();
  if (id !== 'gravity') pauseGravity();
  if (id !== 'sorting') pauseSorting();
  if (id === 'raytracer') raytracer.show();
  else raytracer.pause();
}
for (const button of document.querySelectorAll('[data-panel]')) {
  button.addEventListener('click', () => {
    const hash = `#${button.dataset.panel}`;
    if (location.hash !== hash) history.pushState(null, '', hash);
    navigate();
  });
}
window.addEventListener('hashchange', navigate);
window.addEventListener('popstate', navigate);
navigate();
