import type {Type} from '../../../build/ol/geom/Geometry.js';
import Draw from '../../../build/ol/interaction/Draw.js';

const draw = new Draw({type: 'Point'});
draw.setType('MultiPolygon');
const type: Type = draw.getType();
draw.setType(type);
draw.setFreehand(true);
const freehand: boolean = draw.getFreehand();
draw.setFreehand(freehand);

// @ts-expect-error Unsupported geometry type name.
draw.setType('Box');
// @ts-expect-error Geometry type is required.
draw.setType();
// @ts-expect-error The getter returns a geometry type, not a boolean.
export const invalid: boolean = draw.getType();
