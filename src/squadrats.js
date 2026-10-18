// squadrats.com publishes, for each account, a GeoJSON export of its trophies,
// public and readable from any origin. Its name is the timestamp (ms) of the
// computation of the trophies.
const exportLinkPattern = /^https:\/\/squadrats\.org\/trophies\/(\w+)\/(\d+)\.geojson$/;
// The name of a downloaded export
const exportFilePattern = /^(\d+)\.geojson$/i;

const getExportUrl = (accountId, timestamp) => `https://squadrats.org/trophies/${accountId}/${timestamp}.geojson`;
const getAccountUrl = accountId => `https://mainframe-api.squadrats.com/anonymous/squadrants/${accountId}/trophies`;

// { accountId, timestamp } of an export link, none if it is not one
export const parseExportLink = link => {
  const [, accountId, timestamp] = link.trim().match(exportLinkPattern) || [];
  return accountId && { accountId, timestamp: Number(timestamp) };
};

export const getExportFileTimestamp = fileName => {
  const [, timestamp] = fileName.match(exportFilePattern) || [];
  return timestamp && Number(timestamp);
};

// A file or a response that is not an export
export class InvalidExportError extends Error {}

const isSquadratinhos = ({ properties, geometry }) => properties?.name === 'squadratinhos'
  && ['Polygon', 'MultiPolygon'].includes(geometry?.type);

// The export as is, once checked: it must hold the squadratinhos
export const parseExport = text => {
  let geojson;
  try {
    geojson = JSON.parse(text);
  } catch (error) {
    throw new InvalidExportError(error.message);
  }
  if (geojson?.type !== 'FeatureCollection' || !geojson.features?.some(isSquadratinhos)) {
    throw new InvalidExportError('No squadratinhos in this export');
  }
  return geojson;
};

export const fetchExport = async (accountId, timestamp) => {
  const response = await fetch(getExportUrl(accountId, timestamp));
  if (!response.ok) { throw new Error(`Export unavailable (${response.status})`); }
  return parseExport(await response.text());
};

// Public first and last name of the account
export const fetchAccountName = async accountId => {
  const response = await fetch(getAccountUrl(accountId));
  if (!response.ok) { throw new Error(`Account unavailable (${response.status})`); }
  const { firstname, lastname } = await response.json();
  return [firstname, lastname].filter(Boolean).join(' ');
};

export const formatExportDate = timestamp => new Date(timestamp).toLocaleDateString('fr-FR');

// Until renamed: the public name of the account, else the date of the export
export const getDefaultName = (accountName, timestamp) => accountName
  || (timestamp ? `Squadrats du ${formatExportDate(timestamp)}` : 'Squadrats');

// The only layer drawn: the other ones stay in the stored export. The same
// feature each time: the map does not get it again
export const getSquadratinhos = geojson => geojson.features.find(isSquadratinhos);

// Rings of the squadratinhos, as lines to frame
export const getSquadratinhosRings = geojson => {
  const { geometry: { type, coordinates } } = getSquadratinhos(geojson);
  return type === 'Polygon' ? coordinates : coordinates.flat();
};
