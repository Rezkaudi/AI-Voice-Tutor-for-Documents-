import { useEffect, useState } from "react";

/**
 * Mirrors the browser mic-permission state into a dialog: opens on a block,
 * closes once the user re-enables the mic in site settings.
 */
export function useMicDialog(micBlocked: boolean) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Intentional state sync with an external (browser permission) system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(micBlocked);
  }, [micBlocked]);

  return { open, setOpen };
}
