/* eslint-disable no-mixed-operators */
export const tile2long = (x, z) => (x / 2 ** z * 360 - 180);

export const tile2lat = (y, z) => {
  const n = Math.PI - 2 * Math.PI * y / 2 ** z;
  return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
};

export default {};
