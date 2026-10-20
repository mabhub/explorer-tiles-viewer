import {
  BrowserRouter,
  Routes,
  Route,
} from 'react-router-dom';

import { MapProvider } from '@vis.gl/react-maplibre';

import Home from './components/Home';

const App = () => (
  <BrowserRouter>
    <MapProvider>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </MapProvider>
  </BrowserRouter>
);

export default App;
