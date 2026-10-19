// Compare coloring mode: the squadrats (zoom 14) of a squadrats.com account
// lie on the grid of the Statshunters tiles, those of a person are compared
import { getSquadratKeys } from './squadrats';

const normalizeName = name => name
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .trim()
  .toLowerCase();

// Person of a squadrats entry, among `people` ({ id, label, name }): the one
// chosen in its menu, else the only one bearing the public name of its account
export const getComparedPerson = (entry, people) => {
  if (entry.personId !== undefined) {
    return people.find(({ id }) => id === entry.personId);
  }
  if (!entry.accountName) { return undefined; }
  const matches = people.filter(
    ({ name }) => name && normalizeName(name) === normalizeName(entry.accountName),
  );
  return matches.length === 1 ? matches[0] : undefined;
};

// Entry shown in the compare mode: the first active one that has its
// squadrats and a person
export const getComparedEntry = (squadrats, people) => squadrats.find(
  entry => !entry.disabled && entry.squadratTiles && getComparedPerson(entry, people),
);

// Kind of each tile known to either source ('both', 'statshunters' or
// 'squadrats'), and the number of tiles of each kind
export const compareTiles = (visitedKeys, squadratTiles) => {
  const squadratKeys = getSquadratKeys(squadratTiles);
  const kindByTile = {};
  visitedKeys.forEach(key => {
    kindByTile[key] = squadratKeys.has(key) ? 'both' : 'statshunters';
  });
  squadratKeys.forEach(key => {
    if (!visitedKeys.has(key)) { kindByTile[key] = 'squadrats'; }
  });

  const counts = { both: 0, statshunters: 0, squadrats: 0 };
  Object.values(kindByTile).forEach(kind => { counts[kind] += 1; });
  return { kindByTile, counts };
};
