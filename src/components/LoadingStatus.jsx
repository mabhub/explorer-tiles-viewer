import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
} from '@mui/material';
import { Close, ErrorOutline } from '@mui/icons-material';

const paperSx = {
  position: 'absolute',
  // Above the attribution of the bottom right corner, whatever its width
  bottom: '2rem',
  // Centered without left: 50%, which would cap its width to half the map
  left: 0,
  right: 0,
  mx: 'auto',
  width: 'fit-content',
  maxWidth: 'calc(100% - 2rem)',
  // Over the map controls (z-index 2), such as the unfolded attribution on phones
  zIndex: 3,
  px: 1.5,
  py: 0.5,
  fontSize: '0.875rem',
};

// Activities received so far, while the next pages load
const getCountDetail = ({ data: [, activities = []] = [] }) => activities.length > 0
  && `${activities.length.toLocaleString('fr-FR')} activités`;

// Retries are counted from the 2nd try
const getTriesDetail = ({ failureCount }) => failureCount > 0 && `${failureCount + 1}e essai`;

// Disabled accounts are grayed
const ShareLabels = ({ shares, details = [] }) => shares.map(({
  id, label, enabled, query,
}, index) => {
  const detail = details.map(getDetail => getDetail(query)).filter(Boolean).join(', ');
  return (
    <React.Fragment key={id}>
      {index > 0 && ', '}
      <Box component="span" sx={enabled ? undefined : { color: 'text.disabled' }}>
        {label}
        {detail && ` (${detail})`}
      </Box>
    </React.Fragment>
  );
});

const FetchingRow = ({ title, shares, details }) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <CircularProgress size={14} sx={{ flexShrink: 0 }} />
    <span>{title} : <ShareLabels shares={shares} details={details} />…</span>
  </Stack>
);

// Shown over the map, panel collapsed or not, while accounts load
const LoadingStatus = ({ items, queries }) => {
  // Failures that happened before the last close stay hidden
  const [closedAt, setClosedAt] = React.useState(0);

  const shares = items
    .map((item, index) => ({ ...item, query: queries[index] }))
    .filter(({ query }) => query);
  const fetching = shares.filter(({ query }) => query.isFetching);
  // Loading until the last page is there, even if the first ones are shown
  const loading = fetching.filter(({ query }) => !query.isComplete);
  const updating = fetching.filter(({ query }) => query.isComplete);
  const failed = shares.filter(({ query }) =>
    query.isError && !query.isFetching && query.errorUpdatedAt > closedAt);

  if (!fetching.length && !failed.length) { return null; }

  return (
    <Paper elevation={3} sx={paperSx} role="status" aria-live="polite">
      <Stack spacing={0.5}>
        {loading.length > 0 && (
          <FetchingRow title="Chargement" shares={loading} details={[getCountDetail, getTriesDetail]} />
        )}
        {updating.length > 0 && (
          <FetchingRow title="Mise à jour" shares={updating} details={[getTriesDetail]} />
        )}
        {failed.length > 0 && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <ErrorOutline color="error" sx={{ fontSize: 16, flexShrink: 0 }} />
            <span>
              {failed.every(({ query }) => query.isComplete)
                ? 'Échec de la mise à jour'
                : 'Échec du chargement'}
              {' : '}
              <ShareLabels shares={failed} />
            </span>
            <Button
              size="small"
              onClick={() => failed.forEach(({ query }) => query.refetch())}
            >
              Réessayer
            </Button>
            <IconButton
              size="small"
              title="Fermer"
              aria-label="Fermer"
              onClick={() => setClosedAt(Date.now())}
            >
              <Close fontSize="inherit" />
            </IconButton>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

export default LoadingStatus;
