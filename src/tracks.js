/* eslint-disable no-mixed-operators */
import togeojson from '@mapbox/togeojson';
import { DOMParser } from 'xmldom';

const zoom = 14;
const tileCount = 2 ** zoom;

// About 1 m: enough for tiles and display, and lighter to store
const round = value => Math.round(value * 1e5) / 1e5;

const getLines = geometry => {
  switch (geometry?.type) {
    case 'LineString': return [geometry.coordinates];
    case 'MultiLineString': return geometry.coordinates;
    case 'GeometryCollection': return geometry.geometries.flatMap(getLines);
    default: return [];
  }
};

const toFeatures = geojson => {
  if (geojson.type === 'FeatureCollection') { return geojson.features; }
  if (geojson.type === 'Feature') { return [geojson]; }
  return [{ type: 'Feature', geometry: geojson, properties: {} }];
};

// Lines of a GPX or GeoJSON file, waypoints and polygons left out, named
// after their first feature, else after the file
export const parseTrack = (text, fileName) => {
  // The GPX media type is unknown to many systems: the extension tells
  const geojson = /\.gpx$/i.test(fileName)
    ? togeojson.gpx(new DOMParser().parseFromString(text))
    : JSON.parse(text);
  const features = toFeatures(geojson).filter(({ geometry }) => getLines(geometry).length);

  return {
    name: features[0]?.properties?.name || fileName.replace(/\.[^.]+$/, ''),
    lines: features
      .flatMap(({ geometry }) => getLines(geometry))
      .map(line => line.map(([lon, lat]) => [round(lon), round(lat)])),
  };
};

const toTileX = lon => (lon + 180) / 360 * tileCount;
const toTileY = lat => {
  const radians = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * tileCount;
};

// Fraction of a segment from `start` to its first tile border, along one axis
const getFirstBorder = (start, step, delta) => {
  if (!step) { return Infinity; }
  const tile = Math.floor(start);
  return (step > 0 ? tile + 1 - start : start - tile) * delta;
};

// Every tile a segment goes through, even between distant points: steps to
// the nearest tile border along the segment ("voxel traversal")
const addSegmentTiles = (keys, [x0, y0], [x1, y1]) => {
  let x = Math.floor(x0);
  let y = Math.floor(y0);
  const stepCount = Math.abs(Math.floor(x1) - x) + Math.abs(Math.floor(y1) - y);
  const stepX = Math.sign(x1 - x0);
  const stepY = Math.sign(y1 - y0);
  // Fraction of the segment to cross a whole tile, and to reach the next border
  const deltaX = stepX ? Math.abs(1 / (x1 - x0)) : Infinity;
  const deltaY = stepY ? Math.abs(1 / (y1 - y0)) : Infinity;
  let nextX = getFirstBorder(x0, stepX, deltaX);
  let nextY = getFirstBorder(y0, stepY, deltaY);

  keys.add(`${zoom}/${x}/${y}`);
  for (let step = 0; step < stepCount; step += 1) {
    if (nextX < nextY) {
      x += stepX;
      nextX += deltaX;
    } else {
      y += stepY;
      nextY += deltaY;
    }
    keys.add(`${zoom}/${x}/${y}`);
  }
};

// Derived data, cached by lines: a track keeps them when edited
const tilesCache = new WeakMap();
const geojsonCache = new WeakMap();

// Keys ("14/x/y") of the tiles the track goes through
export const getTrackTiles = lines => {
  if (!tilesCache.has(lines)) {
    const keys = new Set();
    lines.forEach(line => {
      const points = line.map(([lon, lat]) => [toTileX(lon), toTileY(lat)]);
      points.forEach((point, index) => addSegmentTiles(keys, points[index - 1] ?? point, point));
    });
    tilesCache.set(lines, [...keys]);
  }
  return tilesCache.get(lines);
};

export const getTrackGeojson = lines => {
  if (!geojsonCache.has(lines)) {
    geojsonCache.set(lines, { type: 'MultiLineString', coordinates: lines });
  }
  return geojsonCache.get(lines);
};

// [[west, south], [east, north]]. Not Math.min(...points): long tracks have
// more points than a call takes arguments.
export const getTrackBounds = lines => lines.flat().reduce(
  ([[west, south], [east, north]], [lon, lat]) => [
    [Math.min(west, lon), Math.min(south, lat)],
    [Math.max(east, lon), Math.max(north, lat)],
  ],
  [[Infinity, Infinity], [-Infinity, -Infinity]],
);
