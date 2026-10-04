// Per-account colors for the owner coloring mode. Reds and oranges are left
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

// Tiles owned by several accounts: lightest when shared by two of them,
// darkest when shared by all active accounts
export const sharedColors = { fewest: '#757575', all: '#000000' };

// Colors follow the order of the shares list, disabled shares included, so an
// account keeps its color when other ones are toggled
export const getShareColorIndex = (shareIds, id) => shareIds.indexOf(id) % shareColors.length;

export const getShareColor = (shareIds, id) => shareColors[getShareColorIndex(shareIds, id)];
