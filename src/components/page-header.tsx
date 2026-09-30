import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6"
      style={{ borderBottom: "1px solid var(--border-primary)" }}
    >
      <div>
        <h1
          className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm max-w-3xl" style={{ color: "var(--text-tertiary)" }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-3 shrink-0">{action}</div>}
    </div>
  );
}
