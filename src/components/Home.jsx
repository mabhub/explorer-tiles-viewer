import { Box, GlobalStyles } from '@mui/material';
import MainMap from './MainMap';

const globalStyles = { 'html, body, #root': { height: '100%' } };
const wrapperSx = { height: '100%' };

const Home = () => (
  <>
    <GlobalStyles styles={globalStyles} />
    <Box sx={wrapperSx}>
      <MainMap />
    </Box>
  </>
);

export default Home;
