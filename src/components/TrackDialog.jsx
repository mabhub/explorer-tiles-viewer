import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

// Renames a track
const TrackDialog = ({
  open,
  track,
  onClose,
  onSubmit,
}) => {
  const handleSubmit = event => {
    event.preventDefault();

    const name = new FormData(event.target).get('name').trim();
    // Spaces pass the required check: a blank name keeps the current one
    if (name) { onSubmit(name); } else { onClose(); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ component: 'form', onSubmit: handleSubmit }}
    >
      <DialogTitle>Renommer la trace</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          required
          fullWidth
          margin="dense"
          name="name"
          label="Nom"
          defaultValue={track?.name}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button type="submit" variant="contained">Enregistrer</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TrackDialog;
