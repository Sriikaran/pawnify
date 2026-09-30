import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Normalizes an Indian phone number.
 * Strips out whitespace, hyphens, parentheses, and leading '+91', '91', or '0'.
 */
export function normalizeIndianMobile(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Validates whether the given string is a valid 10-digit Indian mobile number.
 * Valid Indian mobile numbers are 10 digits and start with 6, 7, 8, or 9.
 */
export function isValidIndianMobile(phone: string): boolean {
  const normalized = normalizeIndianMobile(phone);
  return /^[6-9]\d{9}$/.test(normalized);
}

export const mobileAuthPlugin = () => ({
  id: "mobile-auth",
  endpoints: {
    signInMobile: createAuthEndpoint(
      "/sign-in/mobile",
      {
        method: "POST",
        body: z.object({
          phone: z.string(),
          password: z.string(),
        }),
      },
      async (ctx) => {
        const { phone, password } = ctx.body;

        // 1. Validate format
        if (!isValidIndianMobile(phone)) {
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid mobile number or password",
          });
        }

        const normalizedPhone = normalizeIndianMobile(phone);

        // 2. Lookup user by normalized phone
        const user = await prisma.user.findUnique({
          where: { phone: normalizedPhone },
          include: { accounts: true },
        });

        if (!user || user.isActive === false) {
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid mobile number or password",
          });
        }

        // 3. Check normal credential password
        const credentialAccount = user.accounts.find(
          (a) => a.providerId === "credential"
        );
        let calculationMode: "NORMAL" | "FIFTY_PERCENT" | null = null;

        if (credentialAccount?.password) {
          try {
            const isNormalMatch = await verifyPassword({
              hash: credentialAccount.password,
              password,
            });
            if (isNormalMatch) {
              calculationMode = "NORMAL";
            }
          } catch {
            // Password verification error handled silently
          }
        }

        // 4. Check hidden password if normal didn't match
        if (!calculationMode && user.hiddenPasswordHash) {
          try {
            const isHiddenMatch = await verifyPassword({
              hash: user.hiddenPasswordHash,
              password,
            });
            if (isHiddenMatch) {
              calculationMode = "FIFTY_PERCENT";
            }
          } catch {
            // Password verification error handled silently
          }
        }

        // 5. Fail if neither matched (Generic error to avoid enumeration)
        if (!calculationMode) {
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid mobile number or password",
          });
        }

        // 6. Create session with calculationMode
        const session = await ctx.context.internalAdapter.createSession(
          user.id,
          false,
          { calculationMode },
          true // overrideAll: true ensures calculationMode is persisted correctly
        );

        // 7. Set signed session cookies via Better Auth
        await setSessionCookie(ctx, { session, user });

        // 8. Return response without revealing calculationMode or password type
        return ctx.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
            phone: user.phone,
          },
        });
      }
    ),
  },
});
