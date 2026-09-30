import { Prisma } from "@prisma/client";

/**
 * Recursively maps Decimal -> string and Date -> string at the type level so
 * consumers (RTK Query hooks, component props) see the actual shape returned
 * at runtime, not the pre-serialization Prisma types.
 */
export type Serialized<T> = T extends Prisma.Decimal
  ? string
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

/**
 * Server Actions (and the Redux store) only accept plain JSON-safe values —
 * Prisma's Decimal instances lose their prototype across that boundary, and
 * Date instances trigger Redux's non-serializable-value warnings once cached
 * by RTK Query, so every query action that returns Prisma rows must run
 * through this first. Existing formatDate()/formatINR() helpers across the
 * app already accept `Date | string`, so ISO strings need no other changes.
 */
export function serializeForClient<T>(value: T): Serialized<T> {
  if (value === null || value === undefined) {
    return value as Serialized<T>;
  }
  if (value instanceof Prisma.Decimal) {
    return value.toString() as Serialized<T>;
  }
  if (value instanceof Date) {
    return value.toISOString() as Serialized<T>;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeForClient(item)) as Serialized<T>;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = serializeForClient(val);
    }
    return out as Serialized<T>;
  }
  return value as Serialized<T>;
}
