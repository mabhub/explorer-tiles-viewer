import React from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import {
  activityColors,
  activityThresholds,
  ageColors,
  countColors,
  currentYear,
  sharedColors,
} from '../share-colors';
import { getTrackGeojson } from '../tracks';

export const gridFeature = { source: 'grid', sourceLayer: 'explorer-tiles' };

const isUnvisited = ['!', ['to-boolean', ['feature-state', 'count']]];
const hasTrack = ['to-boolean', ['feature-state', 'track']];
const isUncolored = ['all', isUnvisited, ['!', hasTrack]];

// Unvisited tiles take the color of the first active track going through
// them, if any
const unvisitedColor = ['case', hasTrack, ['to-color', ['feature-state', 'track']], '#fff0'];

const outlineColor = '#00000044';

// Colored tiles keep their outline. The grid of unvisited ones fades out under
// zoom 10, where it is too dense to read, and can be hidden altogether.
const getOutlineColor = showGrid => (showGrid
  ? [
    'interpolate', ['linear'], ['zoom'],
    9, ['case', isUncolored, '#0000', outlineColor],
    10, outlineColor,
  ]
  : ['case', isUncolored, '#0000', outlineColor]);

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
  return countActivities ? activityColor : countColor;
};

const MapContent = ({
  gridBefore,
  colorMode,
  countActivities,
  activePersonCount,
  maxAreas,
  showGrid,
  tracks = [],
}) => (
  <>
    <Source
      id={gridFeature.source}
      type="vector"
      url={import.meta.env.VITE_GRID_VECTOR_TILES}
      promoteId="id"
    >
      <Layer
        id="tiles"
        type="fill"
        source-layer={gridFeature.sourceLayer}
        paint={{
          'fill-outline-color': getOutlineColor(showGrid),
          'fill-color': getFillColor(colorMode, countActivities, activePersonCount),
          'fill-opacity': [
            'case',
            ['==', ['feature-state', 'clicked'], true], 0.75,
            0.5,
          ],
        }}
        key={`${gridBefore}fill`}
        beforeId={gridBefore}
      />
    </Source>

    <Source id="max-areas" type="geojson" data={maxAreas}>
      <Layer
        id="max-areas"
        type="line"
        paint={{ 'line-color': ['get', 'color'], 'line-width': 3 }}
      />
    </Source>

    {tracks.filter(({ disabled }) => !disabled).map(({ id, color, lines }) => (
      <Source key={id} type="geojson" data={getTrackGeojson(lines)}>
        <Layer type="line" paint={{ 'line-color': color, 'line-width': 3 }} />
      </Source>
    ))}
  </>
);

export default React.memo(MapContent);
