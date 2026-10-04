import React from 'react';

import Map, { Popup } from 'react-map-gl/maplibre';
import * as pmtiles from 'pmtiles';

import 'maplibre-gl/dist/maplibre-gl.css';
import MapLibreGL from 'maplibre-gl';
import useLocalStorageState from 'use-local-storage-state';

import useActivities from '../hooks/use-activities';
import useShares, { isShareActive } from '../hooks/use-shares';
import MapContent, { gridFeature } from './MapContent';
import { tile2lat, tile2long } from '../lib';
import Cadastre from './Cadastre';
import MapContextMenu from './MapContextMenu';
import { defaultBasemap, getBasemap } from '../basemaps';

const protocol = new pmtiles.Protocol();
MapLibreGL.addProtocol('pmtiles', protocol.tile);
const initialViewState = { longitude: 1.4, latitude: 43.6, zoom: 11 };
const mapStyle = { width: '100%', minHeight: 100, height: '100%' };
const interactiveLayerIds = ['tiles'];

const MainMap = ({
  routes = [],
  colorMode,
  colorByShare,
  activePersonCount,
}) => {
  const mapRef = React.useRef();
  // Labels of the basemap (vector ones only) to keep above the grid, looked up
  // each time the grid is added to a new style
  const [labelsLayer, setLabelsLayer] = React.useState();
  const [basemapId, setBasemapId] = useLocalStorageState('basemap', { defaultValue: defaultBasemap.id });
  const basemap = getBasemap(basemapId);
  const [contextMenuPosition, setContextMenuPosition] = React.useState();
  const [activeTile, setActiveTile] = React.useState();
  const [cadastre] = React.useState(false);
  const [shares] = useShares();

  const shareIds = Object.keys(shares).join(',');
  const allActivitiesQueries = useActivities(shareIds);

  const allTiles = React.useMemo(
    () => {
      const store = {};

      allActivitiesQueries.forEach(({ data: [id, activities] = [], status }) => {
        if (status !== 'success' || !isShareActive(shares[id])) { return; }

        activities.forEach(({ user_id: userId, tiles }) => {
          tiles.forEach(({ x, y }) => {
            const key = `14/${x}/${y}`;
            if (!store[key]) {
              store[key] = { users: [], shares: [], activityCount: 0, userCount: 0 };
            }
            const tile = store[key];

            tile.activityCount += 1;
            if (!tile.users.includes(userId)) {
              tile.users.push(userId);
              tile.userCount = tile.users.length;
            }
            if (!tile.shares.includes(id)) {
              tile.shares.push(id);
            }
          });
        });
      });

      return store;
    },
    [allActivitiesQueries, shares],
  );

  // Bumped each time the grid source is (re)created: a basemap change replaces
  // the whole style, feature states included
  const [gridVersion, setGridVersion] = React.useState(0);
  const paintedTiles = React.useRef({});

  // Feature states are kept by the source and applied to grid tiles as they
  // load, so they only need updating when the aggregated data changes.
  React.useEffect(
    () => {
      if (!gridVersion) { return; }
      const map = mapRef.current;

      Object.keys(paintedTiles.current).forEach(id => {
        if (!allTiles[id]) {
          map.removeFeatureState({ ...gridFeature, id }, 'count');
          map.removeFeatureState({ ...gridFeature, id }, 'color');
        }
      });
      Object.entries(allTiles).forEach(([id, { userCount, shares: owners }]) => {
        map.setFeatureState({ ...gridFeature, id }, {
          count: userCount,
          // Color of the only owning person (all their shares share it), none
          // when several people own the tile
          color: userCount === 1 ? colorByShare[owners[0]] : null,
        });
      });

      paintedTiles.current = allTiles;
    },
    [allTiles, gridVersion, colorByShare],
  );

  // A new grid source has lost the highlight of the tile whose popup is open
  React.useEffect(
    () => {
      if (gridVersion && activeTile) {
        mapRef.current.setFeatureState(activeTile, { clicked: true });
      }
    },
    [gridVersion, activeTile],
  );

  const handleMapLoad = React.useCallback(
    ({ target: map }) => {
      window.map = map;
    },
    [],
  );

  const handleSourceData = React.useCallback(
    ({ sourceId, sourceDataType, target: map }) => {
      // A replaced style also reports metadata for its removed grid source
      if (sourceId !== gridFeature.source || sourceDataType !== 'metadata'
        || !map.getSource(gridFeature.source)) { return; }
      setLabelsLayer(map.getLayer('waterway-name') ? 'waterway-name' : undefined);
      setGridVersion(version => version + 1);
    },
    [],
  );

  const handleBasemapChange = React.useCallback(
    id => {
      // Until the new style is there, its labels layer is unknown
      setLabelsLayer();
      setBasemapId(id);
    },
    [setBasemapId],
  );

  const handleContextMenu = React.useCallback(
    ({ originalEvent }) => {
      originalEvent.preventDefault();
      setContextMenuPosition({ x: originalEvent.clientX, y: originalEvent.clientY });
    },
    [],
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
      mapStyle={basemap.style}
      onLoad={handleMapLoad}
      onSourceData={handleSourceData}
      onContextMenu={handleContextMenu}
      ref={mapRef}
      interactiveLayerIds={interactiveLayerIds}
      onClick={handleMapClick}
      hash
    >
      <Cadastre show={cadastre} />
      <MapContent
        gridBefore={labelsLayer}
        routes={routes}
        colorMode={colorMode}
        activePersonCount={activePersonCount}
      />
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
      <MapContextMenu
        position={contextMenuPosition}
        onClose={() => setContextMenuPosition()}
        basemapId={basemap.id}
        onBasemapChange={handleBasemapChange}
      />
    </Map>
  );
};

export default MainMap;
