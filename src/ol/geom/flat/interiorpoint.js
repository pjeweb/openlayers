/**
 * @module ol/geom/flat/interiorpoint
 */
import {ascending} from '../../array.js';
import {linearRingsContainsXY} from './contains.js';

/**
 * Calculates a point that is likely to lie in the interior of the linear rings.
 * Inspired by JTS's com.vividsolutions.jts.geom.Geometry#getInteriorPoint.
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {Array<number>} ends Ends.
 * @param {number} stride Stride.
 * @param {Array<number>} flatCenters Flat centers.
 * @param {number} flatCentersOffset Flat center offset.
 * @param {Array<number>} [dest] Destination.
 * @param {number} [rotation] Scanline rotation in radians, counterclockwise.
 * @return {Array<number>} Destination point as XYM coordinate, where M is the
 * length of the scanline intersection that the point belongs to.
 */
export function getInteriorPointOfArray(
  flatCoordinates,
  offset,
  ends,
  stride,
  flatCenters,
  flatCentersOffset,
  dest,
  rotation = 0,
) {
  if (rotation) {
    return getRotatedInteriorPoint(
      flatCoordinates,
      offset,
      ends,
      stride,
      flatCenters,
      flatCentersOffset,
      rotation,
      dest,
    );
  }
  let i, ii, x, x1, x2, y1, y2;
  const y = flatCenters[flatCentersOffset + 1];
  /** @type {Array<number>} */
  const intersections = [];
  // Calculate intersections with the horizontal line
  for (let r = 0, rr = ends.length; r < rr; ++r) {
    const end = ends[r];
    x1 = flatCoordinates[end - stride];
    y1 = flatCoordinates[end - stride + 1];
    for (i = offset; i < end; i += stride) {
      x2 = flatCoordinates[i];
      y2 = flatCoordinates[i + 1];
      if ((y <= y1 && y2 <= y) || (y1 <= y && y <= y2)) {
        x = ((y - y1) / (y2 - y1)) * (x2 - x1) + x1;
        intersections.push(x);
      }
      x1 = x2;
      y1 = y2;
    }
  }
  // Find the longest segment of the horizontal line that has its center point
  // inside the linear ring.
  let pointX = NaN;
  let maxSegmentLength = -Infinity;
  intersections.sort(ascending);
  x1 = intersections[0];
  for (i = 1, ii = intersections.length; i < ii; ++i) {
    x2 = intersections[i];
    const segmentLength = Math.abs(x2 - x1);
    if (segmentLength > maxSegmentLength) {
      x = (x1 + x2) / 2;
      if (linearRingsContainsXY(flatCoordinates, offset, ends, stride, x, y)) {
        pointX = x;
        maxSegmentLength = segmentLength;
      }
    }
    x1 = x2;
  }
  if (isNaN(pointX)) {
    // There is no horizontal line that has its center point inside the linear
    // ring.  Use the center of the linear ring's extent.
    pointX = flatCenters[flatCentersOffset];
  }
  if (dest) {
    dest.push(pointX, y, maxSegmentLength);
    return dest;
  }
  return [pointX, y, maxSegmentLength];
}

/**
 * Intersect a line through the extent center with the rings, projecting only
 * the intersections onto the label baseline instead of rotating the geometry.
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {Array<number>} ends Ends.
 * @param {number} stride Stride.
 * @param {Array<number>} flatCenters Flat centers.
 * @param {number} flatCentersOffset Flat center offset.
 * @param {number} rotation Scanline rotation.
 * @param {Array<number>} [dest] Destination.
 * @return {Array<number>} Interior point as XYM.
 */
function getRotatedInteriorPoint(
  flatCoordinates,
  offset,
  ends,
  stride,
  flatCenters,
  flatCentersOffset,
  rotation,
  dest,
) {
  const centerX = flatCenters[flatCentersOffset];
  const centerY = flatCenters[flatCentersOffset + 1];
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const intersections = [];
  let ringOffset = offset;
  for (let r = 0; r < ends.length; ++r) {
    const end = ends[r];
    let x1 = flatCoordinates[end - stride] - centerX;
    let y1 = flatCoordinates[end - stride + 1] - centerY;
    let distance1 = cos * y1 - sin * x1;
    for (let i = ringOffset; i < end; i += stride) {
      const x2 = flatCoordinates[i] - centerX;
      const y2 = flatCoordinates[i + 1] - centerY;
      const distance2 = cos * y2 - sin * x2;
      // A half-open interval counts a crossing vertex only once and ignores
      // edges parallel to the scanline.
      if (
        (distance1 <= 0 && distance2 > 0) ||
        (distance2 <= 0 && distance1 > 0)
      ) {
        const fraction = distance1 / (distance1 - distance2);
        const x = x1 + fraction * (x2 - x1);
        const y = y1 + fraction * (y2 - y1);
        intersections.push(cos * x + sin * y);
      }
      x1 = x2;
      y1 = y2;
      distance1 = distance2;
    }
    ringOffset = end;
  }
  intersections.sort(ascending);
  let pointX = centerX;
  let pointY = centerY;
  let maxSegmentLength = -Infinity;
  for (let i = 1; i < intersections.length; ++i) {
    const length = intersections[i] - intersections[i - 1];
    if (length > maxSegmentLength) {
      const midpoint = (intersections[i] + intersections[i - 1]) / 2;
      const x = centerX + cos * midpoint;
      const y = centerY + sin * midpoint;
      if (linearRingsContainsXY(flatCoordinates, offset, ends, stride, x, y)) {
        pointX = x;
        pointY = y;
        maxSegmentLength = length;
      }
    }
  }
  if (dest) {
    dest.push(pointX, pointY, maxSegmentLength);
    return dest;
  }
  return [pointX, pointY, maxSegmentLength];
}

/**
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {Array<Array<number>>} endss Endss.
 * @param {number} stride Stride.
 * @param {Array<number>} flatCenters Flat centers.
 * @param {number} [rotation] Scanline rotation in radians, counterclockwise.
 * @return {Array<number>} Interior points as XYM coordinates, where M is the
 * length of the scanline intersection that the point belongs to.
 */
export function getInteriorPointsOfMultiArray(
  flatCoordinates,
  offset,
  endss,
  stride,
  flatCenters,
  rotation = 0,
) {
  /** @type {Array<number>} */
  let interiorPoints = [];
  for (let i = 0, ii = endss.length; i < ii; ++i) {
    const ends = endss[i];
    interiorPoints = getInteriorPointOfArray(
      flatCoordinates,
      offset,
      ends,
      stride,
      flatCenters,
      2 * i,
      interiorPoints,
      rotation,
    );
    offset = ends[ends.length - 1];
  }
  return interiorPoints;
}
