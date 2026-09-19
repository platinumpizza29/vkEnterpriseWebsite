"use client";

import { useEffect, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function Dialog({ open, onOpenChange, title, description, children, className = "" }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return <div className="dialog-root"><button className="dialog-overlay" type="button" aria-label="Close dialog" onClick={() => onOpenChange(false)} /><section className={`dialog-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby={description ? "dialog-description" : undefined}><header className="dialog-header"><div><h2 id="dialog-title">{title}</h2>{description && <p id="dialog-description">{description}</p>}</div><button className="sheet-close" type="button" aria-label="Close dialog" onClick={() => onOpenChange(false)}>×</button></header><div className="dialog-content">{children}</div></section></div>;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  pending = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} className="alert-dialog-panel">{error && <Alert variant="destructive" className="admin-form-error">{error}</Alert>}<div className="alert-dialog-actions"><button className="factory-secondary-button" type="button" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</button><button className="destructive-button" type="button" disabled={pending} onClick={onConfirm}>{pending ? "Working…" : confirmLabel}</button></div></Dialog>;
}
