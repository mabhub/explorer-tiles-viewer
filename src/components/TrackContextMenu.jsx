import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Delete,
  Edit,
  ZoomOutMap,
} from '@mui/icons-material';

import usePassThroughMenu from '../hooks/use-pass-through-menu';

// Opened by a right click on a track of the list, or by its ⋮ icon
const TrackContextMenu = ({
  position,
  onClose,
  onFit,
  onRename,
  onDelete,
}) => {
  const menuProps = usePassThroughMenu({ open: Boolean(position), onClose, name: 'track' });
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
        <ListItemText>Centrer sur la trace</ListItemText>
      </MenuItem>
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

export default TrackContextMenu;
