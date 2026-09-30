import { requireSession } from "@/lib/auth/session";
import { CustomerDetailClient } from "./customer-detail-client";

export const metadata = {
  title: "Customer Profile | Pawnify",
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const session = await requireSession();
  const isAdmin = (session.user as unknown as { role: string }).role === "ADMIN";

  return <CustomerDetailClient id={resolvedParams.id} isAdmin={isAdmin} />;
}
