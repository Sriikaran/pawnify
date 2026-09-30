import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication",
  description: "Sign in or register for your Pawnify account to manage gold and silver loans.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-h-screen" style={{ background: "var(--bg-secondary)" }}>
      {children}
    </div>
  );
}
