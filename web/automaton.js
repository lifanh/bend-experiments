import Automaton from './bend/automaton.mjs';

const toList = (cells) => cells.reduceRight((tail, head) => ({ $: 'Con', head, tail }), { $: 'Nil' });

export function initAutomaton() {
  const canvas = document.querySelector('#automaton-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.querySelector('#automaton-status');
  const play = document.querySelector('#automaton-play');
  const seed = document.querySelector('#automaton-seed');
  let cells;
  let generation = 0;
  let timer = null;

  function pause() {
    clearInterval(timer);
    timer = null;
    play.innerHTML = 'Run forward <span>▶</span>';
    play.setAttribute('aria-pressed', 'false');
  }
  function draw() {
    ctx.fillStyle = '#0b2324';
    ctx.fillRect(0, 0, 768, 768);
    let row = cells;
    for (let y = 0; y < 128; y++) {
      let cursor = row;
      let x = 0;
      while (cursor.$ === 'Con') {
        const { past, now } = cursor.head;
        ctx.fillStyle = now ? (past ? '#dce6a1' : '#a5cfa4') : (past ? '#316357' : '#102c2b');
        ctx.fillRect(x * 6, y * 6, 5, 5);
        cursor = cursor.tail;
        x++;
      }
      row = Automaton.forward(row);
    }
    document.querySelector('#automaton-time').textContent = `GENERATION ${generation >= 0 ? '+' : ''}${generation}`;
    canvas.dataset.generation = String(generation);
  }
  function reset() {
    pause();
    generation = 0;
    let random = 2026;
    cells = toList(Array.from({ length: 128 }, (_, index) => {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const now = seed.value === 'single' ? index === 64 : seed.value === 'sparks' ? [31, 64, 95].includes(index) : random % 7 < 2;
      return { $: 'Cell', past: false, now };
    }));
    status.textContent = 'Ready to travel.';
    draw();
  }
  function move(direction) {
    cells = direction > 0 ? Automaton.travel(16, cells) : Automaton.rewind(16, cells);
    generation += 16 * direction;
    status.textContent = direction > 0 ? 'Computing the future.' : 'Reconstructing the past.';
    draw();
  }
  play.addEventListener('click', () => {
    if (timer !== null) {
      pause();
      status.textContent = 'Time paused.';
    } else {
      play.innerHTML = 'Pause time <span>Ⅱ</span>';
      play.setAttribute('aria-pressed', 'true');
      move(1);
      timer = setInterval(() => move(1), 180);
    }
  });
  document.querySelector('#automaton-back').addEventListener('click', () => { pause(); move(-1); });
  document.querySelector('#automaton-forward').addEventListener('click', () => { pause(); move(1); });
  document.querySelector('#automaton-reset').addEventListener('click', reset);
  document.querySelector('#automaton-verify').addEventListener('click', () => {
    pause();
    const before = JSON.stringify(cells);
    cells = Automaton.rewind(256, Automaton.travel(256, cells));
    const restored = before === JSON.stringify(cells);
    status.textContent = restored ? '256 forward + 256 back. Exactly restored.' : 'Round-trip mismatch. Check the implementation.';
    canvas.dataset.restored = String(restored);
    draw();
  });
  seed.addEventListener('change', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  reset();
  return pause;
}
