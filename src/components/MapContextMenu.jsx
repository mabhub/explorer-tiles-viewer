import React from 'react';
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Check,
  CheckBox,
  CheckBoxOutlineBlank,
  ChevronRight,
  Layers,
  PersonAdd,
} from '@mui/icons-material';

import basemaps from '../basemaps';

const maxAreaLabels = {
  square: 'Max square',
  line: 'Max line',
  column: 'Max column',
};

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
  maxAreas,
  onMaxAreaToggle,
  canShowMaxAreas,
  showGrid,
  onGridToggle,
  countActivities,
  onCountActivitiesToggle,
  canCountActivities,
  onShareAdd,
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
        <MenuItem
          onClick={() => {
            close();
            onShareAdd();
          }}
        >
          <ListItemIcon><PersonAdd fontSize="small" /></ListItemIcon>
          <ListItemText>Ajouter un compte…</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={event => setBasemapsAnchor(event.currentTarget)}>
          <ListItemIcon><Layers fontSize="small" /></ListItemIcon>
          <ListItemText>Fond de carte</ListItemText>
          <ChevronRight fontSize="small" sx={{ ml: 2 }} />
        </MenuItem>
        <MenuItem role="menuitemcheckbox" aria-checked={showGrid} onClick={onGridToggle}>
          <ListItemIcon>
            {showGrid ? <CheckBox fontSize="small" /> : <CheckBoxOutlineBlank fontSize="small" />}
          </ListItemIcon>
          <ListItemText secondary="Masquée sous le zoom 10">Grille</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          role="menuitemcheckbox"
          aria-checked={countActivities}
          disabled={!canCountActivities}
          onClick={onCountActivitiesToggle}
        >
          <ListItemIcon>
            {countActivities ? <CheckBox fontSize="small" /> : <CheckBoxOutlineBlank fontSize="small" />}
          </ListItemIcon>
          <ListItemText secondary={canCountActivities ? undefined : 'Mode Nombre uniquement'}>
            Compter les activités
          </ListItemText>
        </MenuItem>
        {Object.entries(maxAreaLabels).map(([kind, label]) => (
          // Left open, to toggle several areas in a row
          <MenuItem
            key={kind}
            role="menuitemcheckbox"
            aria-checked={Boolean(maxAreas[kind])}
            disabled={!canShowMaxAreas}
            onClick={() => onMaxAreaToggle(kind)}
          >
            <ListItemIcon>
              {maxAreas[kind] ? <CheckBox fontSize="small" /> : <CheckBoxOutlineBlank fontSize="small" />}
            </ListItemIcon>
            <ListItemText secondary={canShowMaxAreas ? undefined : 'Mode Compte uniquement'}>
              {label}
            </ListItemText>
          </MenuItem>
        ))}
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
