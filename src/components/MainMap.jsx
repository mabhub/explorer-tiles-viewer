import React from 'react';

import Map, { Popup } from 'react-map-gl/maplibre';
import * as pmtiles from 'pmtiles';

import 'maplibre-gl/dist/maplibre-gl.css';
import MapLibreGL from 'maplibre-gl';
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

  const allTiles = React.useMemo(
    () => {
      const store = {};

      allActivitiesQueries.forEach(({ data: [id, activities] = [], status }) => {
        if (status !== 'success' || shares[id].disabled === true) { return; }

        activities.forEach(({ user_id: userId, tiles }) => {
          tiles.forEach(({ x, y }) => {
            const key = `14/${x}/${y}`;
            if (!store[key]) {
              store[key] = { users: [], activityCount: 0, userCount: 0 };
            }
            const tile = store[key];

            tile.activityCount += 1;
            if (!tile.users.includes(userId)) {
              tile.users.push(userId);
              tile.userCount = tile.users.length;
            }
          });
        });
      });

      return store;
    },
    [allActivitiesQueries, shares],
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
      if (!feature) { return; }

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

  const activeTileData = activeTile && allTiles[activeTile.id];

  // Close the popup once its tile is no longer part of the displayed shares
  React.useEffect(
    () => {
      if (activeTile && !activeTileData) {
        mapRef.current?.setFeatureState(activeTile, { clicked: false });
        setActiveTile();
      }
    },
    [activeTile, activeTileData],
  );

  const popupContent = React.useMemo(
    () => {
      if (!activeTileData) { return ''; }
      return JSON.stringify(activeTileData, null, 2);
    },
    [activeTileData],
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
      hash
    >
      <Cadastre show={cadastre} />
      <MapContent gridBefore={gridBefore} routes={routes} />
      {activeTileData && (
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
