import Raytracer from './bend/raytracer.mjs';

self.onmessage = ({ data }) => {
  try {
    const started = performance.now();
    const tree = Raytracer.render(...data.args);
    const width = 2 ** data.args[0];
    const pixels = new Uint8ClampedArray(width * width * 4);
    function flatten(node) {
      if (node.$ === 'Quad') {
        for (const child of [node.tl, node.tr, node.bl, node.br]) flatten(child);
      } else {
        let values = node.pixels;
        let index = 0;
        while (values.$ === 'Con') {
          const x = node.x + index % node.size;
          const y = node.y + Math.floor(index / node.size);
          const color = values.head;
          pixels.set([(color >>> 16) & 255, (color >>> 8) & 255, color & 255, 255], (y * width + x) * 4);
          values = values.tail;
          index++;
        }
      }
    }
    flatten(tree);
    self.postMessage({ pixels, width, elapsed: performance.now() - started }, [pixels.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
