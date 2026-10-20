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

// [[longitude, latitude], …], as GeoJSON
export const decodePolyline = encoded => {
  const points = [];
  let lat = 0;
  let lng = 0;
  let index = 0;
  while (index < encoded.length) {
    const [dLat, next] = readValue(encoded, index);
    const [dLng, end] = readValue(encoded, next);
    lat += dLat;
    lng += dLng;
    index = end;
    points.push([lng / 1e5, lat / 1e5]);
  }
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
