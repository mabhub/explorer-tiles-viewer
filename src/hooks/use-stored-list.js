import React from 'react';

import { getValue, setValue } from '../key-value-store';

// Saved once settled: color pickers report every hue on their way
const saveDelay = 300;

// Updater of the list: merges `changes` into the item `id`
export const updateItem = (id, changes) => items => items.map(
  item => (item.id === id ? { ...item, ...changes } : item),
);

// A list of `{ id, … }` kept in IndexedDB under `storeKey`: tracks and
// squadrats exports weigh several MB, beyond what localStorage holds.
// Without IndexedDB (some private modes), the list lasts for the session only.
// Returns `[items, setItems, isLoaded]`.
const useStoredList = storeKey => {
  const [items, setItems] = React.useState([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(
    () => {
      let isCancelled = false;
      getValue(storeKey)
        .then(stored => {
          // Items added while loading come after the stored ones. A rerun of
          // the effect (Fast Refresh) finds them loaded already
          if (!isCancelled && stored) {
            setItems(previous => [
              ...stored,
              ...previous.filter(({ id }) => !stored.some(item => item.id === id)),
            ]);
          }
        })
        // eslint-disable-next-line no-console
        .catch(error => console.error(error))
        .finally(() => { if (!isCancelled) { setIsLoaded(true); } });

      return () => { isCancelled = true; };
    },
    [storeKey],
  );

  React.useEffect(
    () => {
      if (!isLoaded) { return undefined; }
      const timeout = setTimeout(
        () => setValue(storeKey, items)
          // eslint-disable-next-line no-console
          .catch(error => console.error(error)),
        saveDelay,
      );
      return () => clearTimeout(timeout);
    },
    [storeKey, items, isLoaded],
  );

  return [items, setItems, isLoaded];
};

export default useStoredList;
