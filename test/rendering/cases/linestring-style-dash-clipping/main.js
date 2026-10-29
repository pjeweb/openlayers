import Feature from '../../../../src/ol/Feature.js';
import Map from '../../../../src/ol/Map.js';
import View from '../../../../src/ol/View.js';
import MultiLineString from '../../../../src/ol/geom/MultiLineString.js';
import VectorLayer from '../../../../src/ol/layer/Vector.js';
import VectorSource from '../../../../src/ol/source/Vector.js';
import Stroke from '../../../../src/ol/style/Stroke.js';
import Style from '../../../../src/ol/style/Style.js';

const features = [];
for (const [i, lineCap] of ['butt', 'round', 'square'].entries()) {
  const feature = new Feature(
    new MultiLineString([
      [
        [-1503, 80 - i * 65],
        [-1301, 180],
        [-1201, 180],
        [-1201, 80 - i * 65],
        [10, 80 - i * 65],
        [35, 100 - i * 65],
        [60, 80 - i * 65],
        [1500, 80 - i * 65],
      ],
      [
        [1507, 60 - i * 65],
        [-1500, 60 - i * 65],
      ],
    ]),
  );
  feature.setStyle(
    new Style({
      stroke: new Stroke({
        color: 'rgba(0,80,180,0.6)',
        width: 9,
        lineDash: [9, 4, 3],
        lineDashOffset: -13,
        lineCap,
        lineJoin: 'miter',
      }),
    }),
  );
  features.push(feature);
}
new Map({
  target: 'map',
  pixelRatio: 2,
  layers: [
    new VectorLayer({renderBuffer: 0, source: new VectorSource({features})}),
  ],
  view: new View({center: [0, 0], resolution: 1, rotation: 0.2}),
});
render({tolerance: 0.001});
