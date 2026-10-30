import Lights from './bend/lights.mjs';

export function initLights() {
  const container = document.querySelector('#lights-board');
  const status = document.querySelector('#lights-status');
  const minimum = document.querySelector('#lights-minimum');
  const apply = document.querySelector('#lights-apply');
  const edit = document.querySelector('#lights-edit');
  let board = Lights.apply(0, 0x3152);
  let presses = 0;
  let solution = null;
  const buttons = Array.from({ length: 16 }, (_, index) => {
    const button = document.createElement('button');
    button.className = 'light';
    button.addEventListener('click', () => {
      board = edit.checked ? board ^ (1 << index) : Lights.press(board, index);
      if (!edit.checked) presses++;
      solution = null;
      draw();
    });
    button.addEventListener('keydown', (event) => {
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 };
      if (event.key in offsets) {
        event.preventDefault();
        buttons[(index + offsets[event.key] + 16) % 16].focus();
      }
    });
    container.append(button);
    return button;
  });
  function draw() {
    buttons.forEach((button, index) => {
      const on = Boolean(board & (1 << index));
      const hint = Boolean(solution?.solvable && solution.moves & (1 << index));
      button.classList.toggle('on', on);
      button.classList.toggle('hint', hint);
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', `Row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}: ${on ? 'on' : 'off'}${hint ? ', in optimal solution' : ''}`);
    });
    container.dataset.board = String(board);
    document.querySelector('#lights-moves').textContent = `${presses} ${presses === 1 ? 'PRESS' : 'PRESSES'}`;
    document.querySelector('#board-caption').textContent = board === 0 ? 'All quiet. Beautifully done.' : edit.checked ? 'Edit mode: change one light at a time.' : 'Turn every light off.';
    minimum.textContent = solution ? (solution.solvable ? String(solution.count) : '∅') : board === 0 ? '0' : '—';
    apply.disabled = !solution?.solvable || board === 0;
    status.textContent = board === 0 ? 'SOLVED / every light is off.' : solution ? (solution.solvable ? `${solution.count} presses. An exact minimum.` : 'No solution exists for this board.') : edit.checked ? 'Editing the starting state.' : 'Your move.';
  }
  function reset(next) {
    board = next;
    presses = 0;
    solution = null;
    edit.checked = false;
    draw();
  }
  document.querySelector('#lights-solve').addEventListener('click', () => {
    solution = Lights.solve(board);
    draw();
  });
  apply.addEventListener('click', () => {
    if (!solution?.solvable) return;
    board = Lights.apply(board, solution.moves);
    presses += solution.count;
    solution = null;
    draw();
  });
  document.querySelector('#lights-new').addEventListener('click', () => {
    let next = 0;
    while (next === 0 || next === board) next = Lights.apply(0, crypto.getRandomValues(new Uint16Array(1))[0]);
    reset(next);
  });
  document.querySelector('#lights-clear').addEventListener('click', () => reset(0));
  document.querySelector('#lights-impossible').addEventListener('click', () => reset(1));
  edit.addEventListener('change', () => { solution = null; draw(); });
  draw();
}
