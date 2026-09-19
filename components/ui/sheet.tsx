"use client";

import { useEffect, type ReactNode } from "react";

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div className="sheet-root">
      <button className="sheet-overlay" type="button" aria-label="Close details" onClick={() => onOpenChange(false)} />
      <aside className="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title" aria-describedby={description ? "sheet-description" : undefined}>
        <header className="sheet-header">
          <div><h2 id="sheet-title">{title}</h2>{description && <p id="sheet-description">{description}</p>}</div>
          <button className="sheet-close" type="button" aria-label="Close details" onClick={() => onOpenChange(false)}>×</button>
        </header>
        <div className="sheet-content">{children}</div>
      </aside>
    </div>
  );
}
