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
  People,
  PersonAdd,
} from '@mui/icons-material';

import basemaps from '../basemaps';
import usePassThroughMenu from '../hooks/use-pass-through-menu';

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
  shareItems,
  onSharesToggle,
}) => {
  const [basemapsAnchor, setBasemapsAnchor] = React.useState(null);
  const [accountsAnchor, setAccountsAnchor] = React.useState(null);

  const close = () => {
    setBasemapsAnchor(null);
    setAccountsAnchor(null);
    onClose();
  };
  // Pressing a submenu leaves the menu open, the other way round closes it
  const menuProps = usePassThroughMenu({
    open: Boolean(position),
    onClose: close,
    name: 'map',
    inside: ['map', 'basemaps', 'accounts'],
  });
  const basemapsMenuProps = usePassThroughMenu({
    open: Boolean(basemapsAnchor),
    onClose: () => setBasemapsAnchor(null),
    name: 'basemaps',
  });
  const accountsMenuProps = usePassThroughMenu({
    open: Boolean(accountsAnchor),
    onClose: () => setAccountsAnchor(null),
    name: 'accounts',
  });

  const allShareIds = shareItems.map(({ id }) => id);

  return (
    <>
      <Menu
        {...menuProps}
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
        <MenuItem
          disabled={!shareItems.length}
          onClick={event => setAccountsAnchor(event.currentTarget)}
        >
          <ListItemIcon><People fontSize="small" /></ListItemIcon>
          <ListItemText>Comptes</ListItemText>
          <ChevronRight fontSize="small" sx={{ ml: 2 }} />
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
        {...basemapsMenuProps}
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

      {/* Left open, to toggle several accounts in a row */}
      <Menu
        {...accountsMenuProps}
        open={Boolean(accountsAnchor)}
        anchorEl={accountsAnchor}
        onClose={() => setAccountsAnchor(null)}
        {...submenuOrigins}
      >
        <MenuItem
          disabled={shareItems.every(({ enabled }) => enabled)}
          onClick={() => onSharesToggle(allShareIds, true)}
        >
          <ListItemText inset>Tout activer</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!shareItems.some(({ enabled }) => enabled)}
          onClick={() => onSharesToggle(allShareIds, false)}
        >
          <ListItemText inset>Tout désactiver</ListItemText>
        </MenuItem>
        <Divider />
        {shareItems.map(({
          id,
          label,
          detail,
          enabled,
        }) => (
          <MenuItem
            key={id}
            role="menuitemcheckbox"
            aria-checked={enabled}
            onClick={() => onSharesToggle([id], !enabled)}
          >
            <ListItemIcon>
              {enabled ? <CheckBox fontSize="small" /> : <CheckBoxOutlineBlank fontSize="small" />}
            </ListItemIcon>
            <ListItemText secondary={detail}>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default MapContextMenu;
