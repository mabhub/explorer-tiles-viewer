import {
  Divider,
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
  FormatColorReset,
  OpenInNew,
} from '@mui/icons-material';

// Opened by a right click on an account of the list, or by its ⋮ icon
const ShareContextMenu = ({
  shareId,
  position,
  onClose,
  onEdit,
  onDelete,
  hideShareIds,
  onHideShareIdsToggle,
  canResetColors,
  onColorsReset,
}) => (
  <Menu
    open={Boolean(position)}
    onClose={onClose}
    anchorReference="anchorPosition"
    anchorPosition={position && { top: position.y, left: position.x }}
  >
    <MenuItem
      component="a"
      href={`https://www.statshunters.com/share/${shareId}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClose}
    >
      <ListItemIcon><OpenInNew fontSize="small" /></ListItemIcon>
      <ListItemText>Ouvrir sur Statshunters</ListItemText>
    </MenuItem>
    <MenuItem
      onClick={() => {
        onClose();
        onEdit();
      }}
    >
      <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
      <ListItemText>Modifier le nom affiché…</ListItemText>
    </MenuItem>
    <MenuItem
      onClick={() => {
        onClose();
        onDelete();
      }}
    >
      <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
      <ListItemText>Supprimer</ListItemText>
    </MenuItem>
    <Divider />
    {/* Left open, as the toggles of the map context menu */}
    <MenuItem role="menuitemcheckbox" aria-checked={hideShareIds} onClick={onHideShareIdsToggle}>
      <ListItemIcon>
        {hideShareIds ? <CheckBox fontSize="small" /> : <CheckBoxOutlineBlank fontSize="small" />}
      </ListItemIcon>
      <ListItemText>Masquer les identifiants</ListItemText>
    </MenuItem>
    <MenuItem
      disabled={!canResetColors}
      onClick={() => {
        onClose();
        onColorsReset();
      }}
    >
      <ListItemIcon><FormatColorReset fontSize="small" /></ListItemIcon>
      <ListItemText secondary={canResetColors ? undefined : 'Mode Compte uniquement'}>
        Réinitialiser les couleurs
      </ListItemText>
    </MenuItem>
  </Menu>
);

export default ShareContextMenu;
