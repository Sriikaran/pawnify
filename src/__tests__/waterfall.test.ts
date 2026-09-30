import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

// Recreate pure waterfall logic to test standalone atomic allocation rules (§6.4)
function computePaymentWaterfall(
  amountPaid: Prisma.Decimal,
  unsettledCharges: Prisma.Decimal,
  accruedInterest: Prisma.Decimal,
  principalOutstanding: Prisma.Decimal
) {
  let remaining = new Prisma.Decimal(amountPaid);

  // 1. Charges
  const allocatedCharges = Prisma.Decimal.min(remaining, unsettledCharges);
  remaining = remaining.minus(allocatedCharges);

  // 2. Interest
  const allocatedInterest = Prisma.Decimal.min(remaining, accruedInterest);
  remaining = remaining.minus(allocatedInterest);

  // 3. Principal
  const allocatedPrincipal = Prisma.Decimal.min(remaining, principalOutstanding);
  remaining = remaining.minus(allocatedPrincipal);

  return {
    allocatedCharges,
    allocatedInterest,
    allocatedPrincipal,
    remaining,
  };
}

describe("Atomic Repayment Waterfall Allocation (§6.4)", () => {
  it("allocates entirely to charges when payment is less than total unsettled charges", () => {
    const res = computePaymentWaterfall(
      new Prisma.Decimal("300"), // Paid 300
      new Prisma.Decimal("500"), // Charges 500
      new Prisma.Decimal("1500"), // Interest 1500
      new Prisma.Decimal("50000") // Principal 50000
    );

    expect(res.allocatedCharges.toString()).toBe("300");
    expect(res.allocatedInterest.toString()).toBe("0");
    expect(res.allocatedPrincipal.toString()).toBe("0");
    expect(res.remaining.toString()).toBe("0");
  });

  it("spills over to interest after settling all charges", () => {
    const res = computePaymentWaterfall(
      new Prisma.Decimal("1000"), // Paid 1000
      new Prisma.Decimal("400"), // Charges 400 -> leaves 600
      new Prisma.Decimal("1500"), // Interest 1500 -> absorbs 600
      new Prisma.Decimal("50000") // Principal 50000
    );

    expect(res.allocatedCharges.toString()).toBe("400");
    expect(res.allocatedInterest.toString()).toBe("600");
    expect(res.allocatedPrincipal.toString()).toBe("0");
  });

  it("spills over to principal after settling both charges and interest", () => {
    const res = computePaymentWaterfall(
      new Prisma.Decimal("12000"), // Paid 12000
      new Prisma.Decimal("500"), // Charges 500 -> leaves 11500
      new Prisma.Decimal("1500"), // Interest 1500 -> leaves 10000
      new Prisma.Decimal("50000") // Principal 50000 -> absorbs 10000
    );

    expect(res.allocatedCharges.toString()).toBe("500");
    expect(res.allocatedInterest.toString()).toBe("1500");
    expect(res.allocatedPrincipal.toString()).toBe("10000");
    expect(res.remaining.toString()).toBe("0");
  });

  it("correctly handles full settlement of loan", () => {
    const res = computePaymentWaterfall(
      new Prisma.Decimal("52000"), // Paid exactly total due
      new Prisma.Decimal("500"),
      new Prisma.Decimal("1500"),
      new Prisma.Decimal("50000")
    );

    expect(res.allocatedCharges.toString()).toBe("500");
    expect(res.allocatedInterest.toString()).toBe("1500");
    expect(res.allocatedPrincipal.toString()).toBe("50000");
    expect(res.remaining.toString()).toBe("0");
  });
});
