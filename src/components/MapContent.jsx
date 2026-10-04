import React from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import { shareColors, sharedColors } from '../share-colors';

export const gridFeature = { source: 'grid', sourceLayer: 'explorer-tiles' };

const isUnvisited = ['!', ['to-boolean', ['feature-state', 'count']]];

const countColor = [
  'case',
  isUnvisited, '#fff0',
  ['==', ['feature-state', 'count'], 1], 'green',
  ['==', ['feature-state', 'count'], 2], 'orange',
  ['>=', ['feature-state', 'count'], 3], 'red',
  '#fff0',
];

const getOwnerColor = activePersonCount => [
  'case',
  isUnvisited, '#fff0',
  [
    'match', ['number', ['feature-state', 'owner'], -1],
    ...shareColors.flatMap((color, index) => [index, color]),
    // Owned by several people: shade by their number
    activePersonCount > 2
      ? [
        'interpolate', ['linear'], ['number', ['feature-state', 'count'], 2],
        2, sharedColors.fewest,
        activePersonCount, sharedColors.all,
      ]
      : sharedColors.all,
  ],
];

const MapContent = ({
  gridBefore,
  routes = [],
  colorMode,
  activePersonCount,
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
          'fill-outline-color': '#00000044',
          'fill-color': colorMode === 'owner'
            ? getOwnerColor(activePersonCount)
            : countColor,
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

    {routes.map((route, index) => (
      // eslint-disable-next-line react/no-array-index-key
      <Source type="geojson" data={route} key={index}>
        <Layer type="line" paint={{ 'line-color': 'red', 'line-opacity': 0.5, 'line-width': 3 }} />
      </Source>
    ))}
  </>
);

export default React.memo(MapContent);
