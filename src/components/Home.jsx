import React from 'react';
import {
  Box,
  CircularProgress,
  Fab,
  FormControlLabel,
  FormGroup,
  GlobalStyles,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Clear, ErrorOutline, Upload } from '@mui/icons-material';
import togeojson from '@mapbox/togeojson';
import { DOMParser } from 'xmldom';
import useLocalStorageState from 'use-local-storage-state';

import MainMap from './MainMap';
import useActivities from '../hooks/use-activities';
import useShareAccounts from '../hooks/use-share-accounts';
import useShares, { isShareActive } from '../hooks/use-shares';
import { getShareColor, sharedColors } from '../share-colors';

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
// A share link, with or without trailing slash or query string, or a bare id
const shareIdPattern = /^(?:.*\/share\/)?(\w+)\/?(?:[?#].*)?$/;
const sharedSwatchBackground = count => (count > 2
  ? `linear-gradient(to right, ${sharedColors.fewest}, ${sharedColors.all})`
  : sharedColors.all);

// The same person can have several shares: the id tells them apart
const ShareName = ({ id, alias, account }) => {
  const name = alias || [account?.firstname, account?.lastname].filter(Boolean).join(' ');
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
  const [isShareInvalid, setIsShareInvalid] = React.useState(false);

  const shareIdList = Object.keys(shares);
  // Same queries as the map: React Query shares them, nothing is fetched twice
  const shareQueries = useActivities(shareIdList.join(','));
  const shareAccounts = useShareAccounts(shareIdList);
  const activeShareCount = Object.values(shares).filter(isShareActive).length;

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

  const handleShareSubmit = React.useCallback(
    event => {
      event.preventDefault();
      event.stopPropagation();

      const formData = new FormData(event.target);
      const { newShare } = Object.fromEntries(formData.entries());

      const [, id] = newShare.trim().match(shareIdPattern) || [];
      if (!id) {
        setIsShareInvalid(true);
        return;
      }

      setShares(prevShares => (prevShares[id]
        ? prevShares
        : { ...prevShares, [id]: { disabled: false } }));

      event.target.reset();
    },
    [setShares],
  );

  return (
    <>
      <GlobalStyles styles={globalStyles} />
      <Box sx={wrapperSx}>
        <MainMap routes={routes} colorMode={colorMode} />
        <Stack
          spacing={1}
          sx={{ position: 'absolute', left: '1rem', top: '1rem' }}
        >
          <Paper sx={{ p: 1 }}>
            <ToggleButtonGroup
              value={colorMode}
              exclusive
              fullWidth
              size="small"
              onChange={handleColorModeChange}
              sx={{ mb: 1 }}
            >
              <ToggleButton value="count">Nombre</ToggleButton>
              <ToggleButton value="owner">Compte</ToggleButton>
            </ToggleButtonGroup>

            <FormGroup sx={{ mb: 1, pl: 1 }}>
              {Object.entries(shares).map(([id, { disabled, alias }], index) => (
                <FormControlLabel
                  label={(
                    <>
                      {colorMode === 'owner' && (
                        <Box
                          component="span"
                          sx={{ ...swatchSx, mr: 1, bgcolor: getShareColor(shareIdList, id) }}
                        />
                      )}
                      <ShareName id={id} alias={alias} account={shareAccounts[index]?.data} />
                      {shareQueries[index]?.isLoading && (
                        <CircularProgress size={12} sx={{ ml: 1, verticalAlign: 'middle' }} />
                      )}
                      {shareQueries[index]?.isError && (
                        <IconButton
                          size="small"
                          color="error"
                          title="Échec du chargement, réessayer"
                          onClick={event => {
                            // Inside the label: do not toggle the share
                            event.preventDefault();
                            shareQueries[index].refetch();
                          }}
                        >
                          <ErrorOutline fontSize="inherit" />
                        </IconButton>
                      )}
                    </>
                  )}
                  key={id}
                  control={(
                    <Switch
                      size="small"
                      inputProps={{ id }}
                      checked={disabled !== true}
                      onChange={handleShareClick}
                    />
                  )}
                />
              ))}
            </FormGroup>

            {colorMode === 'owner' && activeShareCount > 1 && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, pl: 1 }}>
                <small>Partagé par</small>
                {activeShareCount > 2 && <small>2</small>}
                <Box
                  component="span"
                  sx={{
                    ...swatchSx,
                    width: 48,
                    borderRadius: 1,
                    background: sharedSwatchBackground(activeShareCount),
                  }}
                />
                <small>{activeShareCount}</small>
              </Stack>
            )}

            <form onSubmit={handleShareSubmit}>
              <TextField
                name="newShare"
                size="small"
                variant="filled"
                label="Ajouter une grille"
                placeholder="https://statshunters.com/share/abc…"
                error={isShareInvalid}
                helperText={isShareInvalid ? 'Lien de partage invalide' : undefined}
                onChange={() => setIsShareInvalid(false)}
              />
            </form>
          </Paper>

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
