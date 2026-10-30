import Garden from './bend/garden.mjs';

let cells, size, feed, kill;
let steps = 0;
self.onmessage = ({ data }) => {
  try {
    if (data.reset) {
      ({ size, feed, kill } = data);
      cells = Garden.seed(size, data.pattern);
      steps = 0;
    }
    cells = Garden.advance(data.count, size, cells, feed, kill);
    steps += data.count;
    const pixels = new Uint8ClampedArray(size * size * 4);
    let index = 0;
    for (let node = cells; node.$ === 'Con'; node = node.tail) {
      if (!Number.isFinite(node.head.u) || !Number.isFinite(node.head.v)) throw new Error('Numerical overflow. Choose a different recipe.');
      // Display mapping only. All concentrations and dynamics come from Bend.
      const v = Math.min(1, Math.max(0, node.head.v * 3));
      pixels.set([11 + v * 220, 35 + v * 175, 36 + v * 112, 255], index++ * 4);
    }
    self.postMessage({ pixels, size, steps }, [pixels.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
