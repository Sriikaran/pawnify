import { requireSession } from "@/lib/auth/session";
import { LoanDetailClient } from "./loan-detail-client";

export const metadata = {
  title: "Loan Contract Details | Pawnify",
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function LoanDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const session = await requireSession();
  const isAdmin = (session.user as unknown as { role: string }).role === "ADMIN";

  return <LoanDetailClient id={resolvedParams.id} isAdmin={isAdmin} />;
}
