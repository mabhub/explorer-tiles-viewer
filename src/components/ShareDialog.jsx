import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

// A share link, with or without trailing slash or query string, or a bare id
const shareIdPattern = /^(?:.*\/share\/)?(\w+)\/?(?:[?#].*)?$/;

// Adds a share, or edits the given one: its id then stays as is
const ShareDialog = ({
  open,
  share,
  onClose,
  onSubmit,
}) => {
  const [isInvalid, setIsInvalid] = React.useState(false);

  const handleSubmit = event => {
    event.preventDefault();

    const { link = '', alias } = Object.fromEntries(new FormData(event.target).entries());
    const id = share?.id ?? (link.trim().match(shareIdPattern) || [])[1];
    if (!id) {
      setIsInvalid(true);
      return;
    }

    onSubmit({ id, alias: alias.trim() });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ component: 'form', onSubmit: handleSubmit }}
      TransitionProps={{ onExited: () => setIsInvalid(false) }}
    >
      <DialogTitle>{share ? 'Modifier le compte' : 'Ajouter un compte'}</DialogTitle>
      <DialogContent>
        {share
          ? (
            <TextField
              fullWidth
              margin="dense"
              label="Identifiant de partage"
              value={share.id}
              disabled
            />
          )
          : (
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              name="link"
              label="Lien ou identifiant de partage"
              placeholder="https://www.statshunters.com/share/abc…"
              error={isInvalid}
              helperText={isInvalid ? 'Lien de partage invalide' : ' '}
              onChange={() => setIsInvalid(false)}
            />
          )}
        <TextField
          autoFocus={Boolean(share)}
          fullWidth
          margin="dense"
          name="alias"
          label="Nom affiché"
          defaultValue={share?.alias ?? ''}
          placeholder={share?.accountName}
          helperText="Facultatif : remplace le nom Statshunters"
          InputLabelProps={{ shrink: true }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button type="submit" variant="contained">{share ? 'Enregistrer' : 'Ajouter'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareDialog;
