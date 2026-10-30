/**
 * @module ol/render/canvas/lineDash
 */

/**
 * Append a dashed line, clipping segments to a buffered pixel extent. Keep all
 * fragments in the same path (and stroke) so translucent overlaps are unchanged.
 * Each new fragment gets an invisible lead-in of less than one dash period,
 * making the omitted prefix an integer number of periods. This preserves phase
 * without changing the context's dash offset for individual subpaths.
 *
 * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} context Context.
 * @param {Array<number>} coordinates Pixel coordinates.
 * @param {number} offset Start.
 * @param {number} end End.
 * @param {number} period Dash period in pixels, including odd-pattern repetition.
 * @param {import('../../extent.js').Extent} extent Buffered pixel extent.
 */
export function drawClippedLineString(
  context,
  coordinates,
  offset,
  end,
  period,
  extent,
) {
  let x = coordinates[offset];
  let y = coordinates[offset + 1];
  let phase = 0;
  let connected = false;
  for (let i = offset + 2; i < end; i += 2) {
    const nextX = coordinates[i];
    const nextY = coordinates[i + 1];
    // Match the executor's removal of consecutive vertices in the same pixel.
    if (
      i < end - 2 &&
      ((x + 0.5) | 0) === ((nextX + 0.5) | 0) &&
      ((y + 0.5) | 0) === ((nextY + 0.5) | 0)
    ) {
      continue;
    }
    const dx = nextX - x;
    const dy = nextY - y;
    const length = Math.hypot(dx, dy);
    // Liang-Barsky clipping, without allocating segment geometries.
    let start = 0;
    let stop = 1;
    for (let edge = 0; edge < 4; ++edge) {
      const p = edge === 0 ? -dx : edge === 1 ? dx : edge === 2 ? -dy : dy;
      const q =
        edge === 0
          ? x - extent[0]
          : edge === 1
            ? extent[2] - x
            : edge === 2
              ? y - extent[1]
              : extent[3] - y;
      if (p === 0) {
        if (q < 0) {
          stop = -1;
          break;
        }
      } else if (p < 0) {
        start = Math.max(start, q / p);
      } else {
        stop = Math.min(stop, q / p);
      }
    }
    if (start <= stop) {
      if (!connected) {
        const lead = (phase + start * length) % period;
        const t = length ? start - lead / length : 0;
        context.moveTo(x + t * dx, y + t * dy);
      }
      context.lineTo(x + stop * dx, y + stop * dy);
      connected = stop === 1;
    } else {
      connected = false;
    }
    phase = (phase + length) % period;
    x = nextX;
    y = nextY;
  }
}
