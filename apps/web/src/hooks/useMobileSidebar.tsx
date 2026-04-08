import { createContext, useContext, useState, useCallback } from "react";

interface MobileSidebarCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<MobileSidebarCtx>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
});

export function MobileSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <Ctx.Provider value={{ open, setOpen, toggle }}>{children}</Ctx.Provider>
  );
}

export function useMobileSidebar() {
  return useContext(Ctx);
}
