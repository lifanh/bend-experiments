import { initFractal } from './fractal.js';
import { initLights } from './lights.js';
import { initAutomaton } from './automaton.js';
import { initGravity } from './gravity.js';
import { initRaytracer } from './raytracer.js';
import { initSorting } from './sorting.js';
import { initMaze } from './maze.js';
import { initInterpreter } from './interpreter.js';
import { initGarden } from './garden.js';
import { initVault } from './vault.js';

const pauseAutomaton = initAutomaton();
const pauseGravity = initGravity();
const pauseSorting = initSorting();
const raytracer = initRaytracer();
const maze = initMaze();
const garden = initGarden();
initInterpreter();
initVault();
initLights();
initFractal();
const panels = [...document.querySelectorAll('.panel')];
function navigate() {
  const id = panels.some(panel => panel.id === location.hash.slice(1)) ? location.hash.slice(1) : 'fractal';
  for (const panel of panels) panel.hidden = panel.id !== id;
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
  if (id === 'maze') maze.show();
  else maze.pause();
  if (id === 'garden') garden.show();
  else garden.pause();
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
