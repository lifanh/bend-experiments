import Fractal from './bend/fractal.mjs';

self.onmessage = ({ data }) => {
  try {
    const started = performance.now();
    const tree = Fractal.render(...data.args);
    const width = 2 ** data.args[0];
    const counts = new Uint32Array(width * width);
    function flatten(node) {
      if (node.$ === 'Quad') {
        for (const child of [node.tl, node.tr, node.bl, node.br]) flatten(child);
      } else {
        let values = node.counts;
        let index = 0;
        while (values.$ === 'Con') {
          const x = node.x + index % node.size;
          const y = node.y + Math.floor(index / node.size);
          counts[y * width + x] = values.head;
          values = values.tail;
          index++;
        }
      }
    }
    flatten(tree);
    self.postMessage({ counts, elapsed: performance.now() - started }, [counts.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
