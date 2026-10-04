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

// One color per person, the one of their first share in the list, since a
// person can have several shares. Disabled shares keep their place, so people
// keep their color when other shares are toggled. A share not loaded yet
// counts as its own person.
export const getColorIndexByShare = (shareIds, personByShare) => {
  const firstIndexByPerson = {};

  return Object.fromEntries(shareIds.map((id, index) => {
    const person = personByShare[id] ?? id;
    if (!(person in firstIndexByPerson)) {
      firstIndexByPerson[person] = index;
    }
    return [id, firstIndexByPerson[person] % shareColors.length];
  }));
};
