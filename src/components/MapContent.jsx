import React from 'react';
import { Layer, Source } from '@vis.gl/react-maplibre';

import {
  activityColors,
  activityThresholds,
  ageColors,
  compareColors,
  countColors,
  currentYear,
  sharedColors,
} from '../share-colors';
import { getLiveTilesUrl, getSquadratinhos, liveTilesMaxZoom } from '../squadrats';
import { getTrackGeojson } from '../tracks';
import {
  getActivityLinesLayerId,
  getLiveTimestamp,
  highlightedLinesArrowsLayerId,
  highlightedLinesCasingLayerId,
  highlightedLinesLayerId,
  getSquadratsLayerId,
  getTrackArrowsLayerId,
  getTrackLayerId,
  gridLinesLayerId,
  maxAreasLayerId,
  squadratinhosGridLayerId,
  tilesLayerId,
} from '../layer-order';
import TileGrid from './TileGrid';
import { directionArrowsLayout } from '../direction-arrows';

// Source of the tiles that are visited, crossed by a track or compared: one
// square each, colored through their feature state
export const gridFeature = { source: 'grid' };

const isUnvisited = ['!', ['to-boolean', ['feature-state', 'count']]];
const hasTrack = ['to-boolean', ['feature-state', 'track']];
const isUncolored = ['all', isUnvisited, ['!', hasTrack]];

// Unvisited tiles take the color of the first active track going through
// them, if any
const unvisitedColor = ['case', hasTrack, ['to-color', ['feature-state', 'track']], '#fff0'];

const outlineColor = '#00000044';

// Margin (px) of the internal tiles of the sources of squares. Squares lie on
// the edges of those tiles: the default 128 px only duplicates them in the
// neighbour tiles (about twice as fast to tile at low zoom). 0 would draw
// half the outline along the tile edges.
const squaresBuffer = 4;

// Grid of the explorer tiles (z14), faded in from zoom 9 to 10: too dense to
// read below. Half opaque, as the outline of the tiles under their fill opacity.
const gridLinesMinZoom = 9;
const gridLinesPaint = {
  'line-color':   outlineColor,
  'line-width':   1,
  'line-opacity': ['interpolate', ['linear'], ['zoom'], gridLinesMinZoom, 0, gridLinesMinZoom + 1, 0.5],
};
// Grid of the squadratinhos (z17 tiles)
export const squadratinhosGridMinZoom = 13;
const squadratinhosGridPaint = {
  'line-color':   '#000',
  'line-width':   1,
  'line-opacity': ['interpolate', ['linear'], ['zoom'], squadratinhosGridMinZoom, 0.15, 15, 0.3],
};

const activityLinesLayout = { 'line-join': 'round', 'line-cap': 'round' };
const getActivityLinesPaint = color => ({
  'line-color':   color,
  'line-width':   1.5,
  'line-opacity': 0.7,
});
// Hovered or opened lines, in the color of their person with a white edge:
// they stand out of a bundle of lines of the same color
const highlightedLinesCasingPaint = { 'line-color': '#fff', 'line-width': 8 };
const highlightedLinesPaint = { 'line-color': ['get', 'color'], 'line-width': 4 };
// Edged in white, as the line: on its own color, the arrow would not show.
// The halo counts in pixels of the image, twice as fine as the screen.
const highlightedLinesArrowsPaint = {
  'icon-color':      ['get', 'color'],
  'icon-halo-color': '#fff',
  'icon-halo-width': 3,
};
const highlightedLinesArrowsLayout = { ...directionArrowsLayout, 'icon-size': 1.1 };
const trackArrowsLayout = { ...directionArrowsLayout, 'icon-size': 1.5 };

// Compare mode: only the tiles of the compared person and of their squadrats
const compareKind = ['coalesce', ['feature-state', 'compare'], ''];
const compareColor = [
  'match', compareKind,
  'both', compareColors.both,
  'statshunters', compareColors.statshunters,
  'squadrats', compareColors.squadrats,
  '#fff0',
];

// Colored tiles keep their outline, even with the grid hidden
const getOutlineColor = colorMode => {
  const uncolored = colorMode === 'compare' ? ['==', compareKind, ''] : isUncolored;
  return ['case', uncolored, '#0000', outlineColor];
};

const countColor = [
  'case',
  isUnvisited, unvisitedColor,
  ['==', ['feature-state', 'count'], 1], countColors[0],
  ['==', ['feature-state', 'count'], 2], countColors[1],
  ['>=', ['feature-state', 'count'], 3], countColors[2],
  '#fff0',
];

// Tiles without a known date (missing in the data) count as the oldest
const ageColor = [
  'case',
  isUnvisited, unvisitedColor,
  ['!', ['to-boolean', ['feature-state', 'year']]], ageColors.at(-1),
  [
    'step', ['-', currentYear, ['number', ['feature-state', 'year'], 0]],
    ageColors[0],
    ...ageColors.slice(1).flatMap((color, index) => [index + 1, color]),
  ],
];

const activityColor = [
  'case',
  isUnvisited, unvisitedColor,
  [
    'step', ['number', ['feature-state', 'activities'], 0],
    activityColors[0],
    ...activityThresholds.slice(1)
      .flatMap((threshold, index) => [threshold, activityColors[index + 1]]),
  ],
];

const getOwnerColor = activePersonCount => [
  'case',
  isUnvisited, unvisitedColor,
  // Owned by a single person: their color
  ['to-boolean', ['feature-state', 'color']], ['to-color', ['feature-state', 'color']],
  // Owned by several people: shade by their number
  activePersonCount > 2
    ? [
      'interpolate', ['linear'], ['number', ['feature-state', 'count'], 2],
      2, sharedColors.fewest,
      activePersonCount, sharedColors.all,
    ]
    : sharedColors.all,
];

const getFillColor = (colorMode, countActivities, activePersonCount) => {
  if (colorMode === 'owner') { return getOwnerColor(activePersonCount); }
  if (colorMode === 'age') { return ageColor; }
  if (colorMode === 'compare') { return compareColor; }
  return countActivities ? activityColor : countColor;
};

// Layers are rendered from bottom to top, all under the labels of the basemap:
// a fresh style gets them in order (see `getLayerOrder`, which MainMap applies
// to the layers added or moved later)
const MapContent = ({
  labelsLayer,
  tiles,
  colorMode,
  countActivities,
  activePersonCount,
  maxAreas,
  showGrid,
  showSquadratinhosGrid,
  showDirectionArrows,
  tracks = [],
  squadrats = [],
  activityLines = [],
  highlightedLines,
}) => (
  <>
    {showGrid && (
      <TileGrid
        id={gridLinesLayerId}
        zoom={14}
        minzoom={gridLinesMinZoom}
        paint={gridLinesPaint}
        beforeId={labelsLayer}
      />
    )}

    {/* Squares are exact at zoom 14, overzoomed beyond */}
    <Source
      id={gridFeature.source}
      type="geojson"
      data={tiles}
      promoteId="id"
      maxzoom={14}
      buffer={squaresBuffer}
    >
      <Layer
        id={tilesLayerId}
        type="fill"
        paint={{
          'fill-outline-color': getOutlineColor(colorMode),
          'fill-color': getFillColor(colorMode, countActivities, activePersonCount),
          'fill-opacity': [
            'case',
            ['==', ['feature-state', 'clicked'], true], 0.75,
            0.5,
          ],
        }}
        beforeId={labelsLayer}
      />
    </Source>

    {/* A live entry draws the tiles of squadrats.com, its id changes with
        their timestamp: the source is replaced */}
    {squadrats.filter(({ disabled }) => !disabled).reverse().map(entry => {
      const { color, geojson, accountId } = entry;
      const id = getSquadratsLayerId(entry);
      const liveTimestamp = getLiveTimestamp(entry);
      const paint = { 'fill-color': color, 'fill-opacity': 0.35, 'fill-outline-color': color };
      if (liveTimestamp) {
        return (
          <Source
            key={id}
            id={id}
            type="vector"
            tiles={[getLiveTilesUrl(accountId, liveTimestamp)]}
            maxzoom={liveTilesMaxZoom}
            attribution="© squadrats.com"
          >
            <Layer id={id} type="fill" source-layer="squadratinhos" beforeId={labelsLayer} paint={paint} />
          </Source>
        );
      }
      return (
        <Source key={id} id={id} type="geojson" data={getSquadratinhos(geojson)} buffer={squaresBuffer}>
          <Layer id={id} type="fill" beforeId={labelsLayer} paint={paint} />
        </Source>
      );
    })}

    {showSquadratinhosGrid && (
      <TileGrid
        id={squadratinhosGridLayerId}
        zoom={17}
        minzoom={squadratinhosGridMinZoom}
        paint={squadratinhosGridPaint}
        beforeId={labelsLayer}
      />
    )}

    {activityLines.slice().reverse().map(({ id: shareId, color, geojson }) => {
      const id = getActivityLinesLayerId(shareId);
      return (
        <Source key={id} id={id} type="geojson" data={geojson}>
          <Layer
            id={id}
            type="line"
            beforeId={labelsLayer}
            layout={activityLinesLayout}
            paint={getActivityLinesPaint(color)}
          />
        </Source>
      );
    })}

    <Source id={highlightedLinesLayerId} type="geojson" data={highlightedLines}>
      <Layer
        id={highlightedLinesCasingLayerId}
        type="line"
        beforeId={labelsLayer}
        layout={activityLinesLayout}
        paint={highlightedLinesCasingPaint}
      />
      <Layer
        id={highlightedLinesLayerId}
        type="line"
        beforeId={labelsLayer}
        layout={activityLinesLayout}
        paint={highlightedLinesPaint}
      />
      {showDirectionArrows && (
        <Layer
          id={highlightedLinesArrowsLayerId}
          type="symbol"
          beforeId={labelsLayer}
          layout={highlightedLinesArrowsLayout}
          paint={highlightedLinesArrowsPaint}
        />
      )}
    </Source>

    {tracks.filter(({ disabled }) => !disabled).reverse().map(({ id: trackId, color, lines }) => {
      const id = getTrackLayerId(trackId);
      return (
        <Source key={id} id={id} type="geojson" data={getTrackGeojson(lines)}>
          <Layer id={id} type="line" beforeId={labelsLayer} paint={{ 'line-color': color, 'line-width': 3 }} />
          {showDirectionArrows && (
            <Layer
              id={getTrackArrowsLayerId(trackId)}
              type="symbol"
              beforeId={labelsLayer}
              layout={trackArrowsLayout}
              paint={{ 'icon-color': color }}
            />
          )}
        </Source>
      );
    })}

    <Source id={maxAreasLayerId} type="geojson" data={maxAreas}>
      <Layer
        id={maxAreasLayerId}
        type="line"
        beforeId={labelsLayer}
        paint={{ 'line-color': ['get', 'color'], 'line-width': 3 }}
      />
    </Source>
  </>
);

export default React.memo(MapContent);
