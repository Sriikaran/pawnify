import React, { Suspense } from "react";
import { checkAuth } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { listAccounts } from "@/lib/services/accounts";
import { AccountsClient } from "./accounts-client";

export const metadata = {
  title: "Account Master | Pawnify",
  description: "Master financial accounts configuration for Day Book, Ledgers, and reporting.",
};

export default async function AccountsPage() {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    redirect("/login");
  }

  // Fetch initial accounts server-side
  const initialAccounts = await listAccounts();

  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-(--text-muted)">Loading Account Master...</div>}>
      <AccountsClient
        userRole={auth.user.role}
        initialAccounts={JSON.parse(JSON.stringify(initialAccounts))}
      />
    </Suspense>
  );
}
