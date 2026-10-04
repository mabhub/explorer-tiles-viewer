// Per-person colors for the owner coloring mode. Reds and oranges are left
// out: the count coloring mode uses them.
export const shareColors = [
  '#1e88e5',
  '#43a047',
  '#8e24aa',
  '#00acc1',
  '#d81b60',
  '#6d4c41',
  '#3949ab',
  '#7cb342',
];

// Tiles owned by several people: lightest when shared by two of them,
// darkest when shared by all active people
export const sharedColors = { fewest: '#757575', all: '#000000' };

// A person can have several shares: their first one in the list carries their
// color. Disabled shares keep their place, so people keep their color when
// other shares are toggled. A share not loaded yet counts as its own person.
export const getFirstShareByShare = (shareIds, personByShare) => {
  const firstShareByPerson = {};

  return Object.fromEntries(shareIds.map(id => {
    const person = personByShare[id] ?? id;
    if (!(person in firstShareByPerson)) {
      firstShareByPerson[person] = id;
    }
    return [id, firstShareByPerson[person]];
  }));
};

// Shares without a chosen color use the palette, by position in the list
export const getShareColor = (shares, shareIds, id) => shares[id]?.color
  ?? shareColors[shareIds.indexOf(id) % shareColors.length];

const toRgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));

// "Redmean" approximation of the perceived distance between two colors
const getColorDistance = (hexA, hexB) => {
  const [r1, g1, b1] = toRgb(hexA);
  const [r2, g2, b2] = toRgb(hexB);
  const redMean = (r1 + r2) / 2;
  return Math.sqrt(
    (2 + redMean / 256) * (r1 - r2) ** 2
    + 4 * (g1 - g2) ** 2
    + (2 + (255 - redMean) / 256) * (b1 - b2) ** 2,
  );
};

// Closest palette colors are 96 apart; near identical shades are below 40
const minColorDistance = 90;

const hslToHex = (hue, saturation, lightness) => {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = n => {
    const k = (n + hue / 30) % 12;
    const value = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
};

// Initial color of a new share: the first palette color far enough from the
// colors in use and from the grays of shared tiles, else a generated hue,
// else the candidate farthest from all of them
export const pickShareColor = usedColors => {
  const avoided = [...usedColors, ...Object.values(sharedColors)];
  const generated = Array.from(
    { length: 24 },
    (_, index) => hslToHex((index * 137.5) % 360, 0.65, 0.45),
  );
  const candidates = [...shareColors, ...generated].map(color => ({
    color,
    distance: Math.min(...avoided.map(used => getColorDistance(color, used))),
  }));

  const farEnough = candidates.find(({ distance }) => distance >= minColorDistance);
  if (farEnough) { return farEnough.color; }

  return candidates
    .reduce((best, candidate) => (candidate.distance > best.distance ? candidate : best))
    .color;
};
