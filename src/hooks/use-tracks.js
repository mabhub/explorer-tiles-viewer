import React from 'react';

// Tracks can weigh several MB, beyond what localStorage holds: they are kept
// in IndexedDB, as a single list `[{ id, name, color, disabled, lines }]`
const databaseName = 'explorer-tiles-viewer';
const storeName = 'keyval';
const storeKey = 'tracks';
// Color pickers report every hue on their way: the list is saved once settled
const saveDelay = 300;

let database;
const openDatabase = () => {
  database = database ?? new Promise((resolve, reject) => {
    const opening = indexedDB.open(databaseName, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(storeName);
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
  return database;
};

const runInStore = async (mode, operation) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = operation(db.transaction(storeName, mode).objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Without IndexedDB (some private modes), tracks last for the session only
const useTracks = () => {
  const [tracks, setTracks] = React.useState([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(
    () => {
      let isCancelled = false;
      runInStore('readonly', store => store.get(storeKey))
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
        () => runInStore('readwrite', store => store.put(tracks, storeKey))
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
