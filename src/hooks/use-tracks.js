import React from 'react';

import { getValue, setValue } from '../key-value-store';

// Tracks can weigh several MB, beyond what localStorage holds: they are kept
// in IndexedDB, as a single list `[{ id, name, color, disabled, lines }]`
const storeKey = 'tracks';
// Color pickers report every hue on their way: the list is saved once settled
const saveDelay = 300;

// Without IndexedDB (some private modes), tracks last for the session only
const useTracks = () => {
  const [tracks, setTracks] = React.useState([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(
    () => {
      let isCancelled = false;
      getValue(storeKey)
        .then(stored => {
          // Tracks added while loading come after the stored ones. A rerun of
          // the effect (Fast Refresh) finds them loaded already
          if (!isCancelled && stored) {
            setTracks(previous => [
              ...stored,
              ...previous.filter(({ id }) => !stored.some(track => track.id === id)),
            ]);
          }
        })
        // eslint-disable-next-line no-console
        .catch(error => console.error(error))
        .finally(() => { if (!isCancelled) { setIsLoaded(true); } });

      return () => { isCancelled = true; };
    },
    [],
  );

  React.useEffect(
    () => {
      if (!isLoaded) { return undefined; }
      const timeout = setTimeout(
        () => setValue(storeKey, tracks)
          // eslint-disable-next-line no-console
          .catch(error => console.error(error)),
        saveDelay,
      );
      return () => clearTimeout(timeout);
    },
    [tracks, isLoaded],
  );

  return [tracks, setTracks];
};

export default useTracks;
