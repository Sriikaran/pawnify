import { AccountLedgerClient } from "./account-ledger-client";

export const metadata = {
  title: "Account Ledger | Pawnify",
  description: "Chronological transaction journal and running balance for Master Accounts",
};

export default function AccountLedgerPage() {
  return <AccountLedgerClient />;
}
