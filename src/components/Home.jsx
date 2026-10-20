import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Fab,
  GlobalStyles,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  ChevronLeft,
  ErrorOutline,
  MoreVert,
  People,
  Timeline,
} from '@mui/icons-material';
import { useMap } from '@vis.gl/react-maplibre';
import useLocalStorageState from 'use-local-storage-state';

import LoadingStatus from './LoadingStatus';
import MainMap from './MainMap';
import ShareContextMenu from './ShareContextMenu';
import RenameDialog from './RenameDialog';
import { SortableGroup, SortableRow, reorderItems } from './SortableGroup';
import ShareDialog from './ShareDialog';
import SquadratsContextMenu from './SquadratsContextMenu';
import SquadratsDialog from './SquadratsDialog';
import TrackContextMenu from './TrackContextMenu';
import useActivities, { getPersonByShare } from '../hooks/use-activities';
import useActivityLines, { linesEndpoint } from '../hooks/use-activity-lines';
import useShareAccounts, { getAccountName } from '../hooks/use-share-accounts';
import useShares, { isShareActive } from '../hooks/use-shares';
import useSquadratsRefresh from '../hooks/use-squadrats-refresh';
import useStoredList, { updateItem } from '../hooks/use-stored-list';
import {
  activityColors,
  activityThresholds,
  ageColors,
  compareColors,
  countColors,
  currentYear,
  getFirstShareByShare,
  getShareColor,
  pickShareColor,
  sharedColors,
} from '../share-colors';
import { formatExportDate, getSquadratinhosRings } from '../squadrats';
import { compareTiles, getComparedEntry, getComparedPerson } from '../squadrats-compare';
import { getTrackBounds, parseTrack } from '../tracks';
import { getLinesGeojson } from '../activity-lines';

const globalStyles = { 'html, body, #root': { height: '100%' } };
const wrapperSx = { height: '100%' };
// Same opacity as the grid fill, so legend colors look like the map ones
const swatchSx = {
  display: 'inline-block',
  width: 12,
  height: 12,
  borderRadius: '50%',
  opacity: 0.5,
  verticalAlign: 'middle',
};
// A native color picker shaped like the swatch
const colorInputSx = {
  ...swatchSx,
  mr: 1,
  p: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  appearance: 'none',
  '&::-webkit-color-swatch-wrapper': { p: 0 },
  '&::-webkit-color-swatch': { border: 'none', borderRadius: '50%' },
  '&::-moz-color-swatch': { border: 'none', borderRadius: '50%' },
};
// "1", "2–4", …, "100 et +"
const activityLabels = activityThresholds.map((threshold, index) => {
  const next = activityThresholds[index + 1];
  if (!next) { return `${threshold} et +`; }
  return next - 1 > threshold ? `${threshold}–${next - 1}` : `${threshold}`;
});
const sharedSwatchBackground = count => (count > 2
  ? `linear-gradient(to right, ${sharedColors.fewest}, ${sharedColors.all})`
  : sharedColors.all);

// The same person can have several shares: the id tells them apart, unless
// hidden. Without a name, the id is all there is to show.
const ShareName = ({
  id,
  alias,
  account,
  hideId,
}) => {
  const name = alias || getAccountName(account);
  if (!name) { return id; }
  if (hideId) { return name; }

  return (
    <>
      {name}
      {' '}
      <Box component="small" sx={{ color: 'text.secondary' }}>{id}</Box>
    </>
  );
};

// Track names can be long activity names
const layerNameSx = {
  cursor: 'pointer',
  maxWidth: 240,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// Status of a squadrats export once its refresh failed
const statusTitles = {
  error:    'Actualisation impossible : réessayer depuis le menu',
  outdated: 'Données plus récentes sur squadrats.com, sans export : réexporter puis actualiser, ou lire en direct',
};

// A track or a squadrats export in the panel. The menu opens at (x, y).
// `status`: 'loading', 'error' or 'outdated' while a squadrats export refreshes
const LayerRow = ({
  id,
  sortable,
  inputId,
  name,
  detail,
  status,
  color,
  enabled,
  actionsTitle,
  onToggle,
  onColorChange,
  onMenuOpen,
}) => (
  <SortableRow
    id={id}
    label={name}
    sortable={sortable}
    onContextMenu={event => {
      event.preventDefault();
      onMenuOpen(event.clientX, event.clientY);
    }}
  >
    <Switch
      size="small"
      inputProps={{ id: inputId }}
      checked={enabled}
      onChange={(event, checked) => onToggle(checked)}
    />
    <Box
      component="input"
      type="color"
      value={color}
      title="Changer la couleur"
      aria-label={`Couleur de ${name}`}
      onChange={event => onColorChange(event.target.value)}
      sx={colorInputSx}
    />
    <Box component="label" htmlFor={inputId} title={name} sx={layerNameSx}>
      {name}
    </Box>
    {detail && (
      <Box component="small" sx={{ color: 'text.secondary', ml: 1, whiteSpace: 'nowrap' }}>
        {detail}
      </Box>
    )}
    {status === 'loading' && (
      <CircularProgress size={12} title="Actualisation…" sx={{ ml: 1, flexShrink: 0 }} />
    )}
    {statusTitles[status] && (
      <ErrorOutline
        color="warning"
        titleAccess={statusTitles[status]}
        sx={{ ml: 1, fontSize: 16 }}
      />
    )}
    <IconButton
      size="small"
      title={actionsTitle}
      aria-label={`Actions de ${name}`}
      onClick={event => {
        const { left, bottom } = event.currentTarget.getBoundingClientRect();
        onMenuOpen(left, bottom);
      }}
      sx={{ ml: 0.5, color: 'text.disabled' }}
    >
      <MoreVert sx={{ fontSize: 16 }} />
    </IconButton>
  </SortableRow>
);

// Shows or hides the activity lines of an account, in the person color, grayed
// while the account is disabled. `query`: their loading, once asked for.
const LinesButton = ({
  name,
  shown,
  active,
  color,
  query,
  onToggle,
}) => {
  if (query?.isError && !query.isFetching) {
    return (
      <IconButton
        size="small"
        color="warning"
        title="Échec du chargement des activités, réessayer"
        aria-label={`Recharger les activités de ${name}`}
        onClick={() => query.refetch()}
      >
        <ErrorOutline sx={{ fontSize: 16 }} />
      </IconButton>
    );
  }
  return (
    <IconButton
      size="small"
      title={shown ? 'Masquer les activités' : 'Afficher les activités'}
      aria-label={`Activités de ${name}`}
      aria-pressed={shown}
      onClick={onToggle}
      sx={{ ml: 0.5, color: shown && active ? color : 'text.disabled' }}
    >
      {query?.isFetching
        ? <CircularProgress size={14} color="inherit" />
        : <Timeline sx={{ fontSize: 16 }} />}
    </IconButton>
  );
};

// Updater of a list of tracks or squadrats exports: turns the items `ids` on or off
const toggleItems = (ids, enabled) => items => items.map(
  item => (ids.includes(item.id) ? { ...item, disabled: !enabled } : item),
);

const colorModeTooltips = {
  count:      'Colore chaque tuile selon le nombre de personnes qui l\'ont visitée.',
  activities: 'Colore chaque tuile selon le nombre d\'activités qui l\'ont traversée.',
  owner:      'Colore chaque tuile de la couleur de la personne qui l\'a visitée, en gris si elles sont plusieurs.',
  age:        'Colore chaque tuile selon l\'année de sa dernière activité, de la plus récente (vive) à la plus ancienne (pâle).',
  compare:    'Compare les tuiles Statshunters d\'une personne à ses squadrats de squadrats.com : en commun, Statshunters seul ou squadrats seul.',
};

const compareLabels = {
  both:         'Les deux',
  statshunters: 'Statshunters seul',
  squadrats:    'Squadrats seul',
};
const noTiles = {};

// ToggleButtonGroup clones its children and reads their `value`: the tooltip
// goes inside
const ColorModeButton = React.forwardRef(({ tooltip, ...props }, ref) => (
  <Tooltip title={tooltip} describeChild>
    <ToggleButton ref={ref} {...props} />
  </Tooltip>
));

// Where the space key already acts: fields, controls, dialogs and menus
const spaceTargets = 'input, textarea, select, button, summary, [role=button], .MuiModal-root';

const Home = () => {
  const { main: map } = useMap();
  const [shares, setShares] = useShares();
  const [tracks, setTracks] = useStoredList('tracks');
  const [squadrats, setSquadrats, areSquadratsLoaded] = useStoredList('squadrats');
  const [squadratsStatuses, refreshSquadrats] = useSquadratsRefresh(
    squadrats,
    setSquadrats,
    areSquadratsLoaded,
  );
  // Shown as chosen, except the compare mode without a squadrats entry to compare
  const [storedColorMode, setColorMode] = useLocalStorageState('colorMode', { defaultValue: 'count' });
  // Variant of the count coloring mode: activities instead of people
  const [countActivities, setCountActivities] = useLocalStorageState('countActivities', { defaultValue: false });
  const [isPanelCollapsed, setIsPanelCollapsed] = useLocalStorageState('panelCollapsed', { defaultValue: false });
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  // The map context menu also opens from the panel, for touch screens
  const [contextMenuPosition, setContextMenuPosition] = React.useState();
  // ...and from the space key, in the middle of the window
  React.useEffect(
    () => {
      const handleKey = event => {
        const { target } = event;
        if (
          event.key !== ' '
          || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
          || target.isContentEditable
          || target.closest(spaceTargets)
        ) { return; }

        event.preventDefault();
        // Menu items run on key up: opened on key down, the menu would get
        // the key up on its first item
        if (event.type === 'keyup') {
          setContextMenuPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }
      };
      document.addEventListener('keydown', handleKey);
      document.addEventListener('keyup', handleKey);
      return () => {
        document.removeEventListener('keydown', handleKey);
        document.removeEventListener('keyup', handleKey);
      };
    },
    [],
  );
  // Share edited in the dialog, none when adding one
  const [dialogShare, setDialogShare] = React.useState();
  // Account whose context menu is open, and where: { id, x, y }
  const [shareMenu, setShareMenu] = React.useState();
  const [hideShareIds, setHideShareIds] = useLocalStorageState('hideShareIds', { defaultValue: false });
  // Track whose context menu is open, and where: { id, x, y }
  const [trackMenu, setTrackMenu] = React.useState();
  // Squadrats export whose context menu is open, and where: { id, x, y }
  const [squadratsMenu, setSquadratsMenu] = React.useState();
  const [isSquadratsDialogOpen, setIsSquadratsDialogOpen] = React.useState(false);
  // Track or squadrats export renamed in the dialog, kept while the dialog
  // fades out: { title, name, rename }
  const [renamed, setRenamed] = React.useState();
  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false);
  // Last deletion or color reset, undoable for a few seconds: { message, undo }.
  // Kept while the snackbar fades out.
  const [undoable, setUndoable] = React.useState();
  const [isUndoShown, setIsUndoShown] = React.useState(false);
  // Opened from the map context menu
  const trackInputRef = React.useRef();

  const shareIdList = Object.keys(shares);
  // Same queries as the map: React Query shares them, nothing is fetched twice
  const shareQueries = useActivities(shareIdList.join(','));
  const shareAccounts = useShareAccounts(shareIdList);

  // Several shares of the same person count as one owner
  const {
    personByShare,
    firstShareByShare,
    colorByShare,
    activePersonCount,
  } = React.useMemo(
    () => {
      const ids = Object.keys(shares);
      const personIds = getPersonByShare(ids, shareQueries);
      const activePeople = ids
        .filter(id => isShareActive(shares[id]) && personIds[id] !== undefined)
        .map(id => personIds[id]);

      const firstShares = getFirstShareByShare(ids, personIds);

      return {
        personByShare: personIds,
        firstShareByShare: firstShares,
        colorByShare: Object.fromEntries(
          ids.map(id => [id, getShareColor(shares, ids, firstShares[id])]),
        ),
        activePersonCount: new Set(activePeople).size,
      };
    },
    [shares, shareQueries],
  );

  // Displayed name of each person, the one of their first share
  const accountByShare = Object.fromEntries(
    shareIdList.map((id, index) => [id, shareAccounts[index]?.data]),
  );
  const getShareLabel = id => shares[id]?.alias || getAccountName(accountByShare[id]) || id;

  // Activity lines: offered only when the share link allows them (C1),
  // loaded only once shown, drawn only for active shares
  const canShowLines = id => Boolean(linesEndpoint && accountByShare[id]?.lines);
  const linesShareIds = shareIdList.filter(
    id => shares[id].showLines && isShareActive(shares[id]) && canShowLines(id),
  );
  const linesQueries = useActivityLines(linesShareIds.join(','));
  const linesQueryByShare = Object.fromEntries(
    linesShareIds.map((id, index) => [id, linesQueries[index]]),
  );
  // Kept apart from the colors: recoloring does not send the lines to the map again
  const linesGeojsonByShare = React.useMemo(
    () => Object.fromEntries(linesQueries
      .filter(({ data }) => data)
      .map(({ data: [id, lines] }) => [id, getLinesGeojson(lines)])),
    [linesQueries],
  );
  const labelByShare = Object.fromEntries(
    shareIdList.map(id => [id, getShareLabel(firstShareByShare[id])]),
  );

  // People of the active, loaded shares, in list order: { id, label, name }.
  // Only they can be compared: the others have no tile on the map.
  const people = [];
  shareIdList.forEach(id => {
    const personId = personByShare[id];
    if (personId === undefined || !isShareActive(shares[id])
      || people.some(person => person.id === personId)) { return; }
    people.push({
      id:    personId,
      label: labelByShare[id],
      name:  getAccountName(accountByShare[id]),
    });
  });

  const comparedEntry = getComparedEntry(squadrats, people);
  const comparedPerson = comparedEntry && getComparedPerson(comparedEntry, people);
  const colorMode = storedColorMode === 'compare' && !comparedEntry ? 'count' : storedColorMode;

  // Tiles of the person (their active shares) against the squadrats of the entry
  const comparison = React.useMemo(
    () => {
      if (colorMode !== 'compare') { return undefined; }
      const visitedKeys = new Set();
      shareIdList.forEach((id, index) => {
        if (personByShare[id] !== comparedPerson.id || !isShareActive(shares[id])) { return; }
        shareQueries[index]?.data?.[1]?.forEach(({ tiles }) => {
          tiles.forEach(({ x, y }) => visitedKeys.add(`14/${x}/${y}`));
        });
      });
      return compareTiles(visitedKeys, comparedEntry.squadratTiles);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colorMode, comparedPerson?.id, comparedEntry?.squadratTiles, shares, shareQueries],
  );

  const handleColorModeChange = React.useCallback(
    (event, mode) => {
      // An exclusive group reports null when the selected button is clicked again
      if (mode) { setColorMode(mode); }
    },
    [setColorMode],
  );

  // New shares, tracks and squadrats exports get a color far from the ones of
  // all of them
  const getUsedColors = (otherTracks, otherSquadrats) => [
    ...Object.values(colorByShare),
    ...[...otherTracks, ...otherSquadrats].map(({ color }) => color),
  ];

  const handleUpload = event => {
    const input = event.target;
    [...input.files].forEach(file => {
      file.text()
        .then(text => {
          const { name, lines } = parseTrack(text, file.name);
          if (!lines.length) { throw new Error(`No line to draw in ${file.name}`); }
          setTracks(prevTracks => [...prevTracks, {
            id: crypto.randomUUID(),
            name,
            color: pickShareColor(getUsedColors(prevTracks, squadrats)),
            disabled: false,
            lines,
          }]);
        })
        // eslint-disable-next-line no-console
        .catch(error => console.error(error));
    });
    // Lets the same file be added again
    input.value = '';
  };

  const handleTrackChange = (id, changes) => setTracks(updateItem(id, changes));

  // Tracks as listed in the panel, for the map context menu
  const trackItems = tracks.map(({ id, name, disabled }) => ({
    id,
    label: name,
    enabled: !disabled,
  }));

  const handleTracksToggle = (ids, enabled) => setTracks(toggleItems(ids, enabled));

  // An export of an account already listed replaces its data, the entry keeps
  // its name, color and state. An account is then brought up to date: the
  // link may be older than its latest export.
  const handleSquadratsAdd = ({
    accountId,
    accountName,
    name,
    timestamp,
    geojson,
  }) => {
    const listed = accountId && squadrats.find(entry => entry.accountId === accountId);
    const added = listed
      ? { ...listed, timestamp, geojson }
      : {
        id: crypto.randomUUID(),
        accountId,
        accountName,
        name,
        color: pickShareColor(getUsedColors(tracks, squadrats)),
        disabled: false,
        live: false,
        timestamp,
        geojson,
      };
    setSquadrats(prevSquadrats => (listed
      ? updateItem(listed.id, { timestamp, geojson })(prevSquadrats)
      : [...prevSquadrats, added]));
    setIsSquadratsDialogOpen(false);
    if (accountId) { refreshSquadrats(added); }
  };

  const handleSquadratsChange = (id, changes) => setSquadrats(updateItem(id, changes));

  // Choosing whom to compare an entry with shows the comparison
  const handleSquadratsCompare = (id, personId) => {
    handleSquadratsChange(id, { personId });
    setColorMode('compare');
  };

  // Squadrats exports as listed in the panel, for the map context menu
  const squadratsItems = squadrats.map(({
    id,
    name,
    disabled,
    live,
    timestamp,
  }) => ({
    id,
    label: name,
    detail: (live && 'en direct') || (timestamp ? formatExportDate(timestamp) : undefined),
    enabled: !disabled,
  }));

  const handleSquadratsToggle = (ids, enabled) => setSquadrats(toggleItems(ids, enabled));

  // Checked again either way: back to a local copy, the export may be older
  // than the tiles drawn
  const handleSquadratsLiveToggle = entry => {
    const live = !entry.live;
    handleSquadratsChange(entry.id, { live });
    refreshSquadrats({ ...entry, live });
  };

  const handleSharesToggle = React.useCallback(
    (ids, enabled) => {
      setShares(prevShares => ({
        ...prevShares,
        ...Object.fromEntries(ids.map(id => [id, { ...prevShares[id], disabled: !enabled }])),
      }));
    },
    [setShares],
  );

  const handleLinesToggle = (ids, shown) => {
    setShares(prevShares => ({
      ...prevShares,
      ...Object.fromEntries(ids.map(id => [
        id,
        { ...prevShares[id], showLines: shown || undefined },
      ])),
    }));
  };

  const handleShareClick = React.useCallback(
    ({ target: { id } = {} }, checked) => handleSharesToggle([id], checked),
    [handleSharesToggle],
  );

  // Accounts as listed in the panel, for the map context menu
  const shareItems = shareIdList.map((id, index) => {
    const name = shares[id].alias || getAccountName(shareAccounts[index]?.data);
    return {
      id,
      label: name || id,
      detail: name && !hideShareIds ? id : undefined,
      enabled: isShareActive(shares[id]),
    };
  });

  // Accounts whose link allows the lines, for the layers submenu
  const activityItems = shareItems
    .filter(({ id }) => canShowLines(id))
    .map(item => ({ ...item, enabled: Boolean(shares[item.id].showLines) }));

  // Same array between renders: the map content is memoized
  const activityLines = React.useMemo(
    () => Object.entries(linesGeojsonByShare).map(([id, geojson]) => ({
      id,
      geojson,
      color: colorByShare[id],
    })),
    [linesGeojsonByShare, colorByShare],
  );

  const openShareDialog = share => {
    setDialogShare(share);
    setIsDialogOpen(true);
  };

  const offerUndo = (message, undo) => {
    setUndoable({ message, undo });
    setIsUndoShown(true);
  };

  // Removes the share with its alias and color: until undone, the person
  // color moves to their next share, if any
  const handleShareDelete = id => {
    const previousShares = shares;
    offerUndo('Compte supprimé', () => setShares(previousShares));
    setShares(({ [id]: deleted, ...prevShares }) => prevShares);
  };

  const handleTrackDelete = id => {
    const previousTracks = tracks;
    offerUndo('Trace supprimée', () => setTracks(previousTracks));
    setTracks(prevTracks => prevTracks.filter(track => track.id !== id));
  };

  const handleTrackFit = id => {
    const { lines } = tracks.find(track => track.id === id);
    map?.fitBounds(getTrackBounds(lines), { padding: 60, maxZoom: 15 });
  };

  const handleSquadratsDelete = id => {
    const previousSquadrats = squadrats;
    offerUndo('Squadrats supprimés', () => setSquadrats(previousSquadrats));
    setSquadrats(prevSquadrats => prevSquadrats.filter(entry => entry.id !== id));
  };

  const handleSquadratsFit = id => {
    const { geojson } = squadrats.find(entry => entry.id === id);
    map?.fitBounds(getTrackBounds(getSquadratinhosRings(geojson)), { padding: 60, maxZoom: 15 });
  };

  const openRenameDialog = (title, name, rename) => {
    setRenamed({ title, name, rename });
    setIsRenameDialogOpen(true);
  };

  // Back to the palette, by position in the list
  const handleColorsReset = () => {
    const previousShares = shares;
    offerUndo('Couleurs réinitialisées', () => setShares(previousShares));
    setShares(prevShares => Object.fromEntries(
      Object.entries(prevShares).map(([id, { color, ...share }]) => [id, share]),
    ));
  };

  const handleShareSubmit = ({ id, alias }) => {
    setShares(prevShares => {
      const share = prevShares[id]
        ?? { disabled: false, color: pickShareColor(getUsedColors(tracks, squadrats)) };
      // Emptied when editing, the alias falls back to the Statshunters name;
      // adding an existing share again keeps it
      const newAlias = alias || (dialogShare ? undefined : share.alias);
      return { ...prevShares, [id]: { ...share, alias: newAlias } };
    });
    setIsDialogOpen(false);
  };

  // The color belongs to the person: it is stored on their first share
  const handleColorChange = React.useCallback(
    (id, color) => {
      const firstShare = firstShareByShare[id];
      setShares(prevShares => ({
        ...prevShares,
        [firstShare]: { ...prevShares[firstShare], color },
      }));
    },
    [setShares, firstShareByShare],
  );

  // Names of the rows, for the screen reader announcements while reordering
  const labelByShareId = Object.fromEntries(shareIdList.map(id => [id, getShareLabel(id)]));
  const trackIds = tracks.map(({ id }) => id);
  const trackLabels = Object.fromEntries(tracks.map(({ id, name }) => [id, name]));
  const squadratsIds = squadratsItems.map(({ id }) => id);
  const squadratsLabels = Object.fromEntries(squadratsItems.map(({ id, label }) => [id, label]));

  // Palette colors go by position: each person keeps the color shown so far,
  // stored on their first share in the new order
  const handleSharesReorder = ids => {
    const firstShares = getFirstShareByShare(ids, personByShare);
    setShares(prevShares => Object.fromEntries([
      ...ids.filter(id => prevShares[id]).map(id => [
        id,
        firstShares[id] === id ? { ...prevShares[id], color: colorByShare[id] } : prevShares[id],
      ]),
      ...Object.entries(prevShares).filter(([id]) => !ids.includes(id)),
    ]));
  };
  const handleTracksReorder = ids => setTracks(reorderItems(ids));
  const handleSquadratsReorder = ids => setSquadrats(reorderItems(ids));

  return (
    <>
      <GlobalStyles styles={globalStyles} />
      <Box sx={wrapperSx}>
        <MainMap
          tracks={tracks}
          squadrats={squadrats}
          activityLines={activityLines}
          colorMode={colorMode}
          compareKindByTile={comparison?.kindByTile ?? noTiles}
          countActivities={countActivities}
          onCountActivitiesToggle={() => setCountActivities(previous => !previous)}
          colorByShare={colorByShare}
          activePersonCount={activePersonCount}
          labelByShare={labelByShare}
          contextMenuPosition={contextMenuPosition}
          onContextMenuPositionChange={setContextMenuPosition}
          onShareAdd={() => openShareDialog()}
          shareItems={shareItems}
          onSharesToggle={handleSharesToggle}
          activityItems={activityItems}
          onActivitiesToggle={handleLinesToggle}
          onTrackAdd={() => trackInputRef.current.click()}
          trackItems={trackItems}
          onTracksToggle={handleTracksToggle}
          onSquadratsAdd={() => setIsSquadratsDialogOpen(true)}
          squadratsItems={squadratsItems}
          onSquadratsToggle={handleSquadratsToggle}
        />
        <LoadingStatus items={shareItems} queries={shareQueries} raised={isUndoShown} />
        <input
          ref={trackInputRef}
          type="file"
          multiple
          accept=".gpx,.geojson,.json,application/gpx+xml,application/geo+json,application/json"
          hidden
          onChange={handleUpload}
        />
        <Stack
          spacing={1}
          sx={{
            position: 'absolute',
            left: '1rem',
            top: '1rem',
            maxWidth: 'calc(100% - 2rem)',
            // The empty area between and around the controls lets the map
            // get drags and right clicks. pointer-events is inherited: the
            // controls take them back.
            pointerEvents: 'none',
            '& > *': { pointerEvents: 'auto' },
          }}
        >
          {isPanelCollapsed && (
            <Fab
              size="small"
              title="Afficher les comptes"
              aria-label="Afficher les comptes"
              onClick={() => setIsPanelCollapsed(false)}
            >
              <People />
            </Fab>
          )}

          <Paper sx={{ p: 1, display: isPanelCollapsed ? 'none' : undefined }}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
              <ToggleButtonGroup
                value={colorMode}
                exclusive
                fullWidth
                size="small"
                onChange={handleColorModeChange}
              >
                <ColorModeButton
                  value="count"
                  tooltip={colorModeTooltips[countActivities ? 'activities' : 'count']}
                >
                  Nombre
                </ColorModeButton>
                <ColorModeButton value="owner" tooltip={colorModeTooltips.owner}>Compte</ColorModeButton>
                <ColorModeButton value="age" tooltip={colorModeTooltips.age}>Âge</ColorModeButton>
                {comparedEntry && (
                  <ColorModeButton value="compare" tooltip={colorModeTooltips.compare}>Écarts</ColorModeButton>
                )}
              </ToggleButtonGroup>
              <IconButton
                size="small"
                title="Options de la carte"
                aria-label="Options de la carte"
                onClick={event => {
                  const { left, bottom } = event.currentTarget.getBoundingClientRect();
                  setContextMenuPosition({ x: left, y: bottom });
                }}
              >
                <MoreVert fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                title="Replier le panneau"
                aria-label="Replier le panneau"
                onClick={() => setIsPanelCollapsed(true)}
              >
                <ChevronLeft fontSize="small" />
              </IconButton>
            </Stack>

            {/* Controls are siblings of the label, which only holds the name:
                nested in it, they would leak into the switch accessible name */}
            <Stack sx={{ mb: 1 }}>
              <SortableGroup
                ids={shareIdList}
                labels={labelByShareId}
                onReorder={handleSharesReorder}
              >
                {Object.entries(shares).map(([id, { disabled, alias }], index) => (
                  <SortableRow
                    key={id}
                    id={id}
                    label={labelByShareId[id]}
                    sortable={shareIdList.length > 1}
                    onContextMenu={event => {
                      event.preventDefault();
                      setShareMenu({ id, x: event.clientX, y: event.clientY });
                    }}
                  >
                    <Switch
                      size="small"
                      inputProps={{ id }}
                      checked={disabled !== true}
                      onChange={handleShareClick}
                    />
                    {colorMode === 'owner' && (
                      <Box
                        component="input"
                        type="color"
                        value={colorByShare[id]}
                        title="Changer la couleur"
                        aria-label={`Couleur de ${getShareLabel(id)}`}
                        onChange={event => handleColorChange(id, event.target.value)}
                        sx={colorInputSx}
                      />
                    )}
                    <Box component="label" htmlFor={id} sx={{ cursor: 'pointer' }}>
                      <ShareName
                        id={id}
                        alias={alias}
                        account={shareAccounts[index]?.data}
                        hideId={hideShareIds}
                      />
                    </Box>
                    {canShowLines(id) && (
                      <LinesButton
                        name={getShareLabel(id)}
                        shown={Boolean(shares[id].showLines)}
                        active={isShareActive(shares[id])}
                        color={colorByShare[id]}
                        query={linesQueryByShare[id]}
                        onToggle={() => handleLinesToggle([id], !shares[id].showLines)}
                      />
                    )}
                    <IconButton
                      size="small"
                      title="Actions du compte"
                      aria-label={`Actions de ${getShareLabel(id)}`}
                      onClick={event => {
                        const { left, bottom } = event.currentTarget.getBoundingClientRect();
                        setShareMenu({ id, x: left, y: bottom });
                      }}
                      sx={{ ml: 0.5, color: 'text.disabled' }}
                    >
                      <MoreVert sx={{ fontSize: 16 }} />
                    </IconButton>
                    {shareQueries[index]?.isFetching && (
                      <CircularProgress size={12} sx={{ ml: 1 }} />
                    )}
                    {shareQueries[index]?.isError && !shareQueries[index].isFetching && (
                      <IconButton
                        size="small"
                        color="error"
                        title={shareQueries[index].isComplete
                          ? 'Échec de la mise à jour, réessayer'
                          : 'Échec du chargement, réessayer'}
                        onClick={() => shareQueries[index].refetch()}
                      >
                        <ErrorOutline fontSize="inherit" />
                      </IconButton>
                    )}
                  </SortableRow>
                ))}
              </SortableGroup>
              {!shareIdList.length && (
                <Box component="small" sx={{ color: 'text.secondary', pl: 1 }}>
                  Aucun compte : menu ⋮ puis « Ajouter un compte… »
                </Box>
              )}
            </Stack>

            {tracks.length > 0 && (
              <Stack sx={{ mb: 1 }}>
                <Box component="small" sx={{ color: 'text.secondary', pl: 1 }}>Traces</Box>
                <SortableGroup ids={trackIds} labels={trackLabels} onReorder={handleTracksReorder}>
                  {tracks.map(({
                    id,
                    name,
                    color,
                    disabled,
                  }) => (
                    <LayerRow
                      key={id}
                      id={id}
                      sortable={tracks.length > 1}
                      inputId={`track-${id}`}
                      name={name}
                      color={color}
                      enabled={!disabled}
                      actionsTitle="Actions de la trace"
                      onToggle={checked => handleTracksToggle([id], checked)}
                      onColorChange={value => handleTrackChange(id, { color: value })}
                      onMenuOpen={(x, y) => setTrackMenu({ id, x, y })}
                    />
                  ))}
                </SortableGroup>
              </Stack>
            )}

            {squadrats.length > 0 && (
              <Stack sx={{ mb: 1 }}>
                <Box component="small" sx={{ color: 'text.secondary', pl: 1 }}>Squadrats</Box>
                <SortableGroup
                  ids={squadratsIds}
                  labels={squadratsLabels}
                  onReorder={handleSquadratsReorder}
                >
                  {squadratsItems.map(({ id, label, detail }, index) => (
                    <LayerRow
                      key={id}
                      id={id}
                      sortable={squadrats.length > 1}
                      inputId={`squadrats-${id}`}
                      name={label}
                      detail={detail}
                      status={squadratsStatuses[id]}
                      color={squadrats[index].color}
                      enabled={!squadrats[index].disabled}
                      actionsTitle="Actions des squadrats"
                      onToggle={checked => handleSquadratsToggle([id], checked)}
                      onColorChange={value => handleSquadratsChange(id, { color: value })}
                      onMenuOpen={(x, y) => setSquadratsMenu({ id, x, y })}
                    />
                  ))}
                </SortableGroup>
              </Stack>
            )}

            {colorMode === 'count' && !countActivities && activePersonCount > 0 && (
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1, pl: 1 }}>
                <small>Possédé par</small>
                {countColors.map((color, index) => (
                  <Stack key={color} direction="row" alignItems="center" spacing={0.5}>
                    <Box component="span" sx={{ ...swatchSx, bgcolor: color }} />
                    <small>{index < countColors.length - 1 ? index + 1 : `${index + 1} et +`}</small>
                  </Stack>
                ))}
              </Stack>
            )}

            {colorMode === 'count' && countActivities && activePersonCount > 0 && (
              <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ mb: 1, pl: 1, columnGap: 1.5 }}>
                <small>Activités</small>
                {activityColors.map((color, index) => (
                  <Stack key={color} direction="row" alignItems="center" spacing={0.5}>
                    <Box component="span" sx={{ ...swatchSx, bgcolor: color }} />
                    <small>{activityLabels[index]}</small>
                  </Stack>
                ))}
              </Stack>
            )}

            {colorMode === 'age' && activePersonCount > 0 && (
              <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ mb: 1, pl: 1, columnGap: 1.5 }}>
                <small>Dernier passage</small>
                {ageColors.map((color, index) => (
                  <Stack key={color} direction="row" alignItems="center" spacing={0.5}>
                    <Box component="span" sx={{ ...swatchSx, bgcolor: color }} />
                    <small>
                      {index < ageColors.length - 1 ? currentYear - index : `≤ ${currentYear - index}`}
                    </small>
                  </Stack>
                ))}
              </Stack>
            )}

            {comparison && (
              <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ mb: 1, pl: 1, columnGap: 1.5 }}>
                <small>
                  {comparedEntry.name === comparedPerson.label
                    ? comparedPerson.label
                    : `${comparedPerson.label} / ${comparedEntry.name}`}
                </small>
                {Object.entries(compareLabels).map(([kind, label]) => (
                  <Stack key={kind} direction="row" alignItems="center" spacing={0.5}>
                    <Box component="span" sx={{ ...swatchSx, bgcolor: compareColors[kind] }} />
                    <small>{`${label} ${comparison.counts[kind].toLocaleString('fr-FR')}`}</small>
                  </Stack>
                ))}
              </Stack>
            )}

            {colorMode === 'owner' && activePersonCount > 1 && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, pl: 1 }}>
                <small>Partagé par</small>
                {activePersonCount > 2 && <small>2</small>}
                <Box
                  component="span"
                  sx={{
                    ...swatchSx,
                    width: 48,
                    borderRadius: 1,
                    background: sharedSwatchBackground(activePersonCount),
                  }}
                />
                <small>{activePersonCount}</small>
              </Stack>
            )}
          </Paper>

          <ShareContextMenu
            shareId={shareMenu?.id}
            position={shareMenu}
            onClose={() => setShareMenu()}
            onEdit={() => openShareDialog({
              id: shareMenu.id,
              alias: shares[shareMenu.id]?.alias,
              accountName: getAccountName(accountByShare[shareMenu.id]),
            })}
            onDelete={() => handleShareDelete(shareMenu.id)}
            hideShareIds={hideShareIds}
            onHideShareIdsToggle={() => setHideShareIds(previous => !previous)}
            canResetColors={colorMode === 'owner'}
            onColorsReset={handleColorsReset}
            offersLines={Boolean(linesEndpoint)}
            canShowLines={Boolean(shareMenu) && canShowLines(shareMenu.id)}
            linesShown={Boolean(shareMenu && shares[shareMenu.id]?.showLines)}
            onLinesToggle={() => handleLinesToggle(
              [shareMenu.id],
              !shares[shareMenu.id]?.showLines,
            )}
          />

          <TrackContextMenu
            position={trackMenu}
            onClose={() => setTrackMenu()}
            onFit={() => handleTrackFit(trackMenu.id)}
            onRename={() => {
              const { id, name } = tracks.find(track => track.id === trackMenu.id);
              openRenameDialog('Renommer la trace', name, newName => handleTrackChange(id, { name: newName }));
            }}
            onDelete={() => handleTrackDelete(trackMenu.id)}
          />

          <SquadratsContextMenu
            position={squadratsMenu}
            entry={squadrats.find(entry => entry.id === squadratsMenu?.id)}
            onClose={() => setSquadratsMenu()}
            onFit={() => handleSquadratsFit(squadratsMenu.id)}
            onRefresh={refreshSquadrats}
            onLiveToggle={handleSquadratsLiveToggle}
            people={people}
            comparedPersonId={squadratsMenu && getComparedPerson(
              squadrats.find(entry => entry.id === squadratsMenu.id) ?? {},
              people,
            )?.id}
            onCompare={handleSquadratsCompare}
            onRename={() => {
              const { id, name } = squadrats.find(entry => entry.id === squadratsMenu.id);
              openRenameDialog('Renommer les squadrats', name, newName => handleSquadratsChange(id, { name: newName }));
            }}
            onDelete={() => handleSquadratsDelete(squadratsMenu.id)}
          />

          <RenameDialog
            open={isRenameDialogOpen}
            title={renamed?.title}
            name={renamed?.name}
            onClose={() => setIsRenameDialogOpen(false)}
            onSubmit={name => {
              renamed.rename(name);
              setIsRenameDialogOpen(false);
            }}
          />

          <SquadratsDialog
            open={isSquadratsDialogOpen}
            onClose={() => setIsSquadratsDialogOpen(false)}
            onAdd={handleSquadratsAdd}
          />

          <Snackbar
            open={isUndoShown}
            autoHideDuration={6000}
            onClose={(event, reason) => {
              // Map clicks would hide it before it can be undone
              if (reason !== 'clickaway') { setIsUndoShown(false); }
            }}
            TransitionProps={{ onExited: () => setUndoable() }}
            message={undoable?.message}
            action={(
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  undoable.undo();
                  setIsUndoShown(false);
                }}
              >
                Annuler
              </Button>
            )}
          />

          <ShareDialog
            open={isDialogOpen}
            share={dialogShare}
            onClose={() => setIsDialogOpen(false)}
            onSubmit={handleShareSubmit}
          />
        </Stack>
      </Box>
    </>
  );
};

export default Home;
