/* eslint-disable no-mixed-operators */
export const tile2long = (x, z) => (x / 2 ** z * 360 - 180);

export const tile2lat = (y, z) => {
  const n = Math.PI - 2 * Math.PI * y / 2 ** z;
  return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
};

// Fractional tile coordinates of a point: their integer part is the tile
export const long2tile = (lon, z) => (lon + 180) / 360 * 2 ** z;

export const lat2tile = (lat, z) => {
  const radians = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * 2 ** z;
};

export default {};
