"use server";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateProfileNameAction(formData: FormData) {
  try {
    const session = await requireSession();
    const userId = (session.user as unknown as { id: string }).id;
    const name = formData.get("name") as string;

    if (!name || name.trim().length < 2) {
      return { success: false, error: "Name must be at least 2 characters long" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
    });

    revalidatePath("/profile");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Update profile error:", err);
    return { success: false, error: "Failed to update profile" };
  }
}

export async function updateProfileAvatarAction(avatarUrl: string) {
  try {
    const session = await requireSession();
    const userId = (session.user as unknown as { id: string }).id;

    await prisma.user.update({
      where: { id: userId },
      data: { image: avatarUrl },
    });

    revalidatePath("/profile");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Update avatar error:", err);
    return { success: false, error: "Failed to update avatar" };
  }
}
