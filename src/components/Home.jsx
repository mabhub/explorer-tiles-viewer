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
} from '@mui/material';
import { Clear, Upload } from '@mui/icons-material';
import createPersistedState from 'use-persisted-state/src';
import togeojson from '@mapbox/togeojson';
import { DOMParser } from 'xmldom';

import MainMap from './MainMap';

const useSharesState = createPersistedState('shares');

const globalStyles = { 'html, body, #root': { height: '100%' } };
const wrapperSx = { height: '100%' };

const Home = () => {
  const [routes, setRoutes] = React.useState([]);
  const [shares, setShares] = useSharesState({});

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
      setShares(prevShares => {
        const newShares = { ...prevShares };
        newShares[id].disabled = !checked;
        return newShares;
      });
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleShareSubmit = React.useCallback(
    event => {
      event.preventDefault();
      event.stopPropagation();

      const formData = new FormData(event.target);
      const { newShare } = Object.fromEntries(formData.entries());

      const id = newShare.split('/').filter(Boolean).pop();
      setShares(prevShares => {
        if (!prevShares[id]) {
          prevShares[id] = { disabled: false }; // eslint-disable-line no-param-reassign
        }
        return { ...prevShares };
      });

      event.target.reset();
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <>
      <GlobalStyles styles={globalStyles} />
      <Box sx={wrapperSx}>
        <MainMap routes={routes} />
        <Stack
          spacing={1}
          sx={{ position: 'absolute', left: '1rem', top: '1rem' }}
        >
          <Paper sx={{ p: 1 }}>
            <FormGroup sx={{ mb: 1, pl: 1 }}>
              {Object.entries(shares).map(([id, { disabled }]) => (
                <FormControlLabel
                  label={id}
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
