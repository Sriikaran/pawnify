import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboard New Customer",
  description: "Register a new borrower with KYC details and identity verification.",
};

export default function NewCustomerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
