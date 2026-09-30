"use client";

import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular" | "card";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const variantStyles = {
    text: "rounded-md h-4 w-3/4",
    circular: "rounded-full w-10 h-10 shrink-0",
    rectangular: "rounded-xl w-full h-20",
    card: "rounded-2xl w-full h-32 glass-card",
  }[variant];

  return (
    <div
      className={`animate-pulse ${variantStyles} ${className}`}
      style={{
        background: variant === "card" ? undefined : "var(--bg-tertiary)",
        border: variant === "card" ? "1px solid var(--border-primary)" : undefined,
        width: width !== undefined ? (typeof width === "number" ? `${width}px` : width) : undefined,
        height:
          height !== undefined ? (typeof height === "number" ? `${height}px` : height) : undefined,
        ...style,
      }}
      {...props}
    />
  );
}
