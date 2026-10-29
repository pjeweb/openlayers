/**
 * Run with node test/performance/canvas-dashed-lines.js [--firefox].
 * Measures synchronous Canvas vector rendering, including a pixel readback to
 * flush deferred browser drawing. No tiles, network data, or WebGL are involved.
 */
import {chromium, firefox} from 'playwright';
import {createServer} from 'vite';

const rootIndex = process.argv.indexOf('--root');
const server = await createServer({
  root: rootIndex < 0 ? process.cwd() : process.argv[rootIndex + 1],
  configFile: false,
  logLevel: 'error',
  optimizeDeps: {noDiscovery: true, include: []},
  server: {host: '127.0.0.1', port: 0},
});
server.middlewares.use((request, response, next) => {
  if (request.url !== '/') {
    next();
    return;
  }
  response.setHeader('Content-Type', 'text/html');
  response.end('<!DOCTYPE html><html><body></body></html>');
});
await server.listen();
let browser;
try {
  browser = await (
    process.argv.includes('--firefox') ? firefox : chromium
  ).launch({headless: true, firefoxUserPrefs: {'network.proxy.type': 0}});
  const page = await browser.newPage({viewport: {width: 800, height: 600}});
  await page.goto(server.resolvedUrls.local[0]);
  const results = await page.evaluate(async () => {
    const {default: Map} = await import('/src/ol/Map.js');
    const {default: View} = await import('/src/ol/View.js');
    const {default: Feature} = await import('/src/ol/Feature.js');
    const {default: LineString} = await import('/src/ol/geom/LineString.js');
    const {default: VectorLayer} = await import('/src/ol/layer/Vector.js');
    const {default: VectorSource} = await import('/src/ol/source/Vector.js');
    const {default: Style} = await import('/src/ol/style/Style.js');
    const {default: Stroke} = await import('/src/ol/style/Stroke.js');
    const target = document.createElement('div');
    target.style.cssText = 'width:800px;height:600px';
    document.body.append(target);
    const results = [];
    for (const count of [1, 25]) {
      const source = new VectorSource({wrapX: false});
      for (let i = 0; i < count; ++i) {
        source.addFeature(
          new Feature(
            new LineString([
              [-131072, i * 2],
              [131072, i * 2],
            ]),
          ),
        );
      }
      for (const dashed of [false, true]) {
        const layer = new VectorLayer({
          source,
          style: new Style({
            stroke: new Stroke({
              color: '#246',
              width: 3,
              lineCap: 'round',
              lineDash: dashed ? [5, 5] : undefined,
            }),
          }),
        });
        const map = new Map({
          target,
          pixelRatio: 1,
          layers: [layer],
          view: new View({center: [0, 0], resolution: 256}),
        });
        for (const resolution of [256, 16, 1, 0.25]) {
          map.getView().setResolution(resolution);
          map.getView().setCenter([0, 0]);
          map.renderSync();
          map.getView().beginInteraction();
          const samples = [];
          for (let frame = 0; frame < 12; ++frame) {
            // Small pans replay cached instructions with a different transform.
            map.getView().setCenter([frame * resolution, 0]);
            const start = performance.now();
            map.renderSync();
            const context = target.querySelector('canvas').getContext('2d');
            context.getImageData(400, 300, 1, 1);
            const elapsed = performance.now() - start;
            if (frame >= 3) {
              samples.push(elapsed);
            }
          }
          map.getView().endInteraction(0);
          samples.sort((a, b) => a - b);
          const row = target
            .querySelector('canvas')
            .getContext('2d')
            .getImageData(0, 300, 800, 1).data;
          let transitions = 0;
          for (let x = 1; x < 800; ++x) {
            if (row[x * 4 + 3] > 0 !== row[(x - 1) * 4 + 3] > 0) {
              ++transitions;
            }
          }
          results.push({
            transitions,
            count,
            dashed,
            resolution,
            median: samples[4],
            max: samples[8],
          });
        }
        map.dispose();
      }
    }
    return results;
  });
  process.stdout.write(
    JSON.stringify({browser: browser.version(), results}, null, 2) + '\n',
  );
} finally {
  await browser?.close();
  await server.close();
}
