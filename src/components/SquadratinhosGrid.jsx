import React from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import {
  lat2tile,
  long2tile,
  tile2lat,
  tile2long,
} from '../lib';
import { squadratinhosGridLayerId } from '../layer-order';

const zoom = 17;
const tileCount = 2 ** zoom;
export const squadratinhosGridMinZoom = 13;
// Lines drawn around the view, in tiles: a pitched map can see far away
const maxSpan = 400;

const clamp = value => Math.min(Math.max(Math.floor(value), 0), tileCount);

// Tile coordinates (fractional) of the edges of the view
const getView = bounds => ({
  west: long2tile(bounds.getWest(), zoom),
  east: long2tile(bounds.getEast(), zoom),
  north: lat2tile(bounds.getNorth(), zoom),
  south: lat2tile(bounds.getSouth(), zoom),
});

// Tiles of the view, with a margin of half a view on each side so that the
// lines are computed again only once the view leaves them
const getArea = ({ west, east, north, south }) => {
  const centerX = (west + east) / 2;
  const centerY = (north + south) / 2;
  const marginX = (east - west) / 2;
  const marginY = (south - north) / 2;
  return {
    minX: clamp(Math.max(west - marginX, centerX - maxSpan)),
    maxX: clamp(Math.min(east + marginX, centerX + maxSpan) + 1),
    minY: clamp(Math.max(north - marginY, centerY - maxSpan)),
    maxY: clamp(Math.min(south + marginY, centerY + maxSpan) + 1),
  };
};

const covers = (area, { west, east, north, south }) => west >= area.minX
  && east <= area.maxX && north >= area.minY && south <= area.maxY;

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

// Edges of the z17 tiles of an area: in Web Mercator, meridians and parallels
// are straight, two points per line are enough
const getGridLines = ({ minX, maxX, minY, maxY }) => {
  const west = tile2long(minX, zoom);
  const east = tile2long(maxX, zoom);
  const north = tile2lat(minY, zoom);
  const south = tile2lat(maxY, zoom);
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        ...range(minX, maxX).map(x => [[tile2long(x, zoom), north], [tile2long(x, zoom), south]]),
        ...range(minY, maxY).map(y => [[west, tile2lat(y, zoom)], [east, tile2lat(y, zoom)]]),
      ],
    },
  };
};

const emptyGrid = { type: 'FeatureCollection', features: [] };

const paint = {
  'line-color': '#000',
  'line-width': 1,
  'line-opacity': ['interpolate', ['linear'], ['zoom'], squadratinhosGridMinZoom, 0.15, 15, 0.3],
};

// Grid of the squadratinhos (z17 tiles), from zoom 13, over the visible area
const SquadratinhosGrid = ({ beforeId }) => {
  const { current: map } = useMap();
  const [area, setArea] = React.useState();

  React.useEffect(
    () => {
      const update = () => {
        // Under the minimal zoom, the layer is hidden: the lines are kept
        if (map.getZoom() < squadratinhosGridMinZoom) { return; }
        const view = getView(map.getBounds());
        setArea(previous => (previous && covers(previous, view) ? previous : getArea(view)));
      };
      update();
      map.on('moveend', update);
      return () => { map.off('moveend', update); };
    },
    [map],
  );

  const data = React.useMemo(() => (area ? getGridLines(area) : emptyGrid), [area]);

  return (
    <Source id={squadratinhosGridLayerId} type="geojson" data={data}>
      <Layer
        id={squadratinhosGridLayerId}
        type="line"
        minzoom={squadratinhosGridMinZoom}
        beforeId={beforeId}
        paint={paint}
      />
    </Source>
  );
};

export default SquadratinhosGrid;
