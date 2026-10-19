import React from 'react';
import {
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
  CompareArrows,
  Delete,
  Edit,
  Refresh,
  ZoomOutMap,
} from '@mui/icons-material';

import usePassThroughMenu from '../hooks/use-pass-through-menu';

// Opened by a right click on a squadrats export of the list, or by its ⋮ icon.
// Only an export added from its link knows its account, to refresh from and
// to compare with the tiles of a person.
const SquadratsContextMenu = ({
  position,
  entry,
  onClose,
  onFit,
  onRefresh,
  onLiveToggle,
  people,
  comparedPersonId,
  onCompare,
  onRename,
  onDelete,
}) => {
  const [peopleAnchor, setPeopleAnchor] = React.useState(null);
  const close = () => {
    setPeopleAnchor(null);
    onClose();
  };
  // Pressing the submenu leaves the menu open
  const menuProps = usePassThroughMenu({
    open: Boolean(position),
    onClose: close,
    name: 'squadrats',
    inside: ['squadrats', 'squadrats-people'],
  });
  const peopleMenuProps = usePassThroughMenu({
    open: Boolean(peopleAnchor),
    onClose: () => setPeopleAnchor(null),
    name: 'squadrats-people',
  });
  // Each action closes the menu
  const withClose = action => () => {
    close();
    action();
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
          <MenuItem
            key="compare"
            disabled={!people.length}
            onClick={event => setPeopleAnchor(event.currentTarget)}
          >
            <ListItemIcon><CompareArrows fontSize="small" /></ListItemIcon>
            <ListItemText>Comparer avec</ListItemText>
            <ChevronRight fontSize="small" sx={{ ml: 2 }} />
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

      <Menu
        {...peopleMenuProps}
        open={Boolean(peopleAnchor)}
        anchorEl={peopleAnchor}
        onClose={() => setPeopleAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {people.map(({ id, label }) => (
          <MenuItem
            key={id}
            role="menuitemradio"
            aria-checked={id === comparedPersonId}
            onClick={withClose(() => onCompare(entry.id, id))}
          >
            <ListItemIcon>{id === comparedPersonId && <Check fontSize="small" />}</ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default SquadratsContextMenu;
