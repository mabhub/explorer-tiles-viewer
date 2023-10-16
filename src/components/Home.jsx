import { useState } from 'react';
import {
  Box,
  Button,
  Container,
  GlobalStyles,
} from '@mui/material';

import Map from 'react-map-gl/maplibre';
import { Layer, Source } from 'react-map-gl';
import * as pmtiles from 'pmtiles';

import 'maplibre-gl/dist/maplibre-gl.css';
import MapLibreGL from 'maplibre-gl';

const protocol = new pmtiles.Protocol();
MapLibreGL.addProtocol('pmtiles', protocol.tile);

const Home = () => (
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
    >
      <Source
        type="vector"
        url="pmtiles://https://explorer-tiles.netlify.app/grid.pmtiles"
      >
        <Layer
          id="grid"
          type="line"
          source-layer="explorer-tiles"
          paint={{
            'line-width': 1,
            'line-color': 'blue',
          }}
        />
      </Source>
    </Map>
  </Box>
);

export default Home;
