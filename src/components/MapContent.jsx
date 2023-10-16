import React from 'react';
import { Layer, Source } from 'react-map-gl';

const MapContent = ({ gridBefore }) => (
  <Source
    type="vector"
    url={import.meta.env.VITE_GRID_VECTOR_TILES}
    promoteId="id"
  >
    <Layer
      id="tiles"
      type="fill"
      source-layer="explorer-tiles"
      paint={{
        'fill-outline-color': '#00000044',
        'fill-color': [
          'case',
          ['!', ['to-boolean', ['feature-state', 'count']]], '#fff0',
          ['==', ['feature-state', 'count'], 1], 'green',
          ['==', ['feature-state', 'count'], 2], 'orange',
          ['>=', ['feature-state', 'count'], 3], 'red',
          '#fff0',
        ],
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
);

export default React.memo(MapContent);
