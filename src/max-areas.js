import { tile2lat, tile2long } from './lib';

// Areas are rectangles of zoom 14 tiles: { x, y, width, height }, (x, y)
// being the north-west tile. Tiles are given as [x, y] pairs.

// Largest square of owned tiles: each tile gets the side of the largest
// square ending on it (south-east corner), from its west, north and
// north-west neighbours, all processed before it.
export const getMaxSquare = tiles => {
  const sizes = new Map();
  let best = null;

  [...tiles]
    .sort(([x1, y1], [x2, y2]) => y1 - y2 || x1 - x2)
    .forEach(([x, y]) => {
      const size = 1 + Math.min(
        sizes.get(`${x - 1}/${y}`) ?? 0,
        sizes.get(`${x}/${y - 1}`) ?? 0,
        sizes.get(`${x - 1}/${y - 1}`) ?? 0,
      );
      sizes.set(`${x}/${y}`, size);
      if (size > (best?.width ?? 0)) {
        best = {
          x: x - size + 1,
          y: y - size + 1,
          width: size,
          height: size,
        };
      }
    });

  return best;
};

// Longest run of adjacent owned tiles along a row (or a column)
const getLongestRun = (tiles, isRow) => {
  const positionsByLine = new Map();
  tiles.forEach(([x, y]) => {
    const [line, position] = isRow ? [y, x] : [x, y];
    if (!positionsByLine.has(line)) { positionsByLine.set(line, []); }
    positionsByLine.get(line).push(position);
  });

  let best = null;
  positionsByLine.forEach((positions, line) => {
    positions.sort((a, b) => a - b);
    let start = positions[0];
    positions.forEach((position, index) => {
      if (index > 0 && position !== positions[index - 1] + 1) {
        start = position;
      }
      const length = position - start + 1;
      if (length > (best?.length ?? 0)) {
        best = { line, start, length };
      }
    });
  });

  if (!best) { return null; }
  return isRow
    ? {
      x: best.start,
      y: best.line,
      width: best.length,
      height: 1,
    }
    : {
      x: best.line,
      y: best.start,
      width: 1,
      height: best.length,
    };
};

export const getMaxLine = tiles => getLongestRun(tiles, true);

export const getMaxColumn = tiles => getLongestRun(tiles, false);

export const toPolygon = ({
  x,
  y,
  width,
  height,
}) => {
  const [west, east] = [tile2long(x, 14), tile2long(x + width, 14)];
  const [north, south] = [tile2lat(y, 14), tile2lat(y + height, 14)];
  return {
    type: 'Polygon',
    coordinates: [[[west, north], [east, north], [east, south], [west, south], [west, north]]],
  };
};
