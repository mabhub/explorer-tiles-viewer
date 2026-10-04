import React from 'react';
import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import { Check, ChevronRight, Layers } from '@mui/icons-material';

import basemaps from '../basemaps';

const submenuOrigins = {
  anchorOrigin: { vertical: 'top', horizontal: 'right' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
};

// Opened by a right click (or a long press) on the map
const MapContextMenu = ({
  position,
  onClose,
  basemapId,
  onBasemapChange,
}) => {
  const [basemapsAnchor, setBasemapsAnchor] = React.useState(null);

  const close = () => {
    setBasemapsAnchor(null);
    onClose();
  };

  return (
    <>
      <Menu
        open={Boolean(position)}
        onClose={close}
        anchorReference="anchorPosition"
        anchorPosition={position && { top: position.y, left: position.x }}
      >
        <MenuItem onClick={event => setBasemapsAnchor(event.currentTarget)}>
          <ListItemIcon><Layers fontSize="small" /></ListItemIcon>
          <ListItemText>Fond de carte</ListItemText>
          <ChevronRight fontSize="small" sx={{ ml: 2 }} />
        </MenuItem>
      </Menu>

      <Menu
        open={Boolean(basemapsAnchor)}
        anchorEl={basemapsAnchor}
        onClose={() => setBasemapsAnchor(null)}
        {...submenuOrigins}
      >
        {basemaps.map(({ id, label }) => (
          <MenuItem
            key={id}
            selected={id === basemapId}
            onClick={() => {
              onBasemapChange(id);
              close();
            }}
          >
            <ListItemIcon>{id === basemapId && <Check fontSize="small" />}</ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default MapContextMenu;
