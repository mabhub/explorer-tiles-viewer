// Simplified activity lines of Statshunters: Google encoded polylines
// (https://developers.google.com/maps/documentation/utilities/polylinealgorithm),
// precision 1e-5

// Next signed value of the polyline from `start`: [value, end]
const readValue = (encoded, start) => {
  let result = 0;
  let shift = 0;
  let index = start;
  let byte;
  do {
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift; // eslint-disable-line no-bitwise
    shift += 5;
  } while (byte >= 0x20);
  // eslint-disable-next-line no-bitwise
  return [result & 1 ? ~(result >> 1) : result >> 1, index];
};

// Douglas-Peucker on the points (xs[i] * scaleX, ys[i]): kept[i] is 1 for each
// point kept, none of the others being farther than `tolerance` from the line
const simplify = (xs, ys, scaleX, tolerance) => {
  const { length } = xs;
  const tolerance2 = tolerance * tolerance;
  const kept = new Uint8Array(length);
  kept[0] = 1;
  kept[length - 1] = 1;

  // Spans [first, last] still to simplify, as flat pairs: no recursion on long lines
  const spans = [0, length - 1];
  while (spans.length) {
    const last = spans.pop();
    const first = spans.pop();
    const x0 = xs[first] * scaleX;
    const y0 = ys[first];
    const dx = xs[last] * scaleX - x0;
    const dy = ys[last] - y0;
    const length2 = dx * dx + dy * dy;
    let farthest = -1;
    let farthest2 = tolerance2;
    for (let index = first + 1; index < last; index += 1) {
      const px = xs[index] * scaleX - x0;
      const py = ys[index] - y0;
      let t = length2 ? (px * dx + py * dy) / length2 : 0;
      if (t < 0) { t = 0; } else if (t > 1) { t = 1; }
      const ex = t * dx - px;
      const ey = t * dy - py;
      const distance2 = ex * ex + ey * ey;
      if (distance2 > farthest2) {
        farthest = index;
        farthest2 = distance2;
      }
    }
    if (farthest >= 0) {
      kept[farthest] = 1;
      spans.push(first, farthest, farthest, last);
    }
  }
  return kept;
};

const metersPerDegree = 111320;

// [[longitude, latitude], …], as GeoJSON. With a `tolerance` (meters), the
// line is simplified: it moves by that much at most. Distances are taken on a
// plane around the first point, an activity spanning a few dozen kilometers.
// Points are first decoded as integers (1e-5 degrees): only the kept ones
// become arrays.
export const decodePolyline = (encoded, tolerance = 0) => {
  const lats = [];
  const lngs = [];
  let lat = 0;
  let lng = 0;
  let index = 0;
  while (index < encoded.length) {
    const [dLat, next] = readValue(encoded, index);
    const [dLng, end] = readValue(encoded, next);
    lat += dLat;
    lng += dLng;
    index = end;
    lats.push(lat);
    lngs.push(lng);
  }

  const kept = tolerance && lats.length > 2 && simplify(
    lngs,
    lats,
    Math.cos((lats[0] / 1e5) * (Math.PI / 180)),
    (tolerance * 1e5) / metersPerDegree,
  );
  const points = [];
  lats.forEach((latitude, point) => {
    if (!kept || kept[point]) { points.push([lngs[point] / 1e5, latitude / 1e5]); }
  });
  return points;
};

// One feature per activity, identified by its Statshunters id: a click on a
// line finds its activity, and the line is highlighted through the layer paint
export const getLinesGeojson = lines => ({
  type:     'FeatureCollection',
  features: lines.map(({ id, points }) => ({
    type:       'Feature',
    id,
    geometry:   { type: 'LineString', coordinates: points },
    properties: {},
  })),
});

// Squared distance from point `p` to the segment [a, b], all in pixels
const getSegmentDistance2 = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2))
    : 0;
  const x = a.x + t * dx - p.x;
  const y = a.y + t * dy - p.y;
  return x * x + y * y;
};

// Distance, in pixels, from `point` to a rendered line (a LineString or a
// MultiLineString, maybe clipped to a map tile); `project` turns [lng, lat]
// into pixels. Only the segments crossing `bounds` ([[west, south], [east,
// north]], around the point) are projected: a long line has many vertices.
export const getLineDistance = ({ type, coordinates }, point, project, bounds) => {
  const [[west, south], [east, north]] = bounds;
  const parts = type === 'MultiLineString' ? coordinates : [coordinates];
  let min2 = Infinity;
  parts.forEach(part => {
    part.forEach((b, index) => {
      const a = part[index - 1] ?? b;
      if (Math.max(a[0], b[0]) < west || Math.min(a[0], b[0]) > east
        || Math.max(a[1], b[1]) < south || Math.min(a[1], b[1]) > north) {
        return;
      }
      min2 = Math.min(min2, getSegmentDistance2(point, project(a), project(b)));
    });
  });
  return Math.sqrt(min2);
};
