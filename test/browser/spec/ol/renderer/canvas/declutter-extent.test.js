import {assert} from 'chai';
import Feature from '../../../../../../src/ol/Feature.js';
import Map from '../../../../../../src/ol/Map.js';
import TileState from '../../../../../../src/ol/TileState.js';
import VectorTile from '../../../../../../src/ol/VectorTile.js';
import View from '../../../../../../src/ol/View.js';
import Point from '../../../../../../src/ol/geom/Point.js';
import {fromExtent} from '../../../../../../src/ol/geom/Polygon.js';
import LayerGroup from '../../../../../../src/ol/layer/Group.js';
import VectorLayer from '../../../../../../src/ol/layer/Vector.js';
import VectorTileLayer from '../../../../../../src/ol/layer/VectorTile.js';
import Projection from '../../../../../../src/ol/proj/Projection.js';
import RenderFeature from '../../../../../../src/ol/render/Feature.js';
import VectorSource from '../../../../../../src/ol/source/Vector.js';
import VectorTileSource from '../../../../../../src/ol/source/VectorTile.js';
import Circle from '../../../../../../src/ol/style/Circle.js';
import Fill from '../../../../../../src/ol/style/Fill.js';
import Style from '../../../../../../src/ol/style/Style.js';
import Text from '../../../../../../src/ol/style/Text.js';
import TileGrid from '../../../../../../src/ol/tilegrid/TileGrid.js';
import {apply} from '../../../../../../src/ol/transform.js';

let font;
beforeAll(async () => {
  font = new FontFace(
    'Ubuntu Extent Test',
    'url(/spec/ol/data/fonts/ubuntu-regular-webfont.woff2)',
  );
  document.fonts.add(await font.load());
});
afterAll(() => document.fonts.delete(font));

for (const mode of ['vector layer', 'hybrid', 'vector']) {
  for (const rotation of [0, Math.PI / 4]) {
    describe(`declutter extent: ${mode}, rotation ${rotation}`, () => {
      let map;
      const style = new Style({
        image: new Circle({radius: 10, fill: new Fill({color: 'red'})}),
        text: new Text({
          text: 'label',
          font: '10px "Ubuntu Extent Test"',
          offsetY: -20,
        }),
      });

      function createLayer(features, options = {}, wrapX = false, projection) {
        const common = {
          declutter: 'shared',
          extent: [0, -50, 50, 50],
          renderBuffer: 100,
          style,
          ...options,
        };
        if (mode === 'vector layer') {
          return new VectorLayer({
            ...common,
            source: new VectorSource({features, wrapX}),
          });
        }
        class LoadedTile extends VectorTile {
          constructor(...args) {
            super(...args);
            this.setFeatures(features);
            this.setState(TileState.LOADED);
          }
        }
        return new VectorTileLayer({
          ...common,
          renderMode: mode,
          source: new VectorTileSource({
            tileClass: LoadedTile,
            tileGrid: new TileGrid({
              extent: [-128, -128, 128, 128],
              resolutions: [1],
              tileSize: 256,
            }),
            url: '{z}/{x}/{y}',
            wrapX,
            projection,
          }),
        });
      }

      async function render(layers, viewOptions = {}) {
        map = new Map({
          target: createMapDiv(128, 128),
          pixelRatio: 2,
          layers,
          view: new View({
            center: [0, 0],
            resolution: 1,
            rotation,
            ...viewOptions,
          }),
        });
        await new Promise((resolve) => {
          map.once('rendercomplete', resolve);
          map.renderSync();
        });
      }

      function declutteredFeatures() {
        return map.frameState_.declutter.shared.all().map((item) => item.value);
      }

      function pixel(layer, coordinate) {
        const renderer = layer.getRenderer();
        const position = apply(
          renderer.inversePixelTransform,
          map.getPixelFromCoordinate(coordinate),
        );
        return Array.from(
          renderer.context.getImageData(...position.map(Math.round), 1, 1).data,
        );
      }

      afterEach(() => disposeMap(map));

      it('rejects outside points before collision testing and hit detection', async () => {
        const inside = new Feature(new Point([5, 0]));
        // The outside symbol overlaps the inside point.
        const outside = new Feature(new Point([-5, 0]));
        const layer = createLayer([outside, inside]);
        await render([layer]);
        assert.include(declutteredFeatures(), inside);
        assert.notInclude(declutteredFeatures(), outside);
        assert.deepEqual(pixel(layer, [5, 0]), [255, 0, 0, 255]);
        assert.deepEqual(pixel(layer, [-2, 0]), [0, 0, 0, 0]);
        assert.deepEqual(
          map.getFeaturesAtPixel(map.getPixelFromCoordinate([5, 0])),
          [inside],
        );
      });

      it('uses each layer extent within a shared declutter group', async () => {
        const inside = new Feature(new Point([5, 0]));
        const outside = new Feature(new Point([8, 0]));
        const lower = createLayer([inside]);
        const upper = createLayer([outside], {extent: [10, -40, 40, 40]});
        await render([lower, upper]);
        assert.include(declutteredFeatures(), inside);
        assert.notInclude(declutteredFeatures(), outside);
        assert.deepEqual(pixel(lower, [5, 0]), [255, 0, 0, 255]);
        assert.deepEqual(
          map.getFeaturesAtPixel(map.getPixelFromCoordinate([2, 0])),
          [inside],
        );
      });

      it('does not hit a rejected copy of a feature shared by two layers', async () => {
        const feature = new Feature(new Point([5, 0]));
        const lower = createLayer([feature]);
        const upper = createLayer([feature], {extent: [10, -40, 40, 40]});
        await render([lower, upper]);
        const hitLayers = [];
        map.forEachFeatureAtPixel(
          map.getPixelFromCoordinate([12, 0]),
          (feature, layer) => {
            hitLayers.push(layer);
          },
        );
        assert.deepEqual(hitLayers, [lower]);
      });

      it('filters lightweight point render features', async () => {
        const inside = new RenderFeature('Point', [5, 0], [], 2, {}, 1);
        const outside = new RenderFeature('Point', [-5, 0], [], 2, {}, 2);
        const layer = createLayer([outside, inside]);
        await render([layer]);
        assert.include(declutteredFeatures(), inside);
        assert.notInclude(declutteredFeatures(), outside);
        assert.deepEqual(pixel(layer, [5, 0]), [255, 0, 0, 255]);
        assert.deepEqual(
          map.getFeaturesAtPixel(map.getPixelFromCoordinate([5, 0])),
          [inside],
        );
      });

      it('filters the rendered geometry, retaining boundary points and crossing geometries', async () => {
        const boundary = new Feature(new Point([0, -30]));
        const crossing = new Feature(fromExtent([-40, 15, 5, 35]));
        const styled = new Feature(new Point([-30, -30]));
        styled.setStyle(
          new Style({
            geometry: new Point([30, -30]),
            image: style.getImage(),
          }),
        );
        const layer = createLayer([boundary, crossing, styled]);
        await render([layer]);
        assert.include(declutteredFeatures(), boundary);
        // The polygon's label anchor is outside, but its geometry intersects.
        assert.include(declutteredFeatures(), crossing);
        assert.include(declutteredFeatures(), styled);
        assert.deepEqual(pixel(layer, [30, -30]), [255, 0, 0, 255]);
      });

      for (const declutterMode of ['none', 'obstacle']) {
        it(`rejects outside symbols with declutterMode ${declutterMode}`, async () => {
          const outside = new Feature(new Point([-5, 0]));
          const layer = createLayer([outside], {
            style: new Style({
              image: new Circle({
                radius: 10,
                fill: new Fill({color: 'red'}),
                declutterMode,
              }),
            }),
          });
          await render([layer]);
          assert.deepEqual(pixel(layer, [2, 0]), [0, 0, 0, 0]);
          assert.isEmpty(
            map.getFeaturesAtPixel(map.getPixelFromCoordinate([2, 0])),
          );
        });
      }

      it('uses the inherited group extent', async () => {
        const inside = new Feature(new Point([5, 0]));
        const outside = new Feature(new Point([-5, 0]));
        const lower = createLayer([inside], {extent: undefined});
        const upper = createLayer([outside], {extent: undefined});
        await render([
          new LayerGroup({
            extent: [0, -50, 50, 50],
            layers: [lower, upper],
          }),
        ]);
        assert.include(declutteredFeatures(), inside);
        assert.notInclude(declutteredFeatures(), outside);
        assert.deepEqual(
          map.getFeaturesAtPixel(map.getPixelFromCoordinate([2, 0])),
          [inside],
        );
      });

      it('filters wrapped copies in replay coordinates', async () => {
        const projection = new Projection({
          code: 'declutter-extent',
          units: 'm',
          extent: [-128, -128, 128, 128],
          global: true,
        });
        const inside = new Feature(new Point([5, 0]));
        const outside = new Feature(new Point([-5, 0]));
        const layer = createLayer(
          [outside, inside],
          {extent: [256, -50, 306, 50]},
          true,
          projection,
        );
        await render([layer], {projection, center: [256, 0]});
        assert.include(declutteredFeatures(), inside);
        assert.notInclude(declutteredFeatures(), outside);
        assert.deepEqual(pixel(layer, [261, 0]), [255, 0, 0, 255]);
        assert.deepEqual(pixel(layer, [254, 0]), [0, 0, 0, 0]);
        assert.deepEqual(
          map.getFeaturesAtPixel(map.getPixelFromCoordinate([261, 0])),
          [inside],
        );
      });

      it('keeps buffered candidates when no layer extent is set', async () => {
        const feature = new Feature(new Point([-5, 0]));
        const layer = createLayer([feature], {extent: undefined});
        await render([layer]);
        assert.include(declutteredFeatures(), feature);
        assert.deepEqual(pixel(layer, [-5, 0]), [255, 0, 0, 255]);
      });
    });
  }
}
