"use server";

import { revalidatePath } from "next/cache";
import { checkAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { FollowUpStatus } from "@prisma/client";
import { serializeForClient } from "@/lib/serialize";

import { projectMonetaryString } from "@/lib/projection";

export async function getFollowUpsAction(tab: string) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const [followUps, activeLoans] = await Promise.all([
    prisma.followUp.findMany({
      where: tab === "DONE" ? { status: "DONE" } : { status: "PENDING" },
      include: {
        loan: {
          select: {
            id: true,
            loanNumber: true,
            principalOutstanding: true,
            dueDate: true,
            customer: { select: { fullName: true, phone: true } },
          },
        },
        assignedTo: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.loan.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        loanNumber: true,
        customer: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeLoanOptions = activeLoans.map((l) => ({
    id: l.id,
    loanNumber: l.loanNumber,
    customerName: l.customer.fullName,
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formattedFollowUps = followUps.map((f) => ({
    id: f.id,
    dueDate: f.dueDate.toISOString(),
    loanId: f.loanId,
    loan: {
      loanNumber: f.loan.loanNumber,
      principalOutstanding: projectMonetaryString(
        f.loan.principalOutstanding.toString(),
        auth.calculationMode
      ),
      customer: {
        fullName: f.loan.customer.fullName,
        phone: f.loan.customer.phone,
      },
    },
    note: f.note,
    assignedToName: f.assignedTo?.name || "Unassigned",
    status: f.status,
    isOverdueTask: tab === "PENDING" && new Date(f.dueDate) < today,
  }));

  return serializeForClient({ followUps: formattedFollowUps, activeLoanOptions });
}

export async function createFollowUpAction(loanId: string, note: string, dueDateStr: string) {
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!note.trim()) {
    return { success: false, error: "Note is required" };
  }

  try {
    await prisma.followUp.create({
      data: {
        loanId,
        note: note.trim(),
        dueDate: new Date(dueDateStr),
        status: "PENDING",
        assignedToId: auth.user.id,
      },
    });

    revalidatePath("/followups");
    revalidatePath(`/loans/${loanId}`);
    return { success: true };
  } catch (err: unknown) {
    console.error("Create follow-up error:", err);
    return { success: false, error: "Failed to create follow-up task" };
  }
}

export async function updateFollowUpStatusAction(id: string, status: FollowUpStatus) {
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const f = await prisma.followUp.update({
      where: { id },
      data: {
        status,
      },
    });

    revalidatePath("/followups");
    revalidatePath(`/loans/${f.loanId}`);
    return { success: true };
  } catch (err: unknown) {
    console.error("Update follow-up error:", err);
    return { success: false, error: "Failed to update follow-up status" };
  }
}

export async function deleteFollowUpAction(id: string) {
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const f = await prisma.followUp.delete({
      where: { id },
    });

    revalidatePath("/followups");
    revalidatePath(`/loans/${f.loanId}`);
    return { success: true };
  } catch (err: unknown) {
    console.error("Delete follow-up error:", err);
    return { success: false, error: "Failed to delete follow-up task" };
  }
}
