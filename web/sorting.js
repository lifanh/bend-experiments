import Sorting from './bend/sorting.mjs';

const toList = (values) => values.reduceRight((tail, head) => ({ $: 'Con', head, tail }), { $: 'Nil' });
const fromList = (list) => {
  const values = [];
  for (let node = list; node.$ === 'Con'; node = node.tail) values.push(node.head);
  return values;
};

export function initSorting() {
  const canvas = document.querySelector('#sorting-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.querySelector('#sorting-status');
  const play = document.querySelector('#sorting-play');
  const step = document.querySelector('#sorting-step');
  const speed = document.querySelector('#sorting-speed');
  const preset = document.querySelector('#sorting-preset');
  const sound = document.querySelector('#sorting-sound');
  const audioStatus = document.querySelector('#sorting-audio-status');
  const voices = new Set();
  let audio;
  let soundEnabled = false;
  let frames;
  let index = 0;
  let timer = null;

  function silence() {
    for (const oscillator of voices) oscillator.stop();
    voices.clear();
  }
  function pause() {
    clearTimeout(timer);
    timer = null;
    silence();
    play.innerHTML = 'Play the sort <span>▶</span>';
    play.setAttribute('aria-pressed', 'false');
    if (frames && index < frames.length - 1) status.textContent = 'Paused. Every value is preserved.';
  }
  function notes() {
    if (!soundEnabled || audio?.state !== 'running') return;
    silence();
    const values = frames[index].filter((value, position) => value !== frames[index - 1]?.[position]);
    values.slice(0, 8).forEach((value, note) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + note * .025;
      oscillator.type = 'sine';
      oscillator.frequency.value = 130.81 * 2 ** (value / 16);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.022, start + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .18);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      voices.add(oscillator);
      oscillator.start(start);
      oscillator.stop(start + .2);
    });
  }
  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#0b2324';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#27433d';
    for (let line = 1; line <= 4; line++) {
      const y = 28 + (height - 65) * line / 4;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    }
    const values = frames[index];
    const column = (width - 20) / values.length;
    values.forEach((value, position) => {
      const x = 10 + position * column;
      const barHeight = value / 32 * (height - 85);
      const changed = index > 0 && frames[index - 1][position] !== value;
      ctx.fillStyle = changed ? '#e3bc74' : '#8bc8ac';
      ctx.fillRect(x, height - 38 - barHeight, Math.max(2, column - 3), barHeight);
    });
    ctx.fillStyle = '#a2b9a7';
    ctx.textAlign = 'left';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(index === 0 ? 'UNMERGED' : index === frames.length - 1 ? 'ONE ORDERED SCORE' : `MERGE LEVEL ${index}`, 10, height - 12);
    ctx.textAlign = 'right';
    ctx.fillText(`${index} / ${frames.length - 1}`, width - 10, height - 12);
  }
  function update() {
    const complete = index === frames.length - 1;
    document.querySelector('#sorting-stage').textContent = `STAGE ${index} / ${frames.length - 1}`;
    status.textContent = complete ? 'Ordered. 32 values, none lost.' : 'Completed merges, not individual writes.';
    play.disabled = complete;
    step.disabled = complete;
    canvas.setAttribute('aria-label', `Merge stage ${index} of ${frames.length - 1}. Values: ${frames[index].join(', ')}.`);
    draw();
  }
  function advance() {
    if (index >= frames.length - 1) return;
    index++;
    if (index === frames.length - 1) pause();
    update();
    notes();
  }
  function tick() {
    advance();
    if (index < frames.length - 1) timer = setTimeout(tick, Number(speed.value));
  }
  function reset() {
    pause();
    index = 0;
    let values = Array.from({ length: 32 }, (_, i) => i + 1);
    if (preset.value === 'reverse') values.reverse();
    if (preset.value === 'duplicates') values = values.map((_, i) => (i % 8 + 1) * 4);
    if (preset.value === 'shuffle' || preset.value === 'duplicates') {
      // Deterministic input generation only; sorting and stages come from Bend.
      let seed = 2026;
      for (let i = values.length - 1; i > 0; i--) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const j = seed % (i + 1);
        [values[i], values[j]] = [values[j], values[i]];
      }
    }
    frames = fromList(Sorting.frames(toList(values))).map(fromList);
    update();
    status.textContent = 'Ready to conduct.';
  }
  play.addEventListener('click', () => {
    if (timer !== null) return pause();
    play.innerHTML = 'Pause the sort <span>Ⅱ</span>';
    play.setAttribute('aria-pressed', 'true');
    timer = setTimeout(tick, 0);
  });
  step.addEventListener('click', () => { pause(); advance(); });
  document.querySelector('#sorting-reset').addEventListener('click', reset);
  preset.addEventListener('change', reset);
  speed.addEventListener('input', () => { document.querySelector('#sorting-speed-value').value = `${speed.value} ms`; });
  sound.addEventListener('click', async () => {
    if (soundEnabled) {
      soundEnabled = false;
      silence();
    } else {
      try {
        audio ??= new AudioContext();
        await audio.resume();
        soundEnabled = true;
      } catch {
        audioStatus.textContent = 'Audio is unavailable. Visual sorting still works.';
        return;
      }
    }
    sound.setAttribute('aria-pressed', String(soundEnabled));
    sound.textContent = soundEnabled ? 'Mute sound ♬' : 'Enable sound ♬';
    audioStatus.textContent = soundEnabled ? 'Sound on. Changed values become notes.' : 'Sound is off. Enable it to hear the merge stages.';
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  new ResizeObserver(draw).observe(canvas);
  reset();
  return pause;
}
