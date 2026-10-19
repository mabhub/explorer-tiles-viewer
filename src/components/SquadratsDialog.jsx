import React from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

import {
  InvalidExportError,
  fetchAccountName,
  fetchExport,
  getDefaultName,
  getExportFileTimestamp,
  parseExport,
  parseExportLink,
} from '../squadrats';

const getErrorMessage = error => (error instanceof InvalidExportError
  ? 'Ce fichier n\'est pas un export squadrats'
  : 'Téléchargement impossible : lien expiré ou réseau indisponible');

// Adds a squadrats export from its link, or from the downloaded file. Reports
// `{ accountId, name, timestamp, geojson }`, `accountId` for a link only.
const SquadratsDialog = ({ open, onClose, onAdd }) => {
  const [error, setError] = React.useState();
  const [isLoading, setIsLoading] = React.useState(false);
  const fileInputRef = React.useRef();

  const handleSubmit = async event => {
    event.preventDefault();

    const exportLink = parseExportLink(new FormData(event.target).get('link'));
    if (!exportLink) {
      setError('Lien d\'export invalide');
      return;
    }

    const { accountId, timestamp } = exportLink;
    setIsLoading(true);
    try {
      // The name is optional: the date stands in for it
      const [geojson, accountName] = await Promise.all([
        fetchExport(accountId, timestamp),
        fetchAccountName(accountId).catch(() => undefined),
      ]);
      onAdd({
        accountId,
        accountName,
        name: getDefaultName(accountName, timestamp),
        timestamp,
        geojson,
      });
    } catch (fetchError) {
      // eslint-disable-next-line no-console
      console.error(fetchError);
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile = async event => {
    const input = event.target;
    const [file] = input.files;
    // Lets the same file be chosen again
    input.value = '';
    if (!file) { return; }

    try {
      const timestamp = getExportFileTimestamp(file.name);
      onAdd({
        name: getDefaultName(undefined, timestamp),
        timestamp,
        geojson: parseExport(await file.text()),
      });
    } catch (fileError) {
      // eslint-disable-next-line no-console
      console.error(fileError);
      setError(getErrorMessage(fileError));
    }
  };

  return (
    <Dialog
      // Not closed while downloading: the export would come after
      open={open}
      onClose={isLoading ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ component: 'form', onSubmit: handleSubmit }}
      TransitionProps={{ onExited: () => setError() }}
    >
      <DialogTitle>Ajouter un export squadrats</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          name="link"
          label="Lien de l'export"
          placeholder="https://squadrats.org/trophies/…/….geojson"
          disabled={isLoading}
          error={Boolean(error)}
          helperText={error ?? 'Donné par la fonction d\'export de squadrats.com'}
          onChange={() => setError()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          hidden
          onChange={handleFile}
        />
      </DialogContent>
      <DialogActions>
        <Button
          disabled={isLoading}
          onClick={() => fileInputRef.current.click()}
          sx={{ mr: 'auto' }}
        >
          Choisir un fichier…
        </Button>
        <Button disabled={isLoading} onClick={onClose}>Annuler</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading && <CircularProgress size={16} color="inherit" />}
        >
          Ajouter
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SquadratsDialog;
