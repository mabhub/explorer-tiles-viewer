import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

// Renames a track or a squadrats export
const RenameDialog = ({
  open,
  title,
  name,
  onClose,
  onSubmit,
}) => {
  const handleSubmit = event => {
    event.preventDefault();

    const newName = new FormData(event.target).get('name').trim();
    // Spaces pass the required check: a blank name keeps the current one
    if (newName) { onSubmit(newName); } else { onClose(); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ component: 'form', onSubmit: handleSubmit }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          required
          fullWidth
          margin="dense"
          name="name"
          label="Nom"
          defaultValue={name}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button type="submit" variant="contained">Enregistrer</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RenameDialog;
