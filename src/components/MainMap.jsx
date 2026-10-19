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
import { getTrackTiles } from '../tracks';
import {
  applyLayerOrder,
  findLabelsLayer,
  getActivityLinesLayerId,
  getLayerOrder,
  tilesLayerId,
} from '../layer-order';

const protocol = new pmtiles.Protocol();
MapLibreGL.addProtocol('pmtiles', protocol.tile);
const initialViewState = { longitude: 1.4, latitude: 43.6, zoom: 11 };
const mapStyle = { width: '100%', minHeight: 100, height: '100%' };
const interactiveLayerIds = [tilesLayerId];
// Half side, in pixels, of the square searched for activity lines around a
// click: they are thin
const lineClickTolerance = 5;
const noMaxAreas = { square: false, line: false, column: false };
const maxAreaGetters = { square: getMaxSquare, line: getMaxLine, column: getMaxColumn };

// Sets the feature state `name` of the grid tiles listed in `valueById` and
// removes it from the tiles painted before and no longer listed. Painted
// again when the grid source is replaced (`gridVersion`).
const useGridState = (mapRef, gridVersion, valueById, name) => {
  const painted = React.useRef({});
  React.useEffect(
    () => {
      if (!gridVersion) { return; }
      const map = mapRef.current;

      Object.keys(painted.current).forEach(id => {
        if (!valueById[id]) { map.removeFeatureState({ ...gridFeature, id }, name); }
      });
      Object.entries(valueById).forEach(([id, value]) => {
        map.setFeatureState({ ...gridFeature, id }, { [name]: value });
      });

      painted.current = valueById;
    },
    [mapRef, gridVersion, valueById, name],
  );
};

const MainMap = ({
  tracks,
  squadrats,
  activityLines,
  colorMode,
  compareKindByTile,
  countActivities,
  onCountActivitiesToggle,
  colorByShare,
  activePersonCount,
  labelByShare,
  contextMenuPosition,
  onContextMenuPositionChange,
  onShareAdd,
  onTrackAdd,
  shareItems,
  onSharesToggle,
  activityItems,
  onActivitiesToggle,
  trackItems,
  onTracksToggle,
  onSquadratsAdd,
  squadratsItems,
  onSquadratsToggle,
}) => {
  const mapRef = React.useRef();
  // Labels of the basemap (vector ones only) to keep above the viewer layers,
  // looked up each time the grid is added to a new style
  const [labelsLayer, setLabelsLayer] = React.useState();
  const [basemapId, setBasemapId] = useLocalStorageState('basemap', { defaultValue: defaultBasemap.id });
  const basemap = getBasemap(basemapId);
  const [maxAreas, setMaxAreas] = useLocalStorageState('maxAreas', { defaultValue: noMaxAreas });
  const [showGrid, setShowGrid] = useLocalStorageState('showGrid', { defaultValue: true });
  const [showSquadratinhosGrid, setShowSquadratinhosGrid] = useLocalStorageState('squadratinhosGrid', { defaultValue: false });
  const [activeTile, setActiveTile] = React.useState();
  // Activity lines under the last click: { longitude, latitude, lines: [{ shareId, id }] }
  const [activeLines, setActiveLines] = React.useState();
  const [cadastre] = React.useState(false);
  const [shares] = useShares();

  const shareIds = Object.keys(shares).join(',');
  // A failed refresh keeps the last data: shares are drawn as long as they have some
  const allActivitiesQueries = useActivities(shareIds);

  const allTiles = React.useMemo(
    () => {
      const store = {};

      allActivitiesQueries.forEach(({ data: [id, activities] = [] }) => {
        if (!activities || !isShareActive(shares[id])) { return; }

        activities.forEach(activity => {
          const { user_id: userId, tiles } = activity;
          tiles.forEach(({ x, y }) => {
            const key = `14/${x}/${y}`;
            if (!store[key]) {
              store[key] = {
                users: [],
                shares: [],
                activities: [],
                activityKeys: new Set(),
                userCount: 0,
                latestDate: '',
              };
            }
            const tile = store[key];

            tile.activities.push({ activity, shareId: id });
            // Several shares of a person often include the same activity: it
            // is counted once, as in the popup
            tile.activityKeys.add(activity.foreignId ? `${userId}/${activity.foreignId}` : activity);
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

  // Activities of the shares whose lines are drawn, by Statshunters id: each
  // line names its activity
  const activityByShare = React.useMemo(
    () => {
      const lineShareIds = new Set(activityLines.map(({ id }) => id));
      return Object.fromEntries(allActivitiesQueries
        .filter(({ data: [id, activities] = [] }) => activities && lineShareIds.has(id))
        .map(({ data: [id, activities] }) => [
          id,
          Object.fromEntries(activities.map(activity => [activity.id, activity])),
        ]));
    },
    [allActivitiesQueries, activityLines],
  );

  // Clicked lines as the activities of a tile, for the same popup
  const activeLineActivities = React.useMemo(
    () => (activeLines?.lines ?? [])
      .map(({ shareId, id }) => ({ activity: activityByShare[shareId]?.[id], shareId }))
      .filter(({ activity }) => activity),
    [activeLines, activityByShare],
  );
  const highlightedLines = React.useMemo(
    () => {
      const ids = {};
      activeLineActivities.forEach(({ shareId, activity }) => {
        ids[shareId] = [...ids[shareId] ?? [], activity.id];
      });
      return ids;
    },
    [activeLineActivities],
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
      allActivitiesQueries.forEach(({ data: [id, activities] = [] }) => {
        if (!activities || !isShareActive(shares[id])) { return; }
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

  // Uncolored tiles crossed by an active track take its color, the first
  // track of the list winning
  const trackColorByTile = React.useMemo(
    () => {
      const colors = {};
      tracks.filter(({ disabled }) => !disabled).forEach(({ lines, color }) => {
        getTrackTiles(lines).forEach(id => { colors[id] = colors[id] ?? color; });
      });
      return colors;
    },
    [tracks],
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
          map.removeFeatureState({ ...gridFeature, id }, 'activities');
        }
      });
      Object.entries(allTiles).forEach(([id, {
        userCount,
        shares: owners,
        latestDate,
        activityKeys,
      }]) => {
        map.setFeatureState({ ...gridFeature, id }, {
          count: userCount,
          activities: activityKeys.size,
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

  // Painted apart from the visited tiles: a tile keeps its track color
  // underneath, shown once no active share visits it
  useGridState(mapRef, gridVersion, trackColorByTile, 'track');
  // Compare mode: kind of each tile known to the person or their squadrats
  useGridState(mapRef, gridVersion, compareKindByTile, 'compare');

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

  // Viewer layers from bottom to top, kept in that order under the labels
  const layerOrder = React.useMemo(
    () => getLayerOrder({
      squadrats: squadrats.filter(({ disabled }) => !disabled),
      squadratinhosGrid: showSquadratinhosGrid,
      activityLines,
      tracks: tracks.filter(({ disabled }) => !disabled),
    }),
    [squadrats, showSquadratinhosGrid, activityLines, tracks],
  );
  const layerOrderRef = React.useRef(layerOrder);
  layerOrderRef.current = layerOrder;
  const labelsLayerRef = React.useRef(labelsLayer);
  labelsLayerRef.current = labelsLayer;

  // Layers are created in order, but a list reordered does not move them, and
  // one created later (an entry turned on, a source replaced) goes on top
  React.useEffect(
    () => {
      if (mapRef.current) { applyLayerOrder(mapRef.current.getMap(), layerOrder, labelsLayer); }
    },
    [layerOrder, labelsLayer],
  );
  // Reported the frame after any change of the style, layers added included
  const handleStyleData = React.useCallback(
    ({ target: map }) => applyLayerOrder(map, layerOrderRef.current, labelsLayerRef.current),
    [],
  );

  const handleSourceData = React.useCallback(
    ({ sourceId, sourceDataType, target: map }) => {
      // A replaced style also reports metadata for its removed grid source
      if (sourceId !== gridFeature.source || sourceDataType !== 'metadata'
        || !map.getSource(gridFeature.source)) { return; }
      // The viewer layers may already be there: left out of the search
      setLabelsLayer(findLabelsLayer(map.getStyle().layers, new Set(layerOrderRef.current)));
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
    ({
      point,
      lngLat,
      features: [feature],
      target: map,
    }) => {
      // Activity lines win over the tile underneath: near a line, its activities
      const shareByLayer = Object.fromEntries(activityLines
        .map(({ id }) => [getActivityLinesLayerId(id), id]));
      const layers = Object.keys(shareByLayer).filter(id => map.getLayer(id));
      const box = [
        [point.x - lineClickTolerance, point.y - lineClickTolerance],
        [point.x + lineClickTolerance, point.y + lineClickTolerance],
      ];
      // A line split over several map tiles is found once per tile. A plain
      // object: Map is the map component in this module.
      const lines = Object.values(Object.fromEntries(
        (layers.length ? map.queryRenderedFeatures(box, { layers }) : [])
          .map(({ layer, id }) => ({ shareId: shareByLayer[layer.id], id }))
          .filter(({ shareId, id }) => activityByShare[shareId]?.[id])
          .map(line => [`${line.shareId}/${line.id}`, line]),
      ));

      if (lines.length) {
        if (activeTile) {
          map.setFeatureState(activeTile, { clicked: false });
          setActiveTile(null);
        }
        setActiveLines({ longitude: lngLat.lng, latitude: lngLat.lat, lines });
        return;
      }
      setActiveLines();

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
    [activeTile, activityLines, activityByShare],
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

  // Close the popup once none of its activities is drawn any more
  React.useEffect(
    () => {
      if (activeLines && !activeLineActivities.length) { setActiveLines(); }
    },
    [activeLines, activeLineActivities],
  );

  return (
    <Map
      // Reached from outside the map through useMap()
      id="main"
      initialViewState={initialViewState}
      style={mapStyle}
      mapStyle={basemap.style}
      onLoad={handleMapLoad}
      onSourceData={handleSourceData}
      onStyleData={handleStyleData}
      onContextMenu={handleContextMenu}
      ref={mapRef}
      interactiveLayerIds={interactiveLayerIds}
      onClick={handleMapClick}
      hash
    >
      <Cadastre show={cadastre} />
      <MapContent
        labelsLayer={labelsLayer}
        tracks={tracks}
        squadrats={squadrats}
        activityLines={activityLines}
        highlightedLines={highlightedLines}
        colorMode={colorMode}
        countActivities={countActivities}
        activePersonCount={activePersonCount}
        maxAreas={maxAreaFeatures}
        showGrid={showGrid}
        showSquadratinhosGrid={showSquadratinhosGrid}
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
      {activeLineActivities.length > 0 && (
        <Popup
          latitude={activeLines.latitude}
          longitude={activeLines.longitude}
          onClose={() => setActiveLines()}
          closeOnClick={false}
          maxWidth="360px"
        >
          <TilePopup
            key={`${activeLines.longitude},${activeLines.latitude}`}
            tile={{ activities: activeLineActivities }}
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
        onMaxAreaToggle={kind => setMaxAreas(
          previous => ({ ...previous, [kind]: !previous[kind] }),
        )}
        canShowMaxAreas={colorMode === 'owner'}
        showGrid={showGrid}
        onGridToggle={() => setShowGrid(previous => !previous)}
        showSquadratinhosGrid={showSquadratinhosGrid}
        onSquadratinhosGridToggle={() => setShowSquadratinhosGrid(previous => !previous)}
        countActivities={countActivities}
        onCountActivitiesToggle={onCountActivitiesToggle}
        canCountActivities={colorMode === 'count'}
        onShareAdd={onShareAdd}
        onTrackAdd={onTrackAdd}
        shareItems={shareItems}
        onSharesToggle={onSharesToggle}
        activityItems={activityItems}
        onActivitiesToggle={onActivitiesToggle}
        trackItems={trackItems}
        onTracksToggle={onTracksToggle}
        onSquadratsAdd={onSquadratsAdd}
        squadratsItems={squadratsItems}
        onSquadratsToggle={onSquadratsToggle}
      />
    </Map>
  );
};

export default MainMap;
