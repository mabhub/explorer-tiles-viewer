import React from 'react';
import ReactDOM from 'react-dom/client';

import {
  createTheme,
  CssBaseline,
  responsiveFontSizes,
  ThemeProvider,
} from '@mui/material';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import App from './App';
import { getValue, removeValue, setValue } from './key-value-store';

// Shares change a few times a day at most: fetched data is refreshed in the
// background once older than the CDN cache (15 min), and only when loaded
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15 * 60 * 1000, refetchOnWindowFocus: false },
  },
});

// The last fetched data is shown at once on the next visit, while refreshed.
// Kept as objects in IndexedDB: no JSON string of a few MB at each save.
const persistOptions = {
  persister: createAsyncStoragePersister({
    storage: {
      getItem:    getValue,
      setItem:    setValue,
      // Called without waiting, also when IndexedDB is missing
      removeItem: key => removeValue(key).catch(() => {}),
    },
    key:         'queries',
    serialize:   data => data,
    deserialize: data => data,
  }),
  maxAge: 30 * 24 * 60 * 60 * 1000,
  // By default only successful queries are kept: a failed refresh would drop
  // the last data, shown on the map until then
  dehydrateOptions: { shouldDehydrateQuery: query => query.state.data !== undefined },
  // To bump when the shape of fetched data changes: drops the stored one
  buster: '1',
};

const theme = responsiveFontSizes(createTheme({
  palette: {
    primary: {
      main: '#adb31b',
    },
  },
}));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
