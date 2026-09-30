import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Loan Disbursal",
  description:
    "Create a new gold or silver pawn loan contract with automated valuation and waterfall interest calculation.",
};

export default function NewLoanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
