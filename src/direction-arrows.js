// Triangle drawn along the tracks and the highlighted activity lines to show
// their direction. A signed distance field image: `icon-color` colors it.

export const directionArrowImageId = 'direction-arrow';

// Direction of a line, in the order of its points
export const directionArrowsLayout = {
  'symbol-placement':      'line',
  'symbol-spacing':        160,
  'icon-image':            directionArrowImageId,
  'icon-allow-overlap':    true,
  'icon-ignore-placement': true,
};

const size = 40;
const pixelRatio = 2;
// Pointing right: MapLibre turns the right of the image along the line
const triangle = [[12, 10], [28, 20], [12, 30]];

const getSegmentDistance = ([x, y], [x1, y1], [x2, y2]) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
};

// Same side of the three edges, whatever the winding
const isInside = ([x, y]) => {
  const sides = triangle.map(([x1, y1], index) => {
    const [x2, y2] = triangle[(index + 1) % 3];
    return Math.sign((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1));
  });
  return sides.every(side => side >= 0) || sides.every(side => side <= 0);
};

// Alpha as MapLibre reads an SDF: 0.75 on the edge, 1/8 less per pixel outside
const makeImage = () => {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const point = [x + 0.5, y + 0.5];
      const edgeDistance = Math.min(...triangle.map(
        (vertex, index) => getSegmentDistance(point, vertex, triangle[(index + 1) % 3]),
      ));
      const distance = isInside(point) ? -edgeDistance : edgeDistance;
      const index = (y * size + x) * 4;
      data.fill(255, index, index + 3);
      data[index + 3] = Math.round(255 * Math.max(0, Math.min(1, (6 - distance) / 8)));
    }
  }
  return { width: size, height: size, data };
};

/**
 * Adds the arrow image to the style unless it is there: replacing the
 * basemap drops it with the rest of the style.
 * @param {import('maplibre-gl').Map} map
 */
export const addDirectionArrowImage = map => {
  if (!map.hasImage(directionArrowImageId)) {
    map.addImage(directionArrowImageId, makeImage(), { sdf: true, pixelRatio });
  }
};
