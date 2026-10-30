import {assert} from 'chai';
import MultiPolygon from '../../../../../src/ol/geom/MultiPolygon.js';
import Polygon, {fromExtent} from '../../../../../src/ol/geom/Polygon.js';
import {getInteriorPointOfArray} from '../../../../../src/ol/geom/flat/interiorpoint.js';
import RenderFeature from '../../../../../src/ol/render/Feature.js';

function closePoint(actual, expected) {
  assert.lengthOf(actual, expected.length);
  actual.forEach((value, i) => assert.closeTo(value, expected[i], 1e-9));
}

function renderFeature(geometry) {
  return new RenderFeature(
    'Polygon',
    geometry.getOrientedFlatCoordinates().slice(),
    geometry.getType() === 'Polygon'
      ? geometry.getEnds()
      : geometry.getEndss().flat(),
    geometry.getStride(),
    {},
  );
}

describe('rotated interior scanlines', function () {
  it('measures a vertical baseline without changing coordinates', function () {
    const polygon = fromExtent([-5, -50, 5, 50]);
    const before = polygon.getCoordinates();
    closePoint(polygon.getFlatInteriorPoint(), [0, 0, 10]);
    closePoint(polygon.getFlatInteriorPoint(Math.PI / 2), [0, 0, 100]);
    closePoint(polygon.getFlatInteriorPoint(-Math.PI / 2), [0, 0, 100]);
    closePoint(polygon.getFlatInteriorPoint(Math.PI), [0, 0, 10]);
    assert.deepEqual(polygon.getCoordinates(), before);
  });

  it('uses actual edge intersections rather than the extent width', function () {
    const polygon = new Polygon([
      [
        [0, -10],
        [-2, 0],
        [0, 10],
        [2, 0],
        [0, -10],
      ],
    ]);
    closePoint(polygon.getFlatInteriorPoint(Math.PI / 4), [
      0,
      0,
      (10 * Math.SQRT2) / 3,
    ]);
    closePoint(polygon.getFlatInteriorPoint(Math.PI / 2), [0, 0, 20]);
  });

  it('selects an interior segment of a concave polygon', function () {
    const polygon = new Polygon([
      [
        [-10, -10],
        [10, -10],
        [10, 10],
        [4, 10],
        [4, -4],
        [-4, -4],
        [-4, 10],
        [-10, 10],
        [-10, -10],
      ],
    ]);
    closePoint(polygon.getFlatInteriorPoint(Math.PI / 2), [0, -7, 6]);
  });

  it('excludes holes, also with a nonzero offset and XYZ stride', function () {
    const flat = [
      99, 99, 99, -10, -20, 1, 10, -20, 2, 10, 20, 3, -10, 20, 4, -10, -20, 1,
      -4, -8, 5, -4, 8, 6, 4, 8, 7, 4, -8, 8, -4, -8, 5,
    ];
    const dest = [100];
    assert.strictEqual(
      getInteriorPointOfArray(
        flat,
        3,
        [18, 33],
        3,
        [99, 99, 0, 0],
        2,
        dest,
        Math.PI / 2,
      ),
      dest,
    );
    closePoint(dest, [100, 0, -14, 12]);
  });

  it('handles scanlines through vertices and along edges', function () {
    const polygon = new Polygon([
      [
        [0, -10],
        [-10, 0],
        [0, 10],
        [10, 0],
        [0, -10],
      ],
    ]);
    closePoint(polygon.getFlatInteriorPoint(Math.PI / 4), [
      0,
      0,
      10 * Math.SQRT2,
    ]);
    const flat = [0, 0, 10, 0, 10, 10, 0, 10, 0, 0];
    const point = getInteriorPointOfArray(
      flat,
      0,
      [10],
      2,
      [0, 5],
      0,
      undefined,
      Math.PI / 2,
    );
    assert.isFalse(Number.isNaN(point[0]));
    assert.isFalse(Number.isNaN(point[1]));
    assert.isFalse(Number.isNaN(point[2]));
  });

  it('falls back for empty and degenerate rings', function () {
    closePoint(
      getInteriorPointOfArray([], 0, [], 2, [1, 2], 0, undefined, 1).slice(
        0,
        2,
      ),
      [1, 2],
    );
    const point = getInteriorPointOfArray(
      [0, 0, 0, 0],
      0,
      [4],
      2,
      [0, 0],
      0,
      undefined,
      1,
    );
    assert.deepEqual(point, [0, 0, -Infinity]);
  });

  for (const type of [
    'Polygon',
    'MultiPolygon',
    'RenderFeature Polygon',
    'RenderFeature MultiPolygon',
  ]) {
    it(`caches by rotation for ${type}`, function () {
      const polygon = fromExtent([-5, -50, 5, 50]);
      const multi = new MultiPolygon([polygon, fromExtent([15, -30, 25, 30])]);
      let geometry = type.includes('MultiPolygon') ? multi : polygon;
      if (type.startsWith('RenderFeature')) {
        geometry = renderFeature(geometry);
      }
      const getPoint = type.includes('MultiPolygon')
        ? (rotation) => geometry.getFlatInteriorPoints(rotation)
        : (rotation) => geometry.getFlatInteriorPoint(rotation);
      const horizontal = getPoint();
      assert.strictEqual(getPoint(0), horizontal);
      assert.strictEqual(horizontal[2], 10);
      const vertical = getPoint(Math.PI / 2);
      assert.notStrictEqual(vertical, horizontal);
      assert.strictEqual(getPoint(Math.PI / 2), vertical);
      closePoint(vertical.slice(0, 3), [0, 0, 100]);
      if (type.includes('MultiPolygon')) {
        closePoint(vertical.slice(3), [20, 0, 60]);
      }
      assert.deepEqual(getPoint(), horizontal);
      assert.deepEqual(getPoint(-Math.PI / 2), vertical);
      if (!type.startsWith('RenderFeature')) {
        geometry.translate(10, 20);
        closePoint(getPoint(-Math.PI / 2).slice(0, 3), [10, 20, 100]);
      }
    });
  }

  it('agrees with rotating the coordinates about the scanline center', function () {
    const polygon = new Polygon([
      [
        [-20, -15],
        [20, -15],
        [20, 15],
        [7, 15],
        [7, -3],
        [-2, -3],
        [-2, 15],
        [-20, 15],
        [-20, -15],
      ],
      [
        [-15, -9],
        [-15, 2],
        [-8, 2],
        [-8, -9],
        [-15, -9],
      ],
    ]);
    for (const angle of [0.1, -0.3, 0.8, 1.6, 2.5]) {
      const rotated = polygon.clone();
      rotated.rotate(-angle, [0, 0]);
      const expected = getInteriorPointOfArray(
        rotated.getFlatCoordinates(),
        0,
        rotated.getEnds(),
        2,
        [0, 0],
        0,
      );
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      closePoint(polygon.getFlatInteriorPoint(angle), [
        expected[0] * cos,
        expected[0] * sin,
        expected[2],
      ]);
    }
  });
});
