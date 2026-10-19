import React from 'react';

import {
  fetchAccountName,
  fetchExport,
  fetchLatestTimestamp,
  fetchSquadratTiles,
} from '../squadrats';
import { updateItem } from './use-stored-list';

// Status of an entry, none once refreshed
const withStatus = (id, status) => ({ [id]: previous, ...others }) => (
  status ? { ...others, [id]: status } : others
);

// Keeps the squadrats exports of an account up to date: the timestamp of its
// latest computation (`latest`) is read once per page load, when added, when
// switched between live and local, and on demand. A local copy then downloads
// the new export, a live entry only draws the tiles of that timestamp. Both
// get the list of the squadrats of that timestamp, to compare with
// Statshunters, and the public name of the account, to find its person.
// Returns `[statuses, refresh]`, statuses being `{ [id]: 'loading' | 'error' }`.
const useSquadratsRefresh = (squadrats, setSquadrats, isLoaded) => {
  const [statuses, setStatuses] = React.useState({});

  const refresh = React.useCallback(
    async ({
      id,
      accountId,
      live,
      timestamp,
      latest: knownLatest,
      squadratTilesTimestamp,
      accountName,
    }) => {
      const update = changes => setSquadrats(updateItem(id, changes));
      setStatuses(withStatus(id, 'loading'));
      try {
        // Kept even if the export fails: live tiles still follow it. Unchanged,
        // the list is not saved again with its exports
        const latest = await fetchLatestTimestamp(accountId);
        if (latest !== knownLatest) { update({ latest }); }
        // Each one is kept, whether the others fail or not
        const downloads = [
          !live && latest > timestamp && (async () => update({
            timestamp: latest,
            geojson:   await fetchExport(accountId, latest),
          })),
          latest !== squadratTilesTimestamp && (async () => update({
            squadratTiles:          await fetchSquadratTiles(accountId),
            squadratTilesTimestamp: latest,
          })),
          accountName === undefined && (async () => update({
            accountName: await fetchAccountName(accountId),
          })),
        ].filter(Boolean);
        const failure = (await Promise.allSettled(downloads.map(download => download())))
          .find(({ status }) => status === 'rejected');
        if (failure) { throw failure.reason; }
        setStatuses(withStatus(id));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        setStatuses(withStatus(id, 'error'));
      }
    },
    [setSquadrats],
  );

  // Exports from a file have no account to refresh from
  const hasRefreshed = React.useRef(false);
  React.useEffect(
    () => {
      if (!isLoaded || hasRefreshed.current) { return; }
      hasRefreshed.current = true;
      squadrats.filter(({ accountId }) => accountId).forEach(refresh);
    },
    [isLoaded, squadrats, refresh],
  );

  return [statuses, refresh];
};

export default useSquadratsRefresh;
