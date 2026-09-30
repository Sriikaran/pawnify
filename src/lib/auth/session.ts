import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { debugLog } from "@/lib/debug";

export type CalculationMode = "NORMAL" | "FIFTY_PERCENT";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  isActive: boolean;
};


/**
 * Get the current session from Better Auth.
 * Reads headers from the active request and validates session against the database.
 */
export async function getSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch (error) {
    debugLog("auth", "Failed to retrieve session:", error);
    return null;
  }
}

/**
 * Extracts calculationMode from the session safely.
 */
export async function getCalculationMode(): Promise<CalculationMode> {
  const session = await getSession();
  const sessionObj = session?.session as { calculationMode?: string } | undefined;
  const rawMode = sessionObj?.calculationMode;
  return rawMode === "FIFTY_PERCENT" ? "FIFTY_PERCENT" : "NORMAL";
}

/**
 * Require an authenticated session.
 * Rejects unauthenticated or deactivated access and redirects to /login.
 */
export async function requireSession() {
  const session = await getSession();

  if (!session || !session.user) {
    redirect("/login");
  }

  const user = session.user as unknown as SessionUser;
  if (user.isActive === false) {
    redirect("/login?error=account_deactivated");
  }

  return session;
}

/**
 * Require an admin session.
 * Redirects non-admin or unauthenticated access.
 */
export async function requireAdmin() {
  const session = await requireSession();
  const user = session.user as unknown as SessionUser;

  if (user.role !== "ADMIN") {
    redirect("/dashboard?error=unauthorized_admin");
  }

  return session;
}

/**
 * Check authentication inside a Server Action or Route Handler.
 */
export async function checkAuth(): Promise<
  | { authenticated: true; user: SessionUser; sessionId: string; calculationMode: CalculationMode }
  | { authenticated: false; error: string }
> {
  const session = await getSession();

  if (!session || !session.user) {
    return { authenticated: false, error: "Unauthorized: Please log in." };
  }

  const user = session.user as unknown as SessionUser;
  if (user.isActive === false) {
    return { authenticated: false, error: "Unauthorized: Account is deactivated." };
  }

  const sessionObj = session.session as unknown as { id: string; calculationMode?: string };
  const rawMode = sessionObj?.calculationMode;
  const calculationMode: CalculationMode = rawMode === "FIFTY_PERCENT" ? "FIFTY_PERCENT" : "NORMAL";

  return {
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "STAFF",
      phone: user.phone ?? null,
      isActive: user.isActive ?? true,
    },
    sessionId: session.session.id,
    calculationMode,
  };
}

/**
 * Check admin role inside a Server Action or Route Handler.
 */
export async function checkAdmin(): Promise<
  | { authenticated: true; user: SessionUser; sessionId: string; calculationMode: CalculationMode }
  | { authenticated: false; error: string }
> {
  const authResult = await checkAuth();

  if (!authResult.authenticated) {
    return authResult;
  }

  if (authResult.user.role !== "ADMIN") {
    return { authenticated: false, error: "Unauthorized: Admin privileges required." };
  }

  return authResult;
}
