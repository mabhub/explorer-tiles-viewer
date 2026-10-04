import React from 'react';
import {
  Box,
  Button,
  Link,
  Stack,
  Typography,
} from '@mui/material';

const visibleCount = 5;

const activityTypes = {
  Ride: 'Vélo',
  GravelRide: 'Gravel',
  MountainBikeRide: 'VTT',
  EBikeRide: 'VAE',
  Run: 'Course',
  Walk: 'Marche',
  Hike: 'Rando',
  Workout: 'Entraînement',
};

const formatDate = date => (date
  ? new Date(date.replace(' ', 'T')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  : '');

// Activities of the tile grouped by person, most active first. Several
// shares of a person often include the same activity: it is counted once.
const getPeople = (tile, labelByShare, colorByShare) => {
  const people = {};

  tile.activities.forEach(({ activity, shareId }) => {
    const { user_id: userId } = activity;
    if (!people[userId]) {
      people[userId] = {
        userId,
        label: labelByShare[shareId],
        color: colorByShare[shareId],
        activities: new Map(),
      };
    }
    people[userId].activities.set(activity.foreignId ?? activity, activity);
  });

  return Object.values(people)
    .map(person => ({
      ...person,
      activities: [...person.activities.values()]
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    }))
    .sort((a, b) => b.activities.length - a.activities.length);
};

const ActivityName = ({ activity: { foreignId, name } }) => (foreignId
  ? (
    <Link href={`https://www.strava.com/activities/${foreignId}`} target="_blank" rel="noopener noreferrer">
      {name || 'Activité'}
    </Link>
  )
  : name || 'Activité');

const PersonActivities = ({ person }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { activities } = person;
  const shown = isExpanded ? activities : activities.slice(0, visibleCount);
  const hiddenCount = activities.length - shown.length;

  return (
    <Box sx={{ mb: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          component="span"
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: person.color,
            opacity: 0.5,
            flexShrink: 0,
          }}
        />
        <Typography variant="subtitle2">{person.label}</Typography>
        <Typography variant="caption" color="text.secondary">
          {activities.length} activité{activities.length > 1 ? 's' : ''}
        </Typography>
      </Stack>

      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {shown.map((activity, index) => (
          <Typography component="li" variant="body2" key={activity.foreignId ?? index}>
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {formatDate(activity.date)} · {activityTypes[activity.type] ?? activity.type}
            </Box>
            {' '}
            <ActivityName activity={activity} />
          </Typography>
        ))}
      </Box>

      {hiddenCount > 0 && (
        <Button size="small" onClick={() => setIsExpanded(true)}>
          Afficher les {hiddenCount} autres
        </Button>
      )}
    </Box>
  );
};

const TilePopup = ({ tile, labelByShare, colorByShare }) => (
  <Box sx={{ maxHeight: 320, overflowY: 'auto', pr: 1 }}>
    {getPeople(tile, labelByShare, colorByShare).map(person => (
      <PersonActivities key={person.userId} person={person} />
    ))}
  </Box>
);

export default TilePopup;
