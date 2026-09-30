import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In & Register",
  description: "Access the Pawnify Gold & Silver Loan Management portal.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
