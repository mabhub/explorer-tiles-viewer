import React from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import {
  ageColors,
  countColors,
  currentYear,
  sharedColors,
} from '../share-colors';

export const gridFeature = { source: 'grid', sourceLayer: 'explorer-tiles' };

const isUnvisited = ['!', ['to-boolean', ['feature-state', 'count']]];

const outlineColor = '#00000044';

// Colored tiles keep their outline. The grid of unvisited ones fades out under
// zoom 10, where it is too dense to read, and can be hidden altogether.
const getOutlineColor = showGrid => (showGrid
  ? [
    'interpolate', ['linear'], ['zoom'],
    9, ['case', isUnvisited, '#0000', outlineColor],
    10, outlineColor,
  ]
  : ['case', isUnvisited, '#0000', outlineColor]);

const countColor = [
  'case',
  isUnvisited, '#fff0',
  ['==', ['feature-state', 'count'], 1], countColors[0],
  ['==', ['feature-state', 'count'], 2], countColors[1],
  ['>=', ['feature-state', 'count'], 3], countColors[2],
  '#fff0',
];

// Tiles without a known date (missing in the data) count as the oldest
const ageColor = [
  'case',
  isUnvisited, '#fff0',
  ['!', ['to-boolean', ['feature-state', 'year']]], ageColors.at(-1),
  [
    'step', ['-', currentYear, ['number', ['feature-state', 'year'], 0]],
    ageColors[0],
    ...ageColors.slice(1).flatMap((color, index) => [index + 1, color]),
  ],
];

const fillColors = { count: countColor, age: ageColor };

const getOwnerColor = activePersonCount => [
  'case',
  isUnvisited, '#fff0',
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

const MapContent = ({
  gridBefore,
  routes = [],
  colorMode,
  activePersonCount,
  maxAreas,
  showGrid,
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
          'fill-color': colorMode === 'owner'
            ? getOwnerColor(activePersonCount)
            : fillColors[colorMode] ?? countColor,
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

    {routes.map((route, index) => (
      // eslint-disable-next-line react/no-array-index-key
      <Source type="geojson" data={route} key={index}>
        <Layer type="line" paint={{ 'line-color': 'red', 'line-opacity': 0.5, 'line-width': 3 }} />
      </Source>
    ))}
  </>
);

export default React.memo(MapContent);
