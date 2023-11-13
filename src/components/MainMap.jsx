import React from 'react';

import Map from 'react-map-gl/maplibre';
import * as pmtiles from 'pmtiles';

import 'maplibre-gl/dist/maplibre-gl.css';
import MapLibreGL from 'maplibre-gl';
import { Popup } from 'react-map-gl';
import { useLocation } from 'react-router-dom';
import createPersistedState from 'use-persisted-state/src';

import useActivities from '../hooks/use-activities';
import MapContent from './MapContent';
import { throttle, tile2lat, tile2long } from '../lib';
import Cadastre from './Cadastre';

const useSharesState = createPersistedState('shares');

const protocol = new pmtiles.Protocol();
MapLibreGL.addProtocol('pmtiles', protocol.tile);
const initialViewState = { longitude: 1.4, latitude: 43.6, zoom: 11 };
const mapStyle = { width: '100%', minHeight: 100, height: '100%' };
const interactiveLayerIds = ['tiles'];

const MainMap = ({ routes = [] }) => {
  const mapRef = React.useRef();
  const [gridBefore, setGridBefore] = React.useState();
  const [activeTile, setActiveTile] = React.useState();
  const [cadastre] = React.useState(false);
  const [shares] = useSharesState({});

  const shareIds = Object.entries(shares).map(([id]) => id).join(',');
  const allActivitiesQueries = useActivities(shareIds);

  const allActivities = React.useMemo(
    () => {
      if (allActivitiesQueries.some(({ isLoading }) => isLoading === true)) {
        return {};
      }

      const store = [];

      allActivitiesQueries.forEach(({ data: [id, data] = [], status }) => {
        if (status === 'success') {
          if (shares[id].disabled !== true) {
            store.push(data);
          }
        }
      });

      const flat = store.flat().map(({ tiles, ...rest }) => ({
        ...rest,
        tiles,
        tilesZXY: tiles.map(({ x, y }) => `14/${x}/${y}`),
      }));

      return flat;
    },
    [allActivitiesQueries, shares],
  );

  const allTiles = React.useMemo(
    () => {
      const store = {};

      allActivities.forEach?.(activity => {
        activity.tilesZXY.forEach?.(tile => {
          // Init tile in store
          if (!store[tile]) {
            store[tile] = { activities: [], users: [] };
          }
          store[tile].activities.push(activity);

          store[tile].users.push(activity.user_id);
          store[tile].users = Array.from(new Set(store[tile].users));

          store[tile].activityCount = store[tile].activities.length;
          store[tile].userCount = store[tile].users.length;
        });
      });
      return store;
    },
    [allActivities],
  );

  const renderTiles = React.useCallback( // eslint-disable-line react-hooks/exhaustive-deps
    throttle(() => {
      const map = mapRef.current;
      window.map = map;

      if (!map) {
        // eslint-disable-next-line no-console
        console.info('map is not ready yet');
        return;
      }
      if (!map.getStyle?.()?.layers.find?.(({ id }) => id === 'tiles')) {
        // eslint-disable-next-line no-console
        console.info('no such layer: "tiles"');
        return;
      }
      const features = map.queryRenderedFeatures({ layers: ['tiles'] });

      features.forEach(feature => {
        const tileRef = feature.properties.id;

        if (allTiles[tileRef]?.userCount) {
          map.setFeatureState(feature, {
            count: allTiles[tileRef]?.userCount || 0,
          });
        } else {
          map.removeFeatureState(feature);
        }
      });
    }, 750),
    [allTiles],
  );

  React.useEffect(
    () => {
      renderTiles();
    },
    [renderTiles],
  );

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

  const handleMapClick = React.useCallback(
    ({ features: [feature], target: map }) => {
      if (feature.id === activeTile?.id) {
        map.setFeatureState(activeTile, { clicked: false });
        setActiveTile(null);
      } else if (feature.state.count) {
        activeTile && map.setFeatureState(activeTile, { clicked: false });
        map.setFeatureState(feature, { clicked: true });
        setActiveTile(feature);
      }
    },
    [activeTile],
  );

  const popupContent = React.useMemo(
    () => {
      if (!activeTile?.id) { return ''; }
      const { activities, ...tileData } = allTiles[activeTile.id];
      return JSON.stringify(tileData, null, 2);
    },
    [activeTile, allTiles],
  );
  return (
    <Map
      initialViewState={initialViewState}
      style={mapStyle}
      mapStyle={import.meta.env.VITE_DEFAULT_MAPSTYLE}
      onLoad={handleMapLoad}
      onMoveEnd={renderTiles}
      onMove={renderTiles}
      onZoomEnd={renderTiles}
      onZoom={renderTiles}
      ref={mapRef}
      interactiveLayerIds={interactiveLayerIds}
      onClick={handleMapClick}
    >
      <Cadastre show={cadastre} />
      <MapContent gridBefore={gridBefore} routes={routes} />
      {activeTile && (
        <Popup
          latitude={tile2lat(activeTile.id.split('/').at(2), 14)}
          longitude={tile2long(activeTile.id.split('/').at(1), 14)}
          onClose={() => {
            mapRef.current.setFeatureState(activeTile, { clicked: false });
            setActiveTile();
          }}
          closeOnClick={false}
          anchor="bottom-right"
        >
          <pre>{popupContent}</pre>
        </Popup>
      )}
    </Map>
  );
};

MainMap.whyDidYouRender = true;

export default MainMap;
