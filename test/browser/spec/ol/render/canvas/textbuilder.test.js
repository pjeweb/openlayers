import {assert} from 'chai';
import Feature from '../../../../../../src/ol/Feature.js';
import Circle from '../../../../../../src/ol/geom/Circle.js';
import LineString from '../../../../../../src/ol/geom/LineString.js';
import MultiLineString from '../../../../../../src/ol/geom/MultiLineString.js';
import MultiPoint from '../../../../../../src/ol/geom/MultiPoint.js';
import MultiPolygon from '../../../../../../src/ol/geom/MultiPolygon.js';
import Point from '../../../../../../src/ol/geom/Point.js';
import Polygon, {fromExtent} from '../../../../../../src/ol/geom/Polygon.js';
import RenderFeature from '../../../../../../src/ol/render/Feature.js';
import Executor from '../../../../../../src/ol/render/canvas/Executor.js';
import CanvasInstruction from '../../../../../../src/ol/render/canvas/Instruction.js';
import TextBuilder from '../../../../../../src/ol/render/canvas/TextBuilder.js';
import Text from '../../../../../../src/ol/style/Text.js';
import {
  compose,
  create as createTransform,
} from '../../../../../../src/ol/transform.js';

function createBuilder() {
  return new TextBuilder(1, [-180, -90, 180, 90], 0.02, 1, true);
}

function createContext() {
  return {
    canvas: {width: 200, height: 200},
    fill: function () {},
    stroke: function () {},
    beginPath: function () {},
    clip: function () {},
    moveTo: function () {},
    lineTo: function () {},
    closePath: function () {},
    setLineDash: function () {},
    save: function () {},
    restore: function () {},
  };
}

function executeInstructions(
  builder,
  expectedDrawTextImageCalls,
  expectedBuilderImageCalls,
) {
  const transform = createTransform();
  const context = createContext();
  const executor = new Executor(0.02, 1, false, builder.finish());
  vi.spyOn(executor, 'drawLabelWithPointPlacement_');
  const replayImageOrLabelStub = vi
    .spyOn(executor, 'replayImageOrLabel_')
    .mockImplementation(() => {});
  executor.execute(context, 1, transform, 0);
  assert.strictEqual(
    executor.drawLabelWithPointPlacement_.mock.calls.length,
    expectedDrawTextImageCalls,
  );
  assert.strictEqual(
    replayImageOrLabelStub.mock.calls.length,
    expectedBuilderImageCalls,
  );
}

describe('ol.render.canvas.TextBuilder', function () {
  it('builds correct coordinates array with a stride of 2 for geometries with 2 dimensions', function () {
    const builder = createBuilder();
    const features = [
      new Feature(new Point([0, 0])),
      new Feature(new Point([1, 1])),
      new Feature(
        new MultiLineString([
          new LineString([
            [1, 1],
            [3, 3],
          ]),
          new LineString([
            [2, 2],
            [4, 4],
          ]),
        ]),
      ),
      new Feature(
        new LineString([
          [3, 3],
          [5, 5],
        ]),
      ),
      new Feature(new Circle([5, 5, 7], 4)),
      new Feature(
        new MultiPoint([
          [6, 6],
          [7, 7],
        ]),
      ),
      new Feature(
        new Polygon([
          [
            [7, 7],
            [7, 9],
            [9, 9],
            [9, 7],
            [7, 7],
          ],
        ]),
      ),
      new Feature(
        new MultiPolygon([
          new Polygon([
            [
              [8, 8],
              [8, 10],
              [10, 10],
              [10, 8],
              [8, 8],
            ],
          ]),
          new Polygon([
            [
              [9, 9],
              [9, 11],
              [11, 11],
              [11, 9],
              [9, 9],
            ],
          ]),
        ]),
      ),
    ];
    builder.setTextStyle(
      new Text({
        text: 'Text',
      }),
    );
    features.forEach(function (feature) {
      builder.drawText(feature.getGeometry(), feature);
    });
    assert.deepEqual(
      builder.coordinates,
      [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10],
    );
  });

  it('builds correct coordinates array with a stride of 2 for geometries with 3 dimensions', function () {
    const builder = createBuilder();
    const features = [
      new Feature(new Point([0, 0, 1])),
      new Feature(new Point([1, 1, 2])),
      new Feature(
        new MultiLineString([
          new LineString([
            [1, 1, 1],
            [3, 3, 2],
          ]),
          new LineString([
            [2, 2, 3],
            [4, 4, 4],
          ]),
        ]),
      ),
      new Feature(
        new LineString([
          [3, 3, 5],
          [5, 5, 6],
        ]),
      ),
      new Feature(new Circle([5, 5, 7], 4)),
      new Feature(
        new MultiPoint([
          [6, 6, 8],
          [7, 7, 9],
        ]),
      ),
      new Feature(
        new Polygon([
          [
            [7, 7, 1],
            [7, 9, 2],
            [9, 9, 3],
            [9, 7, 4],
            [7, 7, 5],
          ],
        ]),
      ),
      new Feature(
        new MultiPolygon([
          new Polygon([
            [
              [8, 8, 1],
              [8, 10, 2],
              [10, 10, 3],
              [10, 8, 4],
              [8, 8, 1],
            ],
          ]),
          new Polygon([
            [
              [9, 9, 5],
              [9, 11, 6],
              [11, 11, 7],
              [11, 9, 8],
              [9, 9, 5],
            ],
          ]),
        ]),
      ),
    ];
    builder.setTextStyle(
      new Text({
        text: 'Text',
      }),
    );
    features.forEach(function (feature) {
      builder.drawText(feature.getGeometry(), feature);
    });
    assert.deepEqual(
      builder.coordinates,
      [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10],
    );
  });

  it('renders polygon labels only when they fit', function () {
    let builder = createBuilder();
    const geometry = new Polygon([
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    ]);
    const feature = new Feature(geometry);

    builder.setTextStyle(
      new Text({
        text: 'This is a long text',
      }),
    );
    builder.drawText(geometry, feature);
    assert.strictEqual(builder.instructions.length, 3);
    executeInstructions(builder, 1, 0);

    builder = createBuilder();
    builder.setTextStyle(
      new Text({
        text: 'short',
      }),
    );
    builder.drawText(geometry, feature);
    assert.strictEqual(builder.instructions.length, 3);
    executeInstructions(builder, 1, 1);
  });

  it('renders multipolygon labels only when they fit', function () {
    const geometry = new MultiPolygon([
      [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
      [
        [
          [1, 1],
          [1, 2],
          [2, 2],
          [2, 1],
          [1, 1],
        ],
      ],
    ]);
    const feature = new Feature(geometry);

    let builder = createBuilder();
    builder.setTextStyle(
      new Text({
        text: 'This is a long text',
      }),
    );
    builder.drawText(geometry, feature);
    assert.strictEqual(builder.instructions.length, 3);
    executeInstructions(builder, 1, 0);

    builder = createBuilder();
    builder.setTextStyle(
      new Text({
        text: 'short',
      }),
    );
    builder.drawText(geometry, feature);
    assert.strictEqual(builder.instructions.length, 3);
    executeInstructions(builder, 1, 2);
  });

  it('retains all multipolygon anchors for rotation at execution time', function () {
    const feature = new Feature(
      new MultiPolygon([
        [
          [
            [-180, -90],
            [-180, 90],
            [-50, 90],
            [-50, -90],
            [-180, -90],
          ],
        ],
        [
          [
            [-50, -90],
            [-50, 90],
            [70, 90],
            [70, -90],
            [-50, -90],
          ],
        ],
        [
          [
            [70, -90],
            [70, 90],
            [180, 90],
            [180, -90],
            [70, -90],
          ],
        ],
      ]),
    );
    const builder = new TextBuilder(1, [-50, -90, 70, 90], 1, 1);
    builder.setTextStyle(
      new Text({
        text: 'text',
      }),
    );
    builder.drawText(feature.getGeometry(), feature);
    assert.lengthOf(builder.coordinates, 6);
    assert.lengthOf(builder.instructions, 3);
    const geometryWidths = builder.instructions[1][25];
    assert.deepEqual(geometryWidths, [130, 120, 110]);
    executeInstructions(builder, 1, 1);
  });

  describe('rotated polygon label fit', function () {
    function createExecutor(
      geometry,
      rotation,
      rotateWithView,
      overflow = false,
      pixelRatio = 1,
      maxExtent = [-200, -200, 200, 200],
    ) {
      const feature =
        geometry instanceof RenderFeature ? geometry : new Feature(geometry);
      const builder = new TextBuilder(0, maxExtent, 1, pixelRatio);
      builder.setTextStyle(
        new Text({text: 'label', rotation, rotateWithView, overflow}),
      );
      builder.drawText(geometry, feature);
      const executor = new Executor(1, pixelRatio, false, builder.finish());
      vi.spyOn(executor, 'drawLabelWithPointPlacement_').mockReturnValue({
        label: {width: 40 * pixelRatio, height: 10 * pixelRatio},
        anchorX: 20,
        anchorY: 5,
      });
      vi.spyOn(executor, 'replayImageOrLabel_').mockImplementation(() => {});
      return executor;
    }

    function execute(executor, viewRotation, canvasRotated) {
      const transform = compose(
        createTransform(),
        100,
        100,
        1,
        -1,
        canvasRotated ? -viewRotation : 0,
        0,
        0,
      );
      executor.replayImageOrLabel_.mockClear();
      executor.execute(
        createContext(),
        [200, 200],
        transform,
        viewRotation,
        false,
      );
      return executor.replayImageOrLabel_.mock.calls.length;
    }

    const halfPi = Math.PI / 2;
    for (const [textRotation, viewRotation, rotateWithView, count] of [
      [0, 0, false, 0],
      [halfPi, 0, false, 1],
      [0, halfPi, false, 1],
      [0, halfPi, true, 0],
      [halfPi, halfPi, false, 0],
      [halfPi, halfPi, true, 1],
      [halfPi / 2, halfPi / 2, false, 0],
      [-halfPi / 2, halfPi / 2, false, 1],
    ]) {
      for (const canvasRotated of [false, true]) {
        it(`fits text=${textRotation}, view=${viewRotation}, rotateWithView=${rotateWithView}, canvasRotated=${canvasRotated}`, function () {
          const executor = createExecutor(
            fromExtent([-5, -50, 5, 50]),
            textRotation,
            rotateWithView,
          );
          assert.strictEqual(
            execute(executor, viewRotation, canvasRotated),
            count,
          );
        });
      }
    }

    it('reuses instructions through view rotations and for hit detection', function () {
      const executor = createExecutor(
        fromExtent([-5, -50, 5, 50]),
        0,
        false,
        false,
        2,
      );
      assert.strictEqual(execute(executor, 0, false), 0);
      assert.strictEqual(execute(executor, halfPi, false), 1);
      assert.strictEqual(execute(executor, 0, true), 0);
      const transform = compose(
        createTransform(),
        100,
        100,
        1,
        -1,
        -halfPi,
        0,
        0,
      );
      executor.executeHitDetection(
        createContext(),
        transform,
        halfPi,
        () => {},
      );
      assert.strictEqual(executor.replayImageOrLabel_.mock.calls.length, 1);
    });

    it('leaves overflow enabled regardless of the baseline', function () {
      const executor = createExecutor(
        fromExtent([-5, -50, 5, 50]),
        0,
        true,
        true,
      );
      assert.strictEqual(execute(executor, 0, false), 1);
      assert.strictEqual(execute(executor, halfPi, false), 1);
    });

    for (const renderFeature of [false, true]) {
      it(`tests each multipolygon component (RenderFeature=${renderFeature})`, function () {
        const multi = new MultiPolygon([
          fromExtent([-5, -50, 5, 50]),
          fromExtent([20, -5, 120, 5]),
        ]);
        const geometry = renderFeature
          ? new RenderFeature(
              'MultiPolygon',
              multi.getOrientedFlatCoordinates(),
              multi.getEndss().flat(),
              2,
              {},
            )
          : multi;
        const executor = createExecutor(geometry, 0, false);
        assert.strictEqual(execute(executor, 0, false), 1);
        assert.strictEqual(execute(executor, halfPi, false), 1);
      });
    }

    it('clips the current anchor instead of the original anchor', function () {
      const polygon = new Polygon([
        [
          [-50, -50],
          [50, -50],
          [50, 50],
          [20, 50],
          [20, -20],
          [-20, -20],
          [-20, 50],
          [-50, 50],
          [-50, -50],
        ],
      ]);
      const executor = createExecutor(
        polygon,
        0,
        false,
        false,
        1,
        [-10, -50, 10, 0],
      );
      executor.drawLabelWithPointPlacement_.mockReturnValue({
        label: {width: 20, height: 10},
        anchorX: 10,
        anchorY: 5,
      });
      assert.strictEqual(execute(executor, 0, false), 0);
      assert.strictEqual(execute(executor, halfPi, false), 1);
    });

    it('fits RenderFeature polygon labels against the rotated baseline', function () {
      const polygon = fromExtent([-5, -50, 5, 50]);
      const geometry = new RenderFeature(
        'Polygon',
        polygon.getFlatCoordinates(),
        polygon.getEnds(),
        2,
        {},
      );
      const executor = createExecutor(geometry, 0, false);
      assert.strictEqual(execute(executor, 0, false), 0);
      assert.strictEqual(execute(executor, halfPi, true), 1);
    });

    it('uses the rotated anchor in a concave polygon', function () {
      const polygon = new Polygon([
        [
          [-50, -50],
          [50, -50],
          [50, 50],
          [20, 50],
          [20, -20],
          [-20, -20],
          [-20, 50],
          [-50, 50],
          [-50, -50],
        ],
      ]);
      const executor = createExecutor(polygon, halfPi, false);
      assert.strictEqual(execute(executor, 0, false), 0);
      // Make the label shorter than the 30-unit vertical segment.
      executor.instructions[1][13] = 20;
      assert.strictEqual(execute(executor, 0, false), 1);
      const dimensions = executor.replayImageOrLabel_.mock.calls[0][3];
      assert.closeTo(dimensions.declutterBox.minY, 115, 1e-9);
    });
  });

  describe('line label clipping to the rendered extent', function () {
    const geometry = new LineString([
      [-360, 0],
      [360, 0],
    ]);
    const feature = new Feature(geometry);

    it('clips the line to the rendered extent when textAlign is not set', function () {
      const builder = createBuilder();
      builder.setTextStyle(
        new Text({
          text: 'text',
          placement: 'line',
        }),
      );
      builder.drawText(geometry, feature);
      assert.deepEqual(builder.coordinates, [-180, 0, 180, 0]);
    });

    it('keeps the full line when textAlign is set explicitly', function () {
      const builder = createBuilder();
      builder.setTextStyle(
        new Text({
          text: 'text',
          placement: 'line',
          textAlign: 'center',
        }),
      );
      builder.drawText(geometry, feature);
      assert.deepEqual(builder.coordinates, [-360, 0, 360, 0]);
    });
  });

  describe('offsetX for text along a line', function () {
    function drawCharsInstruction(offsetX, pixelRatio) {
      const builder = new TextBuilder(
        1,
        [-180, -90, 180, 90],
        0.02,
        pixelRatio,
      );
      const feature = new Feature(
        new LineString([
          [-90, 0],
          [90, 0],
        ]),
      );
      builder.setTextStyle(
        new Text({
          text: 'text',
          placement: 'line',
          offsetX: offsetX,
        }),
      );
      builder.drawText(feature.getGeometry(), feature);
      return builder.instructions.find(
        (instruction) => instruction[0] === CanvasInstruction.DRAW_CHARS,
      );
    }

    it('passes the offset to the drawChars instruction, scaled by pixelRatio', function () {
      const instruction = drawCharsInstruction(10, 2);
      assert.isDefined(instruction);
      assert.strictEqual(instruction[16], 20);
    });

    it('passes 0 when no offset is configured', function () {
      const instruction = drawCharsInstruction(undefined, 1);
      assert.isDefined(instruction);
      assert.strictEqual(instruction[16], 0);
    });
  });
});
