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

const ShareDialog = ({ open, onClose, onSubmit }) => {
  const [isInvalid, setIsInvalid] = React.useState(false);

  const handleSubmit = event => {
    event.preventDefault();

    const { share } = Object.fromEntries(new FormData(event.target).entries());
    const [, id] = share.trim().match(shareIdPattern) || [];
    if (!id) {
      setIsInvalid(true);
      return;
    }

    onSubmit(id);
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
      <DialogTitle>Ajouter un compte</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          name="share"
          label="Lien ou identifiant de partage"
          placeholder="https://www.statshunters.com/share/abc…"
          error={isInvalid}
          helperText={isInvalid ? 'Lien de partage invalide' : ' '}
          onChange={() => setIsInvalid(false)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button type="submit" variant="contained">Ajouter</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareDialog;
