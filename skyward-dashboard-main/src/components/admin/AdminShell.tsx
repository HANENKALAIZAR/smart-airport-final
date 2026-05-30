import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal AdminShell + GlassCard.
 * In the Lovable preview, the outer sidebar/header is provided by AdminPreview,
 * so AdminShell only renders the page-level title/actions strip + children.
 * In the real project this same component can be replaced with the full shell.
 */
export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="admin-shell">
      {(title || actions) && (
        <div className="admin-page__header" style={{ marginBottom: "1.25rem" }}>
          <div>
            {title && <h1 className="admin-page__title">{title}</h1>}
            {subtitle && <p className="admin-page__subtitle">{subtitle}</p>}
          </div>
          {actions && <div style={{ display: "flex", gap: "0.5rem" }}>{actions}</div>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function GlassCard({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass-card p-5", className)} {...rest}>
      {children}
    </div>
  );
}
