import React from 'react';

// A MUI menu is a modal: its full-screen root takes the clicks meant for the
// map. The returned props let them through to what lies under it, the menu
// itself excepted. A press or a wheel outside the menus named in `inside`
// closes it, and goes on as usual: drag, zoom or click.
const usePassThroughMenu = ({
  open,
  onClose,
  name,
  inside = [name],
}) => {
  const insideSelector = inside.map(menu => `[data-menu="${menu}"]`).join(',');

  React.useEffect(
    () => {
      if (!open) { return undefined; }

      const handleOutside = ({ target }) => {
        if (!target.closest?.(insideSelector)) { onClose(); }
      };
      document.addEventListener('pointerdown', handleOutside, true);
      document.addEventListener('wheel', handleOutside, true);

      return () => {
        document.removeEventListener('pointerdown', handleOutside, true);
        document.removeEventListener('wheel', handleOutside, true);
      };
    },
    [open, onClose, insideSelector],
  );

  return {
    hideBackdrop: true,
    disableScrollLock: true,
    // The map takes the focus when clicked: the menu must not take it back
    disableEnforceFocus: true,
    sx: { pointerEvents: 'none' },
    slotProps: { paper: { 'data-menu': name, sx: { pointerEvents: 'auto' } } },
  };
};

export default usePassThroughMenu;
