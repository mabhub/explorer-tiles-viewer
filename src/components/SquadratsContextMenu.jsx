import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  CheckBox,
  CheckBoxOutlineBlank,
  Delete,
  Edit,
  Refresh,
  ZoomOutMap,
} from '@mui/icons-material';

import usePassThroughMenu from '../hooks/use-pass-through-menu';

// Opened by a right click on a squadrats export of the list, or by its ⋮ icon.
// Only an export added from its link knows its account, to refresh from.
const SquadratsContextMenu = ({
  position,
  entry,
  onClose,
  onFit,
  onRefresh,
  onLiveToggle,
  onRename,
  onDelete,
}) => {
  const menuProps = usePassThroughMenu({ open: Boolean(position), onClose, name: 'squadrats' });
  // Each action closes the menu
  const withClose = action => () => {
    onClose();
    action();
  };

  return (
    <Menu
      {...menuProps}
      open={Boolean(position)}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={position && { top: position.y, left: position.x }}
    >
      <MenuItem onClick={withClose(onFit)}>
        <ListItemIcon><ZoomOutMap fontSize="small" /></ListItemIcon>
        <ListItemText>Centrer sur les squadratinhos</ListItemText>
      </MenuItem>
      {entry?.accountId && [
        <MenuItem key="refresh" onClick={withClose(() => onRefresh(entry))}>
          <ListItemIcon><Refresh fontSize="small" /></ListItemIcon>
          <ListItemText>Actualiser</ListItemText>
        </MenuItem>,
        <MenuItem
          key="live"
          role="menuitemcheckbox"
          aria-checked={Boolean(entry.live)}
          onClick={withClose(() => onLiveToggle(entry))}
        >
          <ListItemIcon>
            {entry.live ? <CheckBox fontSize="small" /> : <CheckBoxOutlineBlank fontSize="small" />}
          </ListItemIcon>
          <ListItemText secondary="Tuiles de squadrats.com au lieu de la copie locale">
            Lire en direct
          </ListItemText>
        </MenuItem>,
      ]}
      <MenuItem onClick={withClose(onRename)}>
        <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
        <ListItemText>Renommer…</ListItemText>
      </MenuItem>
      <MenuItem onClick={withClose(onDelete)}>
        <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
        <ListItemText>Supprimer</ListItemText>
      </MenuItem>
    </Menu>
  );
};

export default SquadratsContextMenu;
