import React from 'react';
import {
  Box,
  CircularProgress,
  Fab,
  GlobalStyles,
  IconButton,
  Paper,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Add,
  Clear,
  Edit,
  ErrorOutline,
  MoreVert,
  Upload,
} from '@mui/icons-material';
import togeojson from '@mapbox/togeojson';
import { DOMParser } from 'xmldom';
import useLocalStorageState from 'use-local-storage-state';

import MainMap from './MainMap';
import ShareDialog from './ShareDialog';
import useActivities, { getPersonByShare } from '../hooks/use-activities';
import useShareAccounts, { getAccountName } from '../hooks/use-share-accounts';
import useShares, { isShareActive } from '../hooks/use-shares';
import {
  countColors,
  getFirstShareByShare,
  getShareColor,
  pickShareColor,
  sharedColors,
} from '../share-colors';

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
const sharedSwatchBackground = count => (count > 2
  ? `linear-gradient(to right, ${sharedColors.fewest}, ${sharedColors.all})`
  : sharedColors.all);

// The same person can have several shares: the id tells them apart
const ShareName = ({ id, alias, account }) => {
  const name = alias || getAccountName(account);
  if (!name) { return id; }

  return (
    <>
      {name}
      {' '}
      <Box component="small" sx={{ color: 'text.secondary' }}>{id}</Box>
    </>
  );
};

const Home = () => {
  const [routes, setRoutes] = React.useState([]);
  const [shares, setShares] = useShares();
  const [colorMode, setColorMode] = useLocalStorageState('colorMode', { defaultValue: 'count' });
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  // The map context menu also opens from the panel, for touch screens
  const [contextMenuPosition, setContextMenuPosition] = React.useState();
  // Share edited in the dialog, none when adding one
  const [dialogShare, setDialogShare] = React.useState();

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
        colorByShare: Object.fromEntries(ids.map(id => [id, getShareColor(shares, ids, firstShares[id])])),
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

  const handleUpload = React.useCallback(
    event => {
      const { files } = event.target;

      // eslint-disable-next-line no-restricted-syntax
      for (const file of files) {
        // console.log(file);
        const reader = new FileReader();
        reader.onload = evnt => {
          try {
            const sourceData = file.type === 'application/gpx+xml'
              ? togeojson.gpx(new DOMParser().parseFromString(evnt.target.result))
              : JSON.parse(evnt.target.result);

            setRoutes(prevRoutes => [...prevRoutes, sourceData]);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
          }
        };
        reader.readAsText(file);
      }
    },
    [],
  );

  const handleShareClick = React.useCallback(
    ({ target: { id } = {} }, checked) => {
      setShares(prevShares => ({
        ...prevShares,
        [id]: { ...prevShares[id], disabled: !checked },
      }));
    },
    [setShares],
  );

  const openShareDialog = share => {
    setDialogShare(share);
    setIsDialogOpen(true);
  };

  const handleShareSubmit = React.useCallback(
    ({ id, alias }) => {
      setShares(prevShares => {
        const share = prevShares[id]
          ?? { disabled: false, color: pickShareColor(Object.values(colorByShare)) };
        // Emptied when editing, the alias falls back to the Statshunters name;
        // adding an existing share again keeps it
        const newAlias = alias || (dialogShare ? undefined : share.alias);
        return { ...prevShares, [id]: { ...share, alias: newAlias } };
      });
      setIsDialogOpen(false);
    },
    [setShares, dialogShare, colorByShare],
  );

  // The color belongs to the person: it is stored on their first share
  const handleColorChange = React.useCallback(
    (id, color) => {
      const firstShare = firstShareByShare[id];
      setShares(prevShares => ({ ...prevShares, [firstShare]: { ...prevShares[firstShare], color } }));
    },
    [setShares, firstShareByShare],
  );

  return (
    <>
      <GlobalStyles styles={globalStyles} />
      <Box sx={wrapperSx}>
        <MainMap
          routes={routes}
          colorMode={colorMode}
          colorByShare={colorByShare}
          activePersonCount={activePersonCount}
          labelByShare={labelByShare}
          contextMenuPosition={contextMenuPosition}
          onContextMenuPositionChange={setContextMenuPosition}
        />
        <Stack
          spacing={1}
          sx={{ position: 'absolute', left: '1rem', top: '1rem' }}
        >
          <Paper sx={{ p: 1 }}>
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
            </Stack>

            {/* Controls are siblings of the label, which only holds the name:
                nested in it, they would leak into the switch accessible name */}
            <Stack sx={{ mb: 1 }}>
              {Object.entries(shares).map(([id, { disabled, alias }], index) => (
                <Stack key={id} direction="row" alignItems="center">
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
                      aria-label={`Couleur de ${id}`}
                      onChange={event => handleColorChange(id, event.target.value)}
                      sx={colorInputSx}
                    />
                  )}
                  <Box component="label" htmlFor={id} sx={{ cursor: 'pointer' }}>
                    <ShareName id={id} alias={alias} account={shareAccounts[index]?.data} />
                  </Box>
                  <IconButton
                    size="small"
                    title="Modifier le nom affiché"
                    aria-label={`Modifier ${id}`}
                    onClick={() => openShareDialog({
                      id,
                      alias,
                      accountName: getAccountName(shareAccounts[index]?.data),
                    })}
                    sx={{ ml: 0.5, color: 'text.disabled' }}
                  >
                    <Edit sx={{ fontSize: 14 }} />
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
            </Stack>

            <IconButton
              size="small"
              title="Ajouter un compte"
              aria-label="Ajouter un compte"
              onClick={() => openShareDialog()}
              sx={{ mb: 1 }}
            >
              <Add fontSize="small" />
            </IconButton>

            {colorMode === 'count' && activePersonCount > 0 && (
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

          <ShareDialog
            open={isDialogOpen}
            share={dialogShare}
            onClose={() => setIsDialogOpen(false)}
            onSubmit={handleShareSubmit}
          />

          <Fab
            color="primary"
            size="small"
          >
            <Upload />
            <Box
              component="label"
              htmlFor="upload"
              sx={{ position: 'absolute', inset: 0 }}
            />
            <Box
              component="input"
              multiple
              accept=".geojson,.json,application/json,application/geojson,.gpx"
              type="file"
              id="upload"
              sx={{ opacity: 0, position: 'absolute' }}
              onChange={handleUpload}
            />
          </Fab>

          <Fab
            color="primary"
            size="small"
            onClick={() => setRoutes([])}
          >
            <Clear />
          </Fab>
        </Stack>
      </Box>
    </>
  );
};

export default Home;
