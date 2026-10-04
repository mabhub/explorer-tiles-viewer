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
} from '@mui/material';
import {
  ChevronLeft,
  ErrorOutline,
  MoreVert,
  People,
} from '@mui/icons-material';
import { useMap } from 'react-map-gl/maplibre';
import useLocalStorageState from 'use-local-storage-state';

import MainMap from './MainMap';
import ShareContextMenu from './ShareContextMenu';
import ShareDialog from './ShareDialog';
import TrackContextMenu from './TrackContextMenu';
import TrackDialog from './TrackDialog';
import useActivities, { getPersonByShare } from '../hooks/use-activities';
import useShareAccounts, { getAccountName } from '../hooks/use-share-accounts';
import useShares, { isShareActive } from '../hooks/use-shares';
import useTracks from '../hooks/use-tracks';
import {
  activityColors,
  activityThresholds,
  ageColors,
  countColors,
  currentYear,
  getFirstShareByShare,
  getShareColor,
  pickShareColor,
  sharedColors,
} from '../share-colors';
import { getTrackBounds, parseTrack } from '../tracks';

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
const trackNameSx = {
  cursor: 'pointer',
  maxWidth: 240,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const Home = () => {
  const { main: map } = useMap();
  const [shares, setShares] = useShares();
  const [tracks, setTracks] = useTracks();
  const [colorMode, setColorMode] = useLocalStorageState('colorMode', { defaultValue: 'count' });
  // Variant of the count coloring mode: activities instead of people
  const [countActivities, setCountActivities] = useLocalStorageState('countActivities', { defaultValue: false });
  const [isPanelCollapsed, setIsPanelCollapsed] = useLocalStorageState('panelCollapsed', { defaultValue: false });
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  // The map context menu also opens from the panel, for touch screens
  const [contextMenuPosition, setContextMenuPosition] = React.useState();
  // Share edited in the dialog, none when adding one
  const [dialogShare, setDialogShare] = React.useState();
  // Account whose context menu is open, and where: { id, x, y }
  const [shareMenu, setShareMenu] = React.useState();
  const [hideShareIds, setHideShareIds] = useLocalStorageState('hideShareIds', { defaultValue: false });
  // Track whose context menu is open, and where: { id, x, y }
  const [trackMenu, setTrackMenu] = React.useState();
  // Track renamed in its dialog, kept while the dialog fades out
  const [dialogTrack, setDialogTrack] = React.useState();
  const [isTrackDialogOpen, setIsTrackDialogOpen] = React.useState(false);
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
  const { firstShareByShare, colorByShare, activePersonCount } = React.useMemo(
    () => {
      const ids = Object.keys(shares);
      const personByShare = getPersonByShare(ids, shareQueries);
      const activePeople = ids
        .filter(id => isShareActive(shares[id]) && personByShare[id] !== undefined)
        .map(id => personByShare[id]);

      const firstShares = getFirstShareByShare(ids, personByShare);

      return {
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
  const labelByShare = Object.fromEntries(
    shareIdList.map(id => [id, getShareLabel(firstShareByShare[id])]),
  );

  const handleColorModeChange = React.useCallback(
    (event, mode) => {
      // An exclusive group reports null when the selected button is clicked again
      if (mode) { setColorMode(mode); }
    },
    [setColorMode],
  );

  // New shares and tracks get a color far from the ones of both
  const getUsedColors = otherTracks => [
    ...Object.values(colorByShare),
    ...otherTracks.map(({ color }) => color),
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
            color: pickShareColor(getUsedColors(prevTracks)),
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

  const handleTrackChange = (id, changes) => {
    setTracks(prevTracks => prevTracks.map(
      track => (track.id === id ? { ...track, ...changes } : track),
    ));
  };

  // Tracks as listed in the panel, for the map context menu
  const trackItems = tracks.map(({ id, name, disabled }) => ({
    id,
    label: name,
    enabled: !disabled,
  }));

  const handleTracksToggle = (ids, enabled) => {
    setTracks(prevTracks => prevTracks.map(track => (ids.includes(track.id)
      ? { ...track, disabled: !enabled }
      : track)));
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
        ?? { disabled: false, color: pickShareColor(getUsedColors(tracks)) };
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

  return (
    <>
      <GlobalStyles styles={globalStyles} />
      <Box sx={wrapperSx}>
        <MainMap
          tracks={tracks}
          colorMode={colorMode}
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
          onTrackAdd={() => trackInputRef.current.click()}
          trackItems={trackItems}
          onTracksToggle={handleTracksToggle}
        />
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
                <ToggleButton value="count">Nombre</ToggleButton>
                <ToggleButton value="owner">Compte</ToggleButton>
                <ToggleButton value="age">Âge</ToggleButton>
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
              {Object.entries(shares).map(([id, { disabled, alias }], index) => (
                <Stack
                  key={id}
                  direction="row"
                  alignItems="center"
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
                  {shareQueries[index]?.isLoading && (
                    <CircularProgress size={12} sx={{ ml: 1 }} />
                  )}
                  {shareQueries[index]?.isError && (
                    <IconButton
                      size="small"
                      color="error"
                      title="Échec du chargement, réessayer"
                      onClick={() => shareQueries[index].refetch()}
                    >
                      <ErrorOutline fontSize="inherit" />
                    </IconButton>
                  )}
                </Stack>
              ))}
              {!shareIdList.length && (
                <Box component="small" sx={{ color: 'text.secondary', pl: 1 }}>
                  Aucun compte : menu ⋮ puis « Ajouter un compte… »
                </Box>
              )}
            </Stack>

            {tracks.length > 0 && (
              <Stack sx={{ mb: 1 }}>
                <Box component="small" sx={{ color: 'text.secondary', pl: 1 }}>Traces</Box>
                {tracks.map(({
                  id,
                  name,
                  color,
                  disabled,
                }) => (
                  <Stack
                    key={id}
                    direction="row"
                    alignItems="center"
                    onContextMenu={event => {
                      event.preventDefault();
                      setTrackMenu({ id, x: event.clientX, y: event.clientY });
                    }}
                  >
                    <Switch
                      size="small"
                      inputProps={{ id: `track-${id}` }}
                      checked={!disabled}
                      onChange={(event, checked) => handleTracksToggle([id], checked)}
                    />
                    <Box
                      component="input"
                      type="color"
                      value={color}
                      title="Changer la couleur"
                      aria-label={`Couleur de ${name}`}
                      onChange={event => handleTrackChange(id, { color: event.target.value })}
                      sx={colorInputSx}
                    />
                    <Box component="label" htmlFor={`track-${id}`} title={name} sx={trackNameSx}>
                      {name}
                    </Box>
                    <IconButton
                      size="small"
                      title="Actions de la trace"
                      aria-label={`Actions de ${name}`}
                      onClick={event => {
                        const { left, bottom } = event.currentTarget.getBoundingClientRect();
                        setTrackMenu({ id, x: left, y: bottom });
                      }}
                      sx={{ ml: 0.5, color: 'text.disabled' }}
                    >
                      <MoreVert sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Stack>
                ))}
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
          />

          <TrackContextMenu
            position={trackMenu}
            onClose={() => setTrackMenu()}
            onFit={() => handleTrackFit(trackMenu.id)}
            onRename={() => {
              setDialogTrack(tracks.find(track => track.id === trackMenu.id));
              setIsTrackDialogOpen(true);
            }}
            onDelete={() => handleTrackDelete(trackMenu.id)}
          />

          <TrackDialog
            open={isTrackDialogOpen}
            track={dialogTrack}
            onClose={() => setIsTrackDialogOpen(false)}
            onSubmit={name => {
              handleTrackChange(dialogTrack.id, { name });
              setIsTrackDialogOpen(false);
            }}
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
