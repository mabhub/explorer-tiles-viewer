import React from 'react';
import { Box, Fab, GlobalStyles, Stack } from '@mui/material';
import { Clear, Upload } from '@mui/icons-material';

import MainMap from './MainMap';

const globalStyles = { 'html, body, #root': { height: '100%' } };
const wrapperSx = { height: '100%' };

const Home = () => {
  const [routes, setRoutes] = React.useState([]);

  const handleUpload = React.useCallback(
    event => {
      const { files } = event.target;

      // eslint-disable-next-line no-restricted-syntax
      for (const file of files) {
        // console.log(file);
        const reader = new FileReader();
        reader.onload = evnt => {
          try {
            const a = JSON.parse(evnt.target.result);
            setRoutes(prevRoutes => [...prevRoutes, a]);
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
  return (
    <>
      <GlobalStyles styles={globalStyles} />
      <Box sx={wrapperSx}>
        <MainMap routes={routes} />
        <Stack
          spacing={1}
          sx={{ position: 'absolute', left: '1rem', top: '1rem' }}
        >
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
              accept=".geojson,.json,application/json,application/geojson"
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
