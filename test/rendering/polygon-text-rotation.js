import Feature from '../../src/ol/Feature.js';
import Map from '../../src/ol/Map.js';
import View from '../../src/ol/View.js';
import MultiPolygon from '../../src/ol/geom/MultiPolygon.js';
import {fromExtent} from '../../src/ol/geom/Polygon.js';
import VectorSource from '../../src/ol/source/Vector.js';
import Fill from '../../src/ol/style/Fill.js';
import Stroke from '../../src/ol/style/Stroke.js';
import Style from '../../src/ol/style/Style.js';
import Text from '../../src/ol/style/Text.js';

/**
 * Exercise both a transformed canvas and VectorImage's unrotated canvas.
 * @param {typeof import('../../src/ol/layer/Vector.js').default|typeof import('../../src/ol/layer/VectorImage.js').default} Layer Layer constructor.
 */
export default function polygonTextRotation(Layer) {
  const features = [];
  for (let i = 0; i < 6; ++i) {
    const x = i < 3 ? 65 : -65;
    const y = 90 - (i % 3) * 90;
    const polygon = fromExtent([x - 10, y - 40, x + 10, y + 40]);
    const feature = new Feature(
      i === 5 ? new MultiPolygon([polygon]) : polygon,
    );
    feature.setStyle(
      new Style({
        fill: new Fill({color: '#eee'}),
        stroke: new Stroke({color: '#888', width: 1}),
        text: new Text({
          text: i === 5 ? 'multi' : 'fits',
          font: '14px monospace',
          rotation: i >= 2 && i !== 5 ? Math.PI / 2 : 0,
          rotateWithView: i === 1 || i === 3,
          overflow: i === 4,
          fill: new Fill({color: '#d00'}),
        }),
      }),
    );
    features.push(feature);
  }
  const map = new Map({
    target: 'map',
    layers: [new Layer({source: new VectorSource({features})})],
    view: new View({center: [0, 0], resolution: 1, rotation: Math.PI / 4}),
  });
  // Rotate after the instructions have been built. With the final rotation,
  // both top corners, top-middle and bottom-right labels should be visible.
  map.once('rendercomplete', () => {
    map.once('rendercomplete', () => render({tolerance: 0}));
    map.getView().setRotation(Math.PI / 2);
  });
}
