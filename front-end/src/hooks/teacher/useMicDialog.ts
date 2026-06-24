import { useEffect, useState } from "react";

export function useMicDialog(micBlocked: boolean) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(micBlocked);
  }, [micBlocked]);

  return { open, setOpen };
}
