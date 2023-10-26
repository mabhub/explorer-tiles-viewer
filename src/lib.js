/* eslint-disable no-mixed-operators */
export const tile2long = (x, z) => (x / 2 ** z * 360 - 180);

export const tile2lat = (y, z) => {
  const n = Math.PI - 2 * Math.PI * y / 2 ** z;
  return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
};

export const id2coords = id => {
  const [z, x, y] = id.split('/');
  return [
    tile2long(x, z),
    tile2lat(y, z),
  ];
};

export const throttle = (cb, delay) => {
  let wait = false;

  return (...args) => {
    if (wait) {
      return;
    }

    cb(...args);
    wait = true;
    setTimeout(() => {
      wait = false;
    }, delay);
  };
};

export default {};
