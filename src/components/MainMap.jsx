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
import TilePopup from './TilePopup';
import {
  getMaxColumn,
  getMaxLine,
  getMaxSquare,
  toPolygon,
} from '../max-areas';
import { defaultBasemap, getBasemap } from '../basemaps';

const protocol = new pmtiles.Protocol();
MapLibreGL.addProtocol('pmtiles', protocol.tile);
const initialViewState = { longitude: 1.4, latitude: 43.6, zoom: 11 };
const mapStyle = { width: '100%', minHeight: 100, height: '100%' };
const interactiveLayerIds = ['tiles'];
const noMaxAreas = { square: false, line: false, column: false };
const maxAreaGetters = { square: getMaxSquare, line: getMaxLine, column: getMaxColumn };

const MainMap = ({
  routes = [],
  colorMode,
  colorByShare,
  activePersonCount,
  labelByShare,
  contextMenuPosition,
  onContextMenuPositionChange,
  onShareAdd,
}) => {
  const mapRef = React.useRef();
  // Labels of the basemap (vector ones only) to keep above the grid, looked up
  // each time the grid is added to a new style
  const [labelsLayer, setLabelsLayer] = React.useState();
  const [basemapId, setBasemapId] = useLocalStorageState('basemap', { defaultValue: defaultBasemap.id });
  const basemap = getBasemap(basemapId);
  const [maxAreas, setMaxAreas] = useLocalStorageState('maxAreas', { defaultValue: noMaxAreas });
  const [showGrid, setShowGrid] = useLocalStorageState('showGrid', { defaultValue: true });
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

        activities.forEach(activity => {
          const { user_id: userId, tiles } = activity;
          tiles.forEach(({ x, y }) => {
            const key = `14/${x}/${y}`;
            if (!store[key]) {
              store[key] = {
                users: [],
                shares: [],
                activities: [],
                userCount: 0,
                latestDate: '',
              };
            }
            const tile = store[key];

            tile.activities.push({ activity, shareId: id });
            // "YYYY-MM-DD hh:mm:ss" dates compare as strings
            if (activity.date > tile.latestDate) {
              tile.latestDate = activity.date;
            }
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

  // Max square, line and column of each person (all their active shares
  // together), drawn in the owner coloring mode only
  const maxAreaFeatures = React.useMemo(
    () => {
      const kinds = Object.keys(maxAreaGetters).filter(kind => maxAreas[kind]);
      if (colorMode !== 'owner' || !kinds.length) {
        return { type: 'FeatureCollection', features: [] };
      }

      const people = {};
      allActivitiesQueries.forEach(({ data: [id, activities] = [], status }) => {
        if (status !== 'success' || !isShareActive(shares[id])) { return; }
        activities.forEach(({ user_id: userId, tiles }) => {
          // A plain object: Map is the map component in this module
          if (!people[userId]) { people[userId] = { shareId: id, tiles: {} }; }
          tiles.forEach(({ x, y }) => { people[userId].tiles[`${x}/${y}`] = [x, y]; });
        });
      });

      return {
        type: 'FeatureCollection',
        features: Object.values(people).flatMap(({ shareId, tiles }) => kinds
          .map(kind => maxAreaGetters[kind](Object.values(tiles)))
          .filter(Boolean)
          .map(area => ({
            type: 'Feature',
            geometry: toPolygon(area),
            properties: { color: colorByShare[shareId] },
          }))),
      };
    },
    [allActivitiesQueries, shares, maxAreas, colorMode, colorByShare],
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
          map.removeFeatureState({ ...gridFeature, id }, 'year');
        }
      });
      Object.entries(allTiles).forEach(([id, { userCount, shares: owners, latestDate }]) => {
        map.setFeatureState({ ...gridFeature, id }, {
          count: userCount,
          // Color of the only owning person (all their shares share it), none
          // when several people own the tile
          color: userCount === 1 ? colorByShare[owners[0]] : null,
          year: latestDate ? Number(latestDate.slice(0, 4)) : null,
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
      onContextMenuPositionChange({ x: originalEvent.clientX, y: originalEvent.clientY });
    },
    [onContextMenuPositionChange],
  );

  const handleMapClick = React.useCallback(
    ({ features: [feature], target: map }) => {
      // The open tile again, an unvisited tile or no tile at all: close the popup
      if (feature?.id === activeTile?.id || !feature?.state.count) {
        if (activeTile) {
          map.setFeatureState(activeTile, { clicked: false });
          setActiveTile(null);
        }
        return;
      }

      activeTile && map.setFeatureState(activeTile, { clicked: false });
      map.setFeatureState(feature, { clicked: true });
      setActiveTile(feature);
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
        maxAreas={maxAreaFeatures}
        showGrid={showGrid}
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
          maxWidth="360px"
        >
          <TilePopup
            key={activeTile.id}
            tile={activeTileData}
            labelByShare={labelByShare}
            colorByShare={colorByShare}
          />
        </Popup>
      )}
      <MapContextMenu
        position={contextMenuPosition}
        onClose={() => onContextMenuPositionChange()}
        basemapId={basemap.id}
        onBasemapChange={handleBasemapChange}
        maxAreas={maxAreas}
        onMaxAreaToggle={kind => setMaxAreas(previous => ({ ...previous, [kind]: !previous[kind] }))}
        canShowMaxAreas={colorMode === 'owner'}
        showGrid={showGrid}
        onGridToggle={() => setShowGrid(previous => !previous)}
        onShareAdd={onShareAdd}
      />
    </Map>
  );
};

export default MainMap;
