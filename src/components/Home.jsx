import React from 'react';
import {
  Box,
  GlobalStyles,
} from '@mui/material';

import Map from 'react-map-gl/maplibre';
import { Layer, Source } from 'react-map-gl';
import * as pmtiles from 'pmtiles';

import 'maplibre-gl/dist/maplibre-gl.css';
import MapLibreGL from 'maplibre-gl';
import { useLocation } from 'react-router-dom';

const protocol = new pmtiles.Protocol();
MapLibreGL.addProtocol('pmtiles', protocol.tile);

const Home = () => {
  const [gridBefore, setGridBefore] = React.useState();
  const mapRef = React.useRef();
  const [tileset, setTileset] = React.useState({});
  const location = useLocation();

  const getGrids = React.useCallback(
    async () => {
      const hashContent = location.hash.substring(1);
      const ids = hashContent.split(',').map(str => str.trim());

      const tiles = {};
      // eslint-disable-next-line no-restricted-syntax
      for await (const id of ids) {
        const response = await fetch(`/${id}.json`);
        const userTiles = await response.json();
        userTiles.forEach(tileRef => {
          if (!tiles[tileRef]) { tiles[tileRef] = []; }
          tiles[tileRef].push(id);
        });
      }
      setTileset(tiles);
    },
    [location.hash],
  );

  const renderTiles = React.useCallback(
    () => {
      const map = mapRef.current;
      if (!map) { return; }

      const features = map.queryRenderedFeatures({ layers: ['grid'] });

      features.forEach(feature => {
        const tileRef = feature.properties.id;
        map.setFeatureState(feature, {
          count: tileset[tileRef]?.length || 0,
          visited: Boolean(tileset[tileRef]),
        });
      });
    },
    [tileset],
  );

  React.useEffect(
    () => {
      if (mapRef.current && Object.keys(tileset)) {
        renderTiles();
      }
    },
    [mapRef, renderTiles, tileset],
  );

  React.useEffect(() => { getGrids(); }, [getGrids]);

  const handleMapLoad = React.useCallback(
    ({ target: map }) => {
      window.map = map;
      if (map.getStyle().layers.map(({ id }) => id).includes('waterway-name')) {
        setGridBefore('waterway-name');
      }
      renderTiles();
    },
    [renderTiles],
  );

  return (
    <Box sx={{ height: '100%' }}>
      <GlobalStyles
        styles={{
          'html, body, #root': {
            height: '100%',
          },
        }}
      />

      <Map
        initialViewState={{
          longitude: 1.4,
          latitude: 43.6,
          zoom: 11,
        }}
        style={{ width: '100%', minHeight: 100, height: '100%' }}
        mapStyle="https://makinamaps.makina-corpus.net/styles/makina-maps-topo/style.json"
        onLoad={handleMapLoad}
        onMoveEnd={renderTiles}
        ref={mapRef}
      >
        <Source
          type="vector"
          url="pmtiles://https://explorer-tiles.netlify.app/grid.pmtiles"
          promoteId="id"
        >
          <Layer
            id="grid"
            type="line"
            source-layer="explorer-tiles"
            paint={{
              'line-width': 0.25,
              'line-color': '#aaa',
            }}
            key={gridBefore}
            beforeId={gridBefore}
          />
          <Layer
            id="tiles"
            type="fill"
            source-layer="explorer-tiles"
            paint={{
              'fill-color': [
                'case',
                ['==', ['feature-state', 'count'], 1], 'green',
                ['==', ['feature-state', 'count'], 2], 'orange',
                ['>=', ['feature-state', 'count'], 3], 'red',
                'transparent',
              ],
              'fill-opacity': 0.2,
            }}
            key={`${gridBefore}fill`}
            beforeId="grid"
          />
        </Source>
      </Map>
    </Box>
  );
};

export default Home;
