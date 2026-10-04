import React from 'react';
import {
  Box,
  Fab,
  FormControlLabel,
  FormGroup,
  GlobalStyles,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Clear, Upload } from '@mui/icons-material';
import togeojson from '@mapbox/togeojson';
import { DOMParser } from 'xmldom';
import useLocalStorageState from 'use-local-storage-state';

import MainMap from './MainMap';
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
const sharedSwatchBackground = count => (count > 2
  ? `linear-gradient(to right, ${sharedColors.fewest}, ${sharedColors.all})`
  : sharedColors.all);

const Home = () => {
  const [routes, setRoutes] = React.useState([]);
  const [shares, setShares] = useShares();
  const [colorMode, setColorMode] = useLocalStorageState('colorMode', { defaultValue: 'count' });

  const shareIdList = Object.keys(shares);
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

      const id = newShare.split('/').filter(Boolean).pop();
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
              {Object.entries(shares).map(([id, { disabled, alias }]) => (
                <FormControlLabel
                  label={(
                    <>
                      {colorMode === 'owner' && (
                        <Box
                          component="span"
                          sx={{ ...swatchSx, mr: 1, bgcolor: getShareColor(shareIdList, id) }}
                        />
                      )}
                      {alias ? (<>{alias} <small>({id})</small></>) : id}
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
