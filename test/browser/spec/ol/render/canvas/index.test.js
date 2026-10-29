import {assert} from 'chai';
import * as render from '../../../../../../src/ol/render/canvas.js';
import {createFontStyle} from '../../../util.js';

describe('ol.render.canvas', function () {
  const localFontFamily = 'Ubuntu - CanvasIndexTest';
  const font = createFontStyle({
    fontFamily: localFontFamily,
    src: {
      url: '/spec/ol/data/fonts/ubuntu-regular-webfont.woff2',
      format: 'woff2',
    },
  });

  describe('ol.render.canvas.registerFont()', function () {
    beforeEach(() => {
      render.measureTextHeight('12px sans-serif');
    });

    afterEach(() => {
      font.remove();
    });

    const retries = 100;

    it('does not trigger redraw and clear measurements for unavailable fonts', () =>
      new Promise((resolve) => {
        const spy = vi.fn();
        render.checkedFonts.addEventListener('propertychange', spy);
        const interval = setInterval(function () {
          if (render.checkedFonts.get('normal 400 16px "foo"') == retries) {
            clearInterval(interval);
            render.checkedFonts.removeEventListener('propertychange', spy);
            assert.strictEqual(spy.mock.calls.length, 0);
            assert.notDeepEqual(render.textHeights, {});
            resolve();
          }
        }, 100);
        render.registerFont('12px foo,sans-serif');
      }));

    it('does not trigger redraw and clear measurements for available fonts', () =>
      new Promise((resolve) => {
        const spy = vi.fn();
        render.checkedFonts.addEventListener('propertychange', spy);
        setTimeout(function () {
          render.checkedFonts.removeEventListener('propertychange', spy);
          assert.strictEqual(spy.mock.calls.length, 0);
          assert.notDeepEqual(render.textHeights, {});
          resolve();
        }, 1000);
        render.registerFont('12px sans-serif');
      }));

    it("does not trigger redraw and clear measurements for the 'monospace' font", () =>
      new Promise((resolve) => {
        const spy = vi.fn();
        render.checkedFonts.addEventListener('propertychange', spy);
        setInterval(function () {
          render.checkedFonts.removeEventListener('propertychange', spy);
          assert.strictEqual(spy.mock.calls.length, 0);
          assert.notDeepEqual(render.textHeights, {});
          resolve();
        }, 1000);
        render.registerFont('12px monospace');
      }));

    describe('font check batches', () => {
      let faces, loads, finishLoading, changes;

      beforeEach(async () => {
        await document.fonts.ready;
        faces = ['BatchA', 'BatchB'].map(
          (family) => new FontFace(family, 'url(/unused.woff2)'),
        );
        finishLoading = [];
        loads = faces.map((face, i) => {
          document.fonts.add(face);
          const loaded = new Promise((resolve) => {
            finishLoading[i] = () => resolve(face);
          });
          return vi.spyOn(face, 'load').mockReturnValue(loaded);
        });
        changes = vi.fn();
        render.checkedFonts.addEventListener('propertychange', changes);
        vi.useFakeTimers();
      });

      afterEach(async () => {
        finishLoading.forEach((finish) => finish());
        await vi.advanceTimersByTimeAsync(1000);
        vi.useRealTimers();
        loads.forEach((load) => load.mockRestore());
        faces.forEach((face) => document.fonts.delete(face));
        render.checkedFonts.removeEventListener('propertychange', changes);
        faces.forEach((face) => {
          render.checkedFonts.unset(`normal 400 16px "${face.family}"`, true);
        });
      });

      it('starts all loads before waiting and notifies after the batch', async () => {
        render.registerFont('12px "BatchA", "BatchB"');
        await vi.advanceTimersByTimeAsync(100);
        assert.strictEqual(loads[0].mock.calls.length, 1);
        assert.strictEqual(loads[1].mock.calls.length, 1);

        finishLoading[0]();
        await vi.advanceTimersByTimeAsync(0);
        assert.strictEqual(changes.mock.calls.length, 0);

        finishLoading[1]();
        await vi.advanceTimersByTimeAsync(0);
        assert.strictEqual(changes.mock.calls.length, 2);
        assert.deepEqual(render.textHeights, {});
      });

      it('retries a failed load without suppressing an available font', async () => {
        loads[0].mockRejectedValue(new Error('Font unavailable'));
        render.registerFont('12px BatchA, BatchB');
        await vi.advanceTimersByTimeAsync(100);
        finishLoading[1]();
        await vi.advanceTimersByTimeAsync(1000);
        assert.strictEqual(changes.mock.calls.length, 1);
        assert.strictEqual(
          changes.mock.calls[0][0].key,
          'normal 400 16px "BatchB"',
        );
        assert.strictEqual(loads[0].mock.calls.length, 10);
        assert.strictEqual(
          render.checkedFonts.get('normal 400 16px "BatchA"'),
          retries,
        );
      });

      it('checks fonts registered during a pending batch without overlapping', async () => {
        render.registerFont('12px "BatchA"');
        await vi.advanceTimersByTimeAsync(100);
        render.registerFont('12px "BatchB"');
        await vi.advanceTimersByTimeAsync(200);
        assert.strictEqual(loads[0].mock.calls.length, 1);
        assert.strictEqual(loads[1].mock.calls.length, 0);

        finishLoading[0]();
        await vi.advanceTimersByTimeAsync(100);
        assert.strictEqual(loads[1].mock.calls.length, 1);
        finishLoading[1]();
        await vi.advanceTimersByTimeAsync(0);
        assert.strictEqual(changes.mock.calls.length, 2);
        assert.strictEqual(
          render.checkedFonts.get('normal 400 16px "BatchB"'),
          retries,
        );
      });
    });

    it('triggers redraw and clear measurements for fonts that become available', () =>
      new Promise((resolve, reject) => {
        font.add();
        render.checkedFonts.addEventListener(
          'propertychange',
          function onPropertyChange(e) {
            render.checkedFonts.removeEventListener(
              'propertychange',
              onPropertyChange,
            );
            try {
              assert.strictEqual(e.key, `normal 400 16px "${localFontFamily}"`);
              assert.deepEqual(render.textHeights, {});
              resolve();
            } catch (err) {
              reject(err);
              return;
            }
          },
        );
        render.registerFont(`12px "${localFontFamily}"`);
      }));
  });

  describe('measureTextHeight', function () {
    it('respects line-height', function () {
      const height = render.measureTextHeight('12px/1.2 sans-serif');
      assert.isAbove(render.measureTextHeight('12px/2.4 sans-serif'), height);
      assert.isBelow(render.measureTextHeight('12px/0.1 sans-serif'), height);
    });
  });

  describe('rotateAtOffset', function () {
    it('rotates a canvas at an offset point', function () {
      const context = {
        translate: vi.fn(),
        rotate: vi.fn(),
      };
      render.rotateAtOffset(context, Math.PI, 10, 10);
      assert.strictEqual(context.translate.mock.calls.length, 2);
      assert.deepEqual(context.translate.mock.calls[0], [10, 10]);
      assert.deepEqual(context.translate.mock.calls[1], [-10, -10]);
      assert.strictEqual(context.rotate.mock.calls.length, 1);
      assert.deepEqual(context.rotate.mock.calls[0], [Math.PI]);
    });
  });

  describe('drawImageOrLabel', function () {
    it('draws the image with correct parameters', function () {
      const layerContext = {
        save: vi.fn(),
        transform: vi.fn(),
        drawImage: vi.fn(),
        restore: vi.fn(),
        globalAlpha: 1,
      };
      const transform = [1, 0, 0, 1, 0, 0];
      const opacity = 0.5;
      const image = {};
      const x = 0;
      const y = 0;
      const w = 1;
      const h = 1;
      const scale = 1;

      render.drawImageOrLabel(
        layerContext,
        transform.slice(),
        opacity,
        image,
        x,
        y,
        w,
        h,
        x,
        y,
        scale,
      );

      assert.strictEqual(layerContext.save.mock.calls.length, 1);
      assert.strictEqual(layerContext.transform.mock.calls.length, 1);
      assert.deepEqual(layerContext.transform.mock.calls[0], transform);
      assert.strictEqual(layerContext.drawImage.mock.calls.length, 1);
      assert.strictEqual(layerContext.globalAlpha, 0.5);
      assert.strictEqual(layerContext.restore.mock.calls.length, 1);
    });
  });
});
