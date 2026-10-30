import {assert} from 'chai';
import Feature from '../../../../../../src/ol/Feature.js';
import Map from '../../../../../../src/ol/Map.js';
import View from '../../../../../../src/ol/View.js';
import {createCanvasContext2D} from '../../../../../../src/ol/dom.js';
import MVT from '../../../../../../src/ol/format/MVT.js';
import LineString from '../../../../../../src/ol/geom/LineString.js';
import MultiLineString from '../../../../../../src/ol/geom/MultiLineString.js';
import VectorLayer from '../../../../../../src/ol/layer/Vector.js';
import VectorTileLayer from '../../../../../../src/ol/layer/VectorTile.js';
import Executor from '../../../../../../src/ol/render/canvas/Executor.js';
import Instruction from '../../../../../../src/ol/render/canvas/Instruction.js';
import LineStringBuilder from '../../../../../../src/ol/render/canvas/LineStringBuilder.js';
import ZIndexContext from '../../../../../../src/ol/render/canvas/ZIndexContext.js';
import {drawClippedLineString} from '../../../../../../src/ol/render/canvas/lineDash.js';
import VectorSource from '../../../../../../src/ol/source/Vector.js';
import VectorTileSource from '../../../../../../src/ol/source/VectorTile.js';
import Stroke from '../../../../../../src/ol/style/Stroke.js';
import Style from '../../../../../../src/ol/style/Style.js';
import {createXYZ} from '../../../../../../src/ol/tilegrid.js';
import {compose, create} from '../../../../../../src/ol/transform.js';

describe('dashed Canvas line clipping', function () {
  it('bounds a crossing segment and preserves its phase', function () {
    const context = {moveTo: vi.fn(), lineTo: vi.fn()};
    drawClippedLineString(
      context,
      [-100003, 50, 100000, 50],
      0,
      4,
      10,
      [0, 0, 100, 100],
    );
    assert.lengthOf(context.moveTo.mock.calls, 1);
    assert.closeTo(context.moveTo.mock.calls[0][0], -3, 1e-8);
    assert.strictEqual(context.moveTo.mock.calls[0][1], 50);
    assert.lengthOf(context.lineTo.mock.calls, 1);
    assert.closeTo(context.lineTo.mock.calls[0][0], 100, 1e-8);
  });

  it('includes hidden bends in the phase when a line re-enters', function () {
    const context = {moveTo: vi.fn(), lineTo: vi.fn()};
    const line = [-13, 5, 25, 5, 25, 25, -13, 25, -13, 8, 25, 8];
    drawClippedLineString(context, line, 0, line.length, 10, [0, 0, 10, 10]);
    assert.lengthOf(context.moveTo.mock.calls, 2);
    assert.closeTo(context.moveTo.mock.calls[0][0], -3, 1e-8);
    assert.closeTo(context.moveTo.mock.calls[1][0], -6, 1e-8);
    assert.deepEqual(context.lineTo.mock.calls, [
      [10, 5],
      [10, 8],
    ]);
  });

  it('rejects parallel and diagonal segments outside the extent', function () {
    const context = {moveTo: vi.fn(), lineTo: vi.fn()};
    for (const line of [
      [-100, -1, 200, -1],
      [-100, 1, 1, -100],
      [101, 10, 101, 80],
    ]) {
      drawClippedLineString(context, line, 0, 4, 10, [0, 0, 100, 100]);
    }
    assert.equal(context.lineTo.mock.calls.length, 0);
  });

  it('retains offscreen bends and XYZ strides for dashed phase', function () {
    const builder = new LineStringBuilder(0, [0, 0, 100, 100], 1, 1);
    builder.setFillStrokeStyle(null, new Stroke({lineDash: [5, 5]}));
    const geometry = new LineString([
      [-100, -100, 1],
      [-200, -100, 2],
      [-200, 50, 3],
      [100, 50, 4],
    ]);
    builder.drawLineString(geometry, new Feature(geometry));
    const instructions = builder.finish();
    assert.deepEqual(
      instructions.coordinates,
      [-100, -100, -200, -100, -200, 50, 100, 50],
    );
    const move = instructions.instructions.find(
      (instruction) => instruction[0] === Instruction.MOVE_TO_LINE_TO,
    );
    assert.isTrue(move[5]);
    const hitMove = instructions.hitDetectionInstructions.find(
      (instruction) => instruction[0] === Instruction.MOVE_TO_LINE_TO,
    );
    assert.isUndefined(hitMove[5]);
  });

  const parts = [
    [
      [-1001, -3],
      [1000, -3],
    ],
    [
      [-1003, 41],
      [-701, -155],
      [-551, -155],
      [-551, 77],
      [50, 77],
      [86, 105],
      [104, 80],
      [330, 87],
      [330, 170],
      [-600, 170],
      [-600, 111],
      [400, 111],
    ],
    [
      [-1007, 133],
      [50, 133],
      [85, 105],
      [104, 130],
      [50, 133],
    ],
    [
      [20, 20],
      [20, 20],
    ],
  ];

  function build(stroke, ratio) {
    const builder = new LineStringBuilder(0, [0, 0, 240, 200], 1, ratio);
    builder.setFillStrokeStyle(null, new Stroke(stroke));
    const geometry = new MultiLineString(parts);
    builder.drawMultiLineString(geometry, new Feature(geometry));
    return builder.finish();
  }

  function render(bundle, transform, ratio, clip, deferred = false) {
    const context = createCanvasContext2D(240 * ratio, 200 * ratio);
    if (!clip) {
      bundle.instructions.forEach((instruction) => {
        if (instruction[0] === Instruction.MOVE_TO_LINE_TO) {
          instruction[5] = false;
        }
      });
    }
    const executor = new Executor(1, ratio, true, bundle);
    const zIndex = deferred ? new ZIndexContext() : null;
    executor.execute(
      zIndex ? zIndex.getContext() : context,
      [context.canvas.width, context.canvas.height],
      transform,
      0,
      true,
    );
    if (zIndex) {
      zIndex.draw(context);
    }
    return context.getImageData(
      0,
      0,
      context.canvas.width,
      context.canvas.height,
    ).data;
  }

  function compare(actual, expected) {
    let different = 0;
    for (let i = 3; i < actual.length; i += 4) {
      if (Math.abs(actual[i] - expected[i]) > 16) {
        different++;
      }
    }
    // Allow small rasterization differences from fractional clipped endpoints.
    assert.isBelow(different / (actual.length / 4), 0.002);
    assert.isTrue(
      expected.some((value) => value > 0),
      'reference must draw',
    );
  }

  for (const lineCap of ['butt', 'round', 'square']) {
    for (const lineJoin of ['miter', 'round', 'bevel']) {
      it(`matches an unclipped path with ${lineCap} caps and ${lineJoin} joins`, function () {
        const stroke = {
          color: 'rgba(30,80,150,0.5)',
          width: 9,
          lineCap,
          lineJoin,
          miterLimit: 12,
          lineDash: [7, 3, 5],
          lineDashOffset: -17,
        };
        for (const ratio of [1, 2]) {
          for (const rotation of [0, 0.37]) {
            const transform = compose(
              create(),
              11 * ratio,
              -3 * ratio,
              1.1 * ratio,
              1.1 * ratio,
              rotation,
              0,
              0,
            );
            compare(
              render(build(stroke, ratio), transform, ratio, true),
              render(build(stroke, ratio), transform, ratio, false),
            );
          }
        }
      });
    }
  }

  for (const lineDash of [
    [0, 0],
    [0, 7],
    [8, 4],
    [1, 0, 2, 5],
  ]) {
    it(`supports pattern ${lineDash} with stroke offsets and deferred drawing`, function () {
      const stroke = {
        color: 'rgba(0,0,0,0.4)',
        width: 6,
        lineDash,
        lineDashOffset: 123.5,
        offset: 13,
      };
      const transform = create();
      compare(
        render(build(stroke, 1), transform, 1, true, true),
        render(build(stroke, 1), transform, 1, false),
      );
    });
  }

  for (const renderBuffer of [0, 100]) {
    it(`keeps solid hit detection across gaps with renderBuffer ${renderBuffer}`, function () {
      const target = document.createElement('div');
      target.style.cssText = 'width:100px;height:100px';
      document.body.appendChild(target);
      const feature = new Feature(
        new LineString([
          [-10000, 0],
          [10000, 0],
        ]),
      );
      const layer = new VectorLayer({
        renderBuffer,
        source: new VectorSource({features: [feature]}),
        style: new Style({stroke: new Stroke({width: 6, lineDash: [5, 15]})}),
      });
      const map = new Map({
        target,
        pixelRatio: 1,
        layers: [layer],
        view: new View({center: [0, 0], resolution: 1}),
      });
      map.renderSync();
      map.getView().beginInteraction();
      let replayGroup;
      try {
        for (const center of [
          [0, 0],
          [15, 0],
        ]) {
          map.getView().setCenter(center);
          map.renderSync();
          const currentGroup = layer.getRenderer().replayGroup_;
          if (renderBuffer && replayGroup) {
            assert.strictEqual(
              currentGroup,
              replayGroup,
              'pan should reuse render instructions',
            );
          }
          replayGroup = currentGroup;
          for (let x = 10; x < 90; ++x) {
            assert.strictEqual(
              map.forEachFeatureAtPixel([x, 50], (hit) => hit),
              feature,
            );
          }
        }
      } finally {
        map.getView().endInteraction(0);
        map.dispose();
        target.remove();
      }
    });
  }

  it('clips scaled vector tile images to their full pixel extent', async function () {
    const target = document.createElement('div');
    target.style.cssText = 'width:256px;height:256px';
    document.body.appendChild(target);
    const tileGrid = createXYZ({maxZoom: 0});
    const layer = new VectorTileLayer({
      source: new VectorTileSource({
        format: new MVT(),
        tileGrid,
        url: '{z}/{x}/{y}',
        tileLoadFunction(tile) {
          tile.setLoader(() =>
            tile.setFeatures([
              new Feature(
                new LineString([
                  [-2e7, 0],
                  [2e7, 0],
                ]),
              ),
            ]),
          );
        },
      }),
      style: new Style({
        stroke: new Stroke({color: 'red', width: 4, lineDash: [10, 10]}),
      }),
    });
    // Overzooming by a fraction renders the hybrid tile image with a
    // renderScale below 1, so its canvas covers more pixel coordinates.
    const map = new Map({
      target,
      pixelRatio: 1,
      layers: [layer],
      view: new View({
        center: [0, 0],
        resolution: tileGrid.getResolution(0) / 1.23,
      }),
    });
    try {
      await new Promise((resolve) => map.once('rendercomplete', resolve));
      const canvas = target.querySelector('.ol-layer canvas');
      const data = canvas.getContext('2d').getImageData(226, 126, 24, 5).data;
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) {
        painted += data[i] > 0 ? 1 : 0;
      }
      assert.isAbove(painted, 20, 'dashes near the right edge are drawn');
    } finally {
      map.dispose();
      target.remove();
    }
  });
});
