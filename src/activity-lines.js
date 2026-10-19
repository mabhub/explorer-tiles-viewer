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

// One feature for all the lines of a share
export const getLinesGeojson = lines => ({
  type:     'Feature',
  geometry: { type: 'MultiLineString', coordinates: lines },
});
