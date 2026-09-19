import type { HTMLAttributes } from "react";

export function Alert({
  variant = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" }) {
  return (
    <div
      role="alert"
      className={`ui-alert ui-alert--${variant} ${className}`}
      {...props}
    />
  );
}
