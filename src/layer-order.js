// Stacking of the layers drawn by the viewer, all kept under the labels of
// the basemap. Fixed ids: a layer created twice (strict mode) is not drawn
// twice, and the order below can name every layer.

export const tilesLayerId = 'tiles';
// Grid of the explorer tiles, under the colored ones
export const gridLinesLayerId = 'grid-lines';
export const maxAreasLayerId = 'max-areas';
export const squadratinhosGridLayerId = 'squadratinhos-grid';
// Timestamp of the squadrats.com tiles drawn by a live entry, none for a local copy
export const getLiveTimestamp = ({
  live,
  accountId,
  latest,
  timestamp,
}) => (live && accountId ? latest ?? timestamp : undefined);
// A live entry replaces its source when its timestamp changes: a new id keeps
// the new source and layer from clashing with the ones being removed
export const getSquadratsLayerId = entry => {
  const liveTimestamp = getLiveTimestamp(entry);
  return liveTimestamp ? `squadrats-${entry.id}-${liveTimestamp}` : `squadrats-${entry.id}`;
};
export const getActivityLinesLayerId = shareId => `activity-lines-${shareId}`;
// Hovered or opened activity lines, drawn again over all the others
export const highlightedLinesCasingLayerId = 'activity-lines-highlight-casing';
export const highlightedLinesLayerId = 'activity-lines-highlight';
export const highlightedLinesArrowsLayerId = 'activity-lines-highlight-arrows';
export const getTrackLayerId = id => `track-${id}`;
// Direction arrows of a track, right above its line
export const getTrackArrowsLayerId = id => `track-arrows-${id}`;

/**
 * Ids of the viewer layers, from bottom to top: grid, tiles, squadrats, squadratinhos
 * grid, activity lines, highlighted activity lines (with their arrows), tracks
 * (each with its arrows), max areas. Within a group, the first item of the list is drawn on top.
 * @param {object} layers
 * @param {boolean} layers.grid
 * @param {object[]} layers.squadrats active entries, in list order
 * @param {boolean} layers.squadratinhosGrid
 * @param {Array<{ id: string }>} layers.activityLines in list order
 * @param {Array<{ id: string }>} layers.tracks active tracks, in list order
 * @returns {string[]}
 */
export const getLayerOrder = ({
  grid,
  squadrats,
  squadratinhosGrid,
  activityLines,
  tracks,
}) => [
  ...(grid ? [gridLinesLayerId] : []),
  tilesLayerId,
  ...squadrats.map(getSquadratsLayerId).reverse(),
  ...(squadratinhosGrid ? [squadratinhosGridLayerId] : []),
  ...activityLines.map(({ id }) => getActivityLinesLayerId(id)).reverse(),
  highlightedLinesCasingLayerId,
  highlightedLinesLayerId,
  highlightedLinesArrowsLayerId,
  ...[...tracks].reverse().flatMap(({ id }) => [getTrackLayerId(id), getTrackArrowsLayerId(id)]),
  maxAreasLayerId,
];

/**
 * Labels layer of the basemap, to insert the viewer layers under: the lowest
 * symbol layer above the highest fill or line layer. None without labels
 * (raster basemaps): the viewer layers then go on top.
 * @param {Array<{ id: string, type: string }>} layers layers of the style, bottom to top
 * @param {Set<string>} viewerLayerIds layers to leave out
 * @returns {string|undefined}
 */
export const findLabelsLayer = (layers, viewerLayerIds) => {
  const basemapLayers = layers.filter(({ id }) => !viewerLayerIds.has(id));
  const highestShape = basemapLayers.findLastIndex(({ type }) => type === 'fill' || type === 'line');
  return basemapLayers.slice(highestShape + 1).find(({ type }) => type === 'symbol')?.id;
};

/**
 * Moves the existing viewer layers right under the labels layer, in the given
 * order, unless they already are: a move repaints the map.
 * @param {import('maplibre-gl').Map} map
 * @param {string[]} order ids, bottom to top
 * @param {string} [labelsLayer]
 */
export const applyLayerOrder = (map, order, labelsLayer) => {
  // None until the style is loaded: the layers are then created in order
  const style = map.getStyle();
  if (!style) { return; }
  const styleOrder = style.layers.map(({ id }) => id);
  const before = labelsLayer && styleOrder.includes(labelsLayer) ? labelsLayer : undefined;
  const present = order.filter(id => styleOrder.includes(id));
  const end = before ? styleOrder.indexOf(before) : styleOrder.length;
  const current = styleOrder.slice(end - present.length, end);
  if (current.length === present.length && current.every((id, index) => id === present[index])) {
    return;
  }
  present.forEach(id => map.moveLayer(id, before));
};
