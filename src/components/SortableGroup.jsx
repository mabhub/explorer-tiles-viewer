import React from 'react';
import { Box, Stack } from '@mui/material';
import { DragIndicator } from '@mui/icons-material';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';

const handleClass = 'drag-handle';

// Shown while the row is hovered or the handle focused, always on touch screens
const handleSx = {
  display: 'flex',
  flexShrink: 0,
  ml: -0.5,
  color: 'text.disabled',
  cursor: 'grab',
  touchAction: 'none',
  opacity: 0,
  transition: 'opacity 150ms',
  '&:focus-visible': { opacity: 1, outline: '2px solid', outlineColor: 'primary.main', borderRadius: 0.5 },
  '@media (hover: none)': { opacity: 1 },
};
const placeholderSx = { ...handleSx, visibility: 'hidden' };

const screenReaderInstructions = {
  draggable: 'Pour déplacer cette ligne, appuyer sur Espace ou Entrée, la déplacer avec les flèches haut et bas, puis appuyer sur Espace ou Entrée pour la déposer, ou sur Échap pour annuler.',
};

const getAnnouncements = labels => ({
  onDragStart: ({ active }) => `${labels[active.id]} saisi.`,
  onDragOver: ({ active, over }) => (over
    ? `${labels[active.id]} déplacé à la place de ${labels[over.id]}.`
    : `${labels[active.id]} hors de la liste.`),
  onDragEnd: ({ active, over }) => (over
    ? `${labels[active.id]} déposé à la place de ${labels[over.id]}.`
    : `${labels[active.id]} déposé.`),
  onDragCancel: ({ active }) => `Déplacement de ${labels[active.id]} annulé.`,
});

/**
 * Rows reordered by drag and drop, within the group only, from their handle.
 * @param {object} props
 * @param {string[]} props.ids ids of the rows, in list order
 * @param {Object<string, string>} props.labels names of the rows, for screen readers
 * @param {(ids: string[]) => void} props.onReorder gets the ids in their new order
 */
export const SortableGroup = ({
  ids,
  labels,
  onReorder,
  children,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const accessibility = React.useMemo(
    () => ({ announcements: getAnnouncements(labels), screenReaderInstructions }),
    [labels],
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) { return; }
    onReorder(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={accessibility}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
};

/**
 * A row of a SortableGroup, its handle first. A group of one row keeps the
 * room of the handle, so that rows of all groups line up.
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.label name of the row
 * @param {boolean} props.sortable false when the row is alone in its group
 */
export const SortableRow = ({
  id,
  label,
  sortable,
  children,
  ...props
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !sortable });

  return (
    <Stack
      ref={setNodeRef}
      direction="row"
      alignItems="center"
      style={{
        transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
        transition,
      }}
      sx={{
        position: 'relative',
        borderRadius: 1,
        ...(isDragging && { zIndex: 1, bgcolor: 'background.paper', boxShadow: 3 }),
        [`&:hover .${handleClass}`]: { opacity: 1 },
      }}
      {...props}
    >
      {sortable
        ? (
          <Box
            ref={setActivatorNodeRef}
            component="span"
            className={handleClass}
            title="Glisser pour réordonner"
            {...attributes}
            {...listeners}
            aria-label={`Déplacer ${label}`}
            sx={handleSx}
          >
            <DragIndicator sx={{ fontSize: 16 }} />
          </Box>
        )
        : (
          <Box component="span" aria-hidden sx={placeholderSx}>
            <DragIndicator sx={{ fontSize: 16 }} />
          </Box>
        )}
      {children}
    </Stack>
  );
};

// Items listed in `ids` take that order; others, added meanwhile, follow
export const reorderItems = ids => items => [
  ...ids.map(id => items.find(item => item.id === id)).filter(Boolean),
  ...items.filter(item => !ids.includes(item.id)),
];
