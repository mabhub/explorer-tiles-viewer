const thunderforestKey = import.meta.env.VITE_THUNDERFOREST_KEY;
const thunderforestAttribution = '&copy; Thunderforest, &copy; OpenStreetMap contributors';

// Same raster basemaps as the Strava map userscript
const rasterBasemaps = [
  {
    id: 'thunderforest-cycle',
    label: 'Cycle',
    tiles: `https://api.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=${thunderforestKey}`,
    attribution: thunderforestAttribution,
    maxzoom: 21,
    needsThunderforestKey: true,
  },
  {
    id: 'cyclosm',
    label: 'CyclOSM',
    tiles: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; CyclOSM, &copy; OpenStreetMap contributors',
    maxzoom: 20,
  },
  {
    id: 'osm-standard',
    label: 'OSM',
    tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxzoom: 19,
  },
  {
    id: 'osm-hot',
    label: 'Humanitaire',
    tiles: 'https://tile-a.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap France, &copy; OpenStreetMap contributors',
    maxzoom: 20,
  },
  {
    id: 'thunderforest-transport',
    label: 'Transports',
    tiles: `https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=${thunderforestKey}`,
    attribution: thunderforestAttribution,
    maxzoom: 21,
    needsThunderforestKey: true,
  },
  {
    id: 'thunderforest-landscape',
    label: 'Paysage',
    tiles: `https://tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=${thunderforestKey}`,
    attribution: thunderforestAttribution,
    maxzoom: 21,
    needsThunderforestKey: true,
  },
  {
    id: 'thunderforest-outdoors',
    label: 'Plein air',
    tiles: `https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${thunderforestKey}`,
    attribution: thunderforestAttribution,
    maxzoom: 21,
    needsThunderforestKey: true,
  },
  {
    id: 'opentopomap',
    label: 'Topo',
    tiles: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap, &copy; OpenStreetMap contributors',
    maxzoom: 17,
  },
  {
    id: 'ign-plan',
    label: 'IGN',
    tiles: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    attribution: '&copy; IGN / Géoplateforme',
    maxzoom: 19,
  },
];

// Built once: a new style object on each render would reload the map
const toStyle = ({
  id,
  tiles,
  attribution,
  maxzoom,
}) => ({
  version: 8,
  sources: {
    [id]: {
      type: 'raster',
      tiles: [tiles],
      tileSize: 256,
      maxzoom,
      attribution,
    },
  },
  layers: [{ id, type: 'raster', source: id }],
});

export const defaultBasemap = {
  id: 'default',
  label: 'Topographique (vectoriel)',
  style: import.meta.env.VITE_DEFAULT_MAPSTYLE,
};

const basemaps = [
  defaultBasemap,
  ...rasterBasemaps
    // Thunderforest basemaps are left out without an API key
    .filter(({ needsThunderforestKey }) => !needsThunderforestKey || thunderforestKey)
    .map(basemap => ({ id: basemap.id, label: basemap.label, style: toStyle(basemap) })),
];

export const getBasemap = id => basemaps.find(basemap => basemap.id === id) ?? defaultBasemap;

export default basemaps;
