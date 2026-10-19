// squadrats.com publishes, for each account, a GeoJSON export of its trophies,
// public and readable from any origin. Its name is the timestamp (ms) of the
// computation of the trophies, made again after each change of activities.
// The same trophies are served as vector tiles, the ones its map draws.
const exportLinkPattern = /^https:\/\/squadrats\.org\/trophies\/(\w+)\/(\d+)\.geojson$/;
// The name of a downloaded export
const exportFilePattern = /^(\d+)\.geojson$/i;

const getExportUrl = (accountId, timestamp) => `https://squadrats.org/trophies/${accountId}/${timestamp}.geojson`;
const getAccountUrl = accountId => `https://mainframe-api.squadrats.com/anonymous/squadrants/${accountId}/trophies`;
const getTimestampsUrl = accountId => `https://tiles-beta.squadrats.com/${accountId}/trophies/timestamps`;

// Servers of the browser extension of squadrats.com, also anonymous and open
// to any origin: they list the tiles of the trophies
const extensionServers = ['https://mainframe-proxy-01.squadrats.com', 'https://mainframe-proxy-02.squadrats.com'];
// A squadrat of their answer: "x-y" (zoom 14)
const squadratPattern = /^\d+-\d+$/;

// Small answers come quickly, or not at all when a server is down: no need to
// wait for the browser to give up. Exports and tiles lists weigh up to 1 MB.
const answerTimeout = 15000;
const downloadTimeout = 60000;
const fetchWithin = (url, timeout) => fetch(url, { signal: AbortSignal.timeout(timeout) });

export const getLiveTilesUrl = (accountId, timestamp) => `https://tiles-beta.squadrats.com/${accountId}/trophies-earth/${timestamp}/{z}/{x}/{y}.pbf`;
// Deeper zooms show the tiles of this one
export const liveTilesMaxZoom = 12;

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
  const response = await fetchWithin(getExportUrl(accountId, timestamp), downloadTimeout);
  if (!response.ok) { throw new Error(`Export unavailable (${response.status})`); }
  return parseExport(await response.text());
};

// Timestamp of the latest computation of the trophies of the account, worldwide
export const fetchLatestTimestamp = async accountId => {
  const response = await fetchWithin(getTimestampsUrl(accountId), answerTimeout);
  if (!response.ok) { throw new Error(`Timestamps unavailable (${response.status})`); }
  const { earth } = await response.json();
  if (!Number.isInteger(earth)) { throw new Error('No worldwide timestamp'); }
  return earth;
};

// Tried in turn, the servers share the delay of one download
const fetchSquadrantFrom = async (server, accountId) => {
  const response = await fetchWithin(
    `${server}/anonymous/squadrants/${accountId}`,
    downloadTimeout / extensionServers.length,
  );
  if (!response.ok) { throw new Error(`Squadrats unavailable (${response.status})`); }
  const { raw, geojson } = await response.json();
  // Stored, then read while rendering: an unexpected shape must not get in
  if (!Array.isArray(raw?.[14]) || !raw[14].every(tile => squadratPattern.test(tile))) {
    throw new Error('No squadrats in the response');
  }
  return { squadratTiles: raw[14], timestamp: parseExportLink(geojson ?? '')?.timestamp };
};

// Squadrats (zoom 14 tiles) of the account, as "x-y", and the timestamp of
// their computation, the name of its latest export: from a server picked at
// random, the other one if it fails
export const fetchSquadrant = accountId => {
  const first = Math.floor(Math.random() * extensionServers.length);
  return fetchSquadrantFrom(extensionServers[first], accountId)
    .catch(() => fetchSquadrantFrom(extensionServers[1 - first], accountId));
};

// Public first and last name of the account
export const fetchAccountName = async accountId => {
  const response = await fetchWithin(getAccountUrl(accountId), answerTimeout);
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

const squadratKeysCache = new WeakMap();

// Keys ("14/x/y") of the grid tiles of the squadrats
export const getSquadratKeys = squadratTiles => {
  if (!squadratKeysCache.has(squadratTiles)) {
    squadratKeysCache.set(
      squadratTiles,
      new Set(squadratTiles.map(tile => `14/${tile.replace('-', '/')}`)),
    );
  }
  return squadratKeysCache.get(squadratTiles);
};
