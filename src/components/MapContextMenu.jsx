import React from 'react';
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  AddRoad,
  Check,
  CheckBox,
  CheckBoxOutlineBlank,
  ChevronRight,
  GridView,
  Layers,
  Map as MapIcon,
  PersonAdd,
  Visibility,
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

const CheckItem = ({
  checked,
  secondary,
  children,
  ...props
}) => (
  <MenuItem role="menuitemcheckbox" aria-checked={checked} {...props}>
    <ListItemIcon>
      {checked ? <CheckBox fontSize="small" /> : <CheckBoxOutlineBlank fontSize="small" />}
    </ListItemIcon>
    <ListItemText secondary={secondary}>{children}</ListItemText>
  </MenuItem>
);

// An account, a track or a squadrats export in the layers submenu
const LayerItem = ({
  id,
  label,
  detail,
  enabled,
  onToggle,
}) => (
  <CheckItem checked={enabled} secondary={detail} onClick={() => onToggle([id], !enabled)}>
    {label}
  </CheckItem>
);

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
  onTrackAdd,
  shareItems,
  onSharesToggle,
  trackItems,
  onTracksToggle,
  onSquadratsAdd,
  squadratsItems,
  onSquadratsToggle,
}) => {
  const [basemapsAnchor, setBasemapsAnchor] = React.useState(null);
  const [layersAnchor, setLayersAnchor] = React.useState(null);
  const [displayAnchor, setDisplayAnchor] = React.useState(null);

  const close = () => {
    setBasemapsAnchor(null);
    setLayersAnchor(null);
    setDisplayAnchor(null);
    onClose();
  };
  // Pressing a submenu leaves the menu open, the other way round closes it
  const menuProps = usePassThroughMenu({
    open: Boolean(position),
    onClose: close,
    name: 'map',
    inside: ['map', 'basemaps', 'layers', 'display'],
  });
  const basemapsMenuProps = usePassThroughMenu({
    open: Boolean(basemapsAnchor),
    onClose: () => setBasemapsAnchor(null),
    name: 'basemaps',
  });
  const layersMenuProps = usePassThroughMenu({
    open: Boolean(layersAnchor),
    onClose: () => setLayersAnchor(null),
    name: 'layers',
  });
  const displayMenuProps = usePassThroughMenu({
    open: Boolean(displayAnchor),
    onClose: () => setDisplayAnchor(null),
    name: 'display',
  });

  const layerItems = [...shareItems, ...trackItems, ...squadratsItems];
  const toggleAll = enabled => {
    onSharesToggle(shareItems.map(({ id }) => id), enabled);
    onTracksToggle(trackItems.map(({ id }) => id), enabled);
    onSquadratsToggle(squadratsItems.map(({ id }) => id), enabled);
  };

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
          onClick={() => {
            // Opened while the click is still being handled, or browsers
            // block the file chooser
            onTrackAdd();
            close();
          }}
        >
          <ListItemIcon><AddRoad fontSize="small" /></ListItemIcon>
          <ListItemText>Ajouter une trace…</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            onSquadratsAdd();
          }}
        >
          <ListItemIcon><GridView fontSize="small" /></ListItemIcon>
          <ListItemText>Ajouter un export squadrats…</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!layerItems.length}
          onClick={event => setLayersAnchor(event.currentTarget)}
        >
          <ListItemIcon><Layers fontSize="small" /></ListItemIcon>
          <ListItemText>Couches</ListItemText>
          <ChevronRight fontSize="small" sx={{ ml: 2 }} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={event => setBasemapsAnchor(event.currentTarget)}>
          <ListItemIcon><MapIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Fond de carte</ListItemText>
          <ChevronRight fontSize="small" sx={{ ml: 2 }} />
        </MenuItem>
        <MenuItem onClick={event => setDisplayAnchor(event.currentTarget)}>
          <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
          <ListItemText>Afficher</ListItemText>
          <ChevronRight fontSize="small" sx={{ ml: 2 }} />
        </MenuItem>
        <Divider />
        <CheckItem
          checked={countActivities}
          disabled={!canCountActivities}
          secondary={canCountActivities ? undefined : 'Mode Nombre uniquement'}
          onClick={onCountActivitiesToggle}
        >
          Compter les activités
        </CheckItem>
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

      {/* Left open, to toggle several items in a row */}
      <Menu
        {...displayMenuProps}
        open={Boolean(displayAnchor)}
        anchorEl={displayAnchor}
        onClose={() => setDisplayAnchor(null)}
        {...submenuOrigins}
      >
        <CheckItem checked={showGrid} secondary="Masquée sous le zoom 10" onClick={onGridToggle}>
          Grille
        </CheckItem>
        <Divider />
        {Object.entries(maxAreaLabels).map(([kind, label]) => (
          <CheckItem
            key={kind}
            checked={Boolean(maxAreas[kind])}
            disabled={!canShowMaxAreas}
            secondary={canShowMaxAreas ? undefined : 'Mode Compte uniquement'}
            onClick={() => onMaxAreaToggle(kind)}
          >
            {label}
          </CheckItem>
        ))}
      </Menu>

      {/* Left open, to toggle several layers in a row */}
      <Menu
        {...layersMenuProps}
        open={Boolean(layersAnchor)}
        anchorEl={layersAnchor}
        onClose={() => setLayersAnchor(null)}
        {...submenuOrigins}
      >
        <MenuItem
          disabled={layerItems.every(({ enabled }) => enabled)}
          onClick={() => toggleAll(true)}
        >
          <ListItemText inset>Tout activer</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!layerItems.some(({ enabled }) => enabled)}
          onClick={() => toggleAll(false)}
        >
          <ListItemText inset>Tout désactiver</ListItemText>
        </MenuItem>
        {shareItems.length > 0 && <Divider />}
        {shareItems.map(item => (
          <LayerItem key={item.id} {...item} onToggle={onSharesToggle} />
        ))}
        {trackItems.length > 0 && <Divider />}
        {trackItems.map(item => (
          <LayerItem key={item.id} {...item} onToggle={onTracksToggle} />
        ))}
        {squadratsItems.length > 0 && <Divider />}
        {squadratsItems.map(item => (
          <LayerItem key={item.id} {...item} onToggle={onSquadratsToggle} />
        ))}
      </Menu>
    </>
  );
};

export default MapContextMenu;
