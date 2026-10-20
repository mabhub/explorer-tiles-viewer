import React from 'react';

import Map, { Popup } from 'react-map-gl/maplibre';

import 'maplibre-gl/dist/maplibre-gl.css';
import useLocalStorageState from 'use-local-storage-state';

import useActivities from '../hooks/use-activities';
import useShares, { isShareActive } from '../hooks/use-shares';
import MapContent, { gridFeature } from './MapContent';
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
import { addDirectionArrowImage } from '../direction-arrows';
import { getLineDistance } from '../activity-lines';
import {
  applyLayerOrder,
  findLabelsLayer,
  getActivityLinesLayerId,
  getLayerOrder,
  tilesLayerId,
} from '../layer-order';

const initialViewState = { longitude: 1.4, latitude: 43.6, zoom: 11 };
const mapStyle = { width: '100%', minHeight: 100, height: '100%' };
const interactiveLayerIds = [tilesLayerId];
// Distance, in pixels, under which the pointer is on an activity line: they
// are thin. « Interroger les données ici » looks further.
const lineClickTolerance = 5;
const lineQueryTolerance = 10;
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
  // Key named when only the tracks had arrows
  const [showDirectionArrows, setShowDirectionArrows] = useLocalStorageState('trackArrows', { defaultValue: true });
  const [activeTile, setActiveTile] = React.useState();
  // Point of the click that opened the tile popup, which points at it
  const [activeTileLngLat, setActiveTileLngLat] = React.useState();
  // Activity lines under the last click: { longitude, latitude, lines: [{ shareId, id }] }
  const [activeLines, setActiveLines] = React.useState();
  // Activity line under the pointer, highlighted: a click opens it alone
  const [hoveredLine, setHoveredLine] = React.useState();
  // What a right click on the map found under it, for « Interroger les données ici »
  const [menuQuery, setMenuQuery] = React.useState();
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
  // Lines of the popup, then the hovered one, drawn again over all the others
  const lineFeatures = React.useMemo(
    () => Object.fromEntries(activityLines.map(({ id, color, geojson }) => [
      id,
      {
        color,
        features: Object.fromEntries(geojson.features.map(feature => [feature.id, feature])),
      },
    ])),
    [activityLines],
  );
  const highlightedLines = React.useMemo(
    () => ({
      type:     'FeatureCollection',
      features: [
        ...activeLineActivities.map(({ shareId, activity }) => ({ shareId, id: activity.id })),
        ...hoveredLine ? [hoveredLine] : [],
      ]
        .map(({ shareId, id }) => {
          const feature = lineFeatures[shareId]?.features[id];
          return feature && { ...feature, properties: { color: lineFeatures[shareId].color } };
        })
        .filter(Boolean),
    }),
    [activeLineActivities, hoveredLine, lineFeatures],
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

  // One square per tile to color: visited, crossed by a track or compared.
  // Built again only when that list changes, not when a color does nor when
  // the shares are reordered (sorted ids).
  const gridTileIds = React.useMemo(
    () => [...new Set([
      ...Object.keys(allTiles),
      ...Object.keys(trackColorByTile),
      ...Object.keys(compareKindByTile),
    ])].sort().join(),
    [allTiles, trackColorByTile, compareKindByTile],
  );
  const gridTiles = React.useMemo(
    () => ({
      type:     'FeatureCollection',
      features: (gridTileIds ? gridTileIds.split(',') : []).map(id => {
        const [, x, y] = id.split('/').map(Number);
        return {
          type:       'Feature',
          properties: { id },
          geometry:   toPolygon({ x, y, width: 1, height: 1 }),
        };
      }),
    }),
    [gridTileIds],
  );

  // Bumped each time the grid source is (re)created: a basemap change replaces
  // the whole style, feature states included
  const [gridVersion, setGridVersion] = React.useState(0);
  const gridSourceRef = React.useRef();
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
      grid: showGrid,
      squadratinhosGrid: showSquadratinhosGrid,
      activityLines,
      tracks: tracks.filter(({ disabled }) => !disabled),
    }),
    [showGrid, squadrats, showSquadratinhosGrid, activityLines, tracks],
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
    ({ target: map }) => {
      addDirectionArrowImage(map);
      applyLayerOrder(map, layerOrderRef.current, labelsLayerRef.current);
    },
    [],
  );

  const handleSourceData = React.useCallback(
    ({ sourceId, sourceDataType, target: map }) => {
      // A replaced style also reports metadata for its removed grid source,
      // and the source reports it again after each new data
      const source = map.getSource(gridFeature.source);
      if (sourceId !== gridFeature.source || sourceDataType !== 'metadata'
        || !source || source === gridSourceRef.current) { return; }
      gridSourceRef.current = source;
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

  // Drawn activity lines within `tolerance` pixels of `point`, nearest first
  const findLines = React.useCallback(
    (map, point, tolerance) => {
      const shareByLayer = Object.fromEntries(activityLines
        .map(({ id }) => [getActivityLinesLayerId(id), id]));
      const layers = Object.keys(shareByLayer).filter(id => map.getLayer(id));
      if (!layers.length) { return []; }

      const box = [
        [point.x - tolerance, point.y - tolerance],
        [point.x + tolerance, point.y + tolerance],
      ];
      const project = coordinates => map.project(coordinates);
      // Corners of the box on the map, which may be rotated or pitched
      const corners = [box[0], [box[1][0], box[0][1]], box[1], [box[0][0], box[1][1]]]
        .map(corner => map.unproject(corner));
      const lngs = corners.map(({ lng }) => lng);
      const lats = corners.map(({ lat }) => lat);
      const bounds = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];
      // A line split over several map tiles is found once per tile. A plain
      // object: Map is the map component in this module.
      const nearest = {};
      map.queryRenderedFeatures(box, { layers }).forEach(({ layer, id, geometry }) => {
        const shareId = shareByLayer[layer.id];
        if (!activityByShare[shareId]?.[id]) { return; }
        const distance = getLineDistance(geometry, point, project, bounds);
        const key = `${shareId}/${id}`;
        if (distance <= tolerance && !(nearest[key]?.distance <= distance)) {
          nearest[key] = { shareId, id, distance };
        }
      });
      return Object.values(nearest).sort((a, b) => a.distance - b.distance);
    },
    [activityLines, activityByShare],
  );

  // Open the popup of these lines, or of this tile (none: close both)
  const showLines = React.useCallback(
    (map, lngLat, lines) => {
      if (activeTile) {
        map.setFeatureState(activeTile, { clicked: false });
        setActiveTile(null);
      }
      setActiveLines({ longitude: lngLat.lng, latitude: lngLat.lat, lines });
    },
    [activeTile],
  );
  const showTile = React.useCallback(
    (map, feature, lngLat) => {
      setActiveLines();
      activeTile && map.setFeatureState(activeTile, { clicked: false });
      feature && map.setFeatureState(feature, { clicked: true });
      setActiveTile(feature ?? null);
      setActiveTileLngLat(lngLat);
    },
    [activeTile],
  );

  // Escape closes the popup. A menu or a dialog open over it handles the key
  // and stops it first: the popup closes on the next press
  const hasPopup = Boolean(activeTile || activeLines);
  React.useEffect(
    () => {
      if (!hasPopup) { return undefined; }
      const handleKeyDown = ({ key }) => {
        if (key === 'Escape') { showTile(mapRef.current.getMap(), null); }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    },
    [hasPopup, showTile],
  );

  const handleContextMenu = React.useCallback(
    ({ originalEvent, point, lngLat, target: map }) => {
      originalEvent.preventDefault();
      const position = { x: originalEvent.clientX, y: originalEvent.clientY };
      const [feature] = map.queryRenderedFeatures(point, { layers: [tilesLayerId] });
      setMenuQuery({
        position,
        lngLat,
        lines: findLines(map, point, lineQueryTolerance),
        feature: feature?.state.count ? feature : null,
      });
      onContextMenuPositionChange(position);
    },
    [onContextMenuPositionChange, findLines],
  );

  // Offered only when the menu was opened by a right click on the map
  const canQuery = Boolean(menuQuery) && menuQuery.position === contextMenuPosition;
  const handleQuery = React.useCallback(
    () => {
      const map = mapRef.current.getMap();
      const { lngLat, lines, feature } = menuQuery;
      if (lines.length) {
        showLines(map, lngLat, lines);
      } else {
        showTile(map, feature, lngLat);
      }
    },
    [menuQuery, showLines, showTile],
  );

  const handleMouseMove = React.useCallback(
    ({ point, originalEvent, target: map }) => {
      // Not while panning, nor over a popup
      const line = originalEvent.buttons || originalEvent.target !== map.getCanvas()
        ? undefined
        : findLines(map, point, lineClickTolerance)[0];
      setHoveredLine(previous => (
        previous?.shareId === line?.shareId && previous?.id === line?.id ? previous : line
      ));
    },
    [findLines],
  );

  const handleMapClick = React.useCallback(
    ({
      point,
      lngLat,
      features: [feature],
      target: map,
    }) => {
      // The activity line under the pointer wins over the tile underneath
      const [line] = findLines(map, point, lineClickTolerance);
      if (line) {
        showLines(map, lngLat, [line]);
        return;
      }

      // The open tile again, an unvisited tile or no tile at all: close the popup
      const isOpen = feature?.id === activeTile?.id;
      showTile(map, isOpen || !feature?.state.count ? null : feature, lngLat);
    },
    [activeTile, findLines, showLines, showTile],
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
      onMouseMove={handleMouseMove}
      onMouseOut={() => setHoveredLine()}
      cursor={hoveredLine ? 'pointer' : undefined}
      hash
    >
      <Cadastre show={cadastre} />
      <MapContent
        labelsLayer={labelsLayer}
        tiles={gridTiles}
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
        showDirectionArrows={showDirectionArrows}
      />
      {activeTileData && (
        <Popup
          latitude={activeTileLngLat.lat}
          longitude={activeTileLngLat.lng}
          onClose={() => {
            mapRef.current.setFeatureState(activeTile, { clicked: false });
            setActiveTile();
          }}
          closeOnClick={false}
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
        onQuery={canQuery ? handleQuery : undefined}
        canQuery={canQuery && Boolean(menuQuery.lines.length || menuQuery.feature)}
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
        showDirectionArrows={showDirectionArrows}
        onDirectionArrowsToggle={() => setShowDirectionArrows(previous => !previous)}
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
