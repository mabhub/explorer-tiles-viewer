import { Layer, Source } from '@vis.gl/react-maplibre';

const nullObj = {};

const Cadastre = ({ layerProps = nullObj, show = true, ...props }) => show && (
  <Source
    id="parcelles-source"
    type="vector"
    tiles={[
      'https://openmaptiles.geo.data.gouv.fr/data/cadastre/{z}/{x}/{y}.pbf',
    ]}
    minzoom={13}
    maxzoom={16}
    {...props}
  >
    <Layer
      id="parcelles-layer"
      type="fill"
      source-layer="parcelles"
      paint={{
        'fill-opacity': 0.75,
        'fill-color': 'silver',
        'fill-outline-color': 'transparent',
        'fill-antialias': true,
      }}
      {...layerProps}
    />
  </Source>
);

export default Cadastre;
