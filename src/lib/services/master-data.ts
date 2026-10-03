/**
 * Master Data Service — Metals & Purities
 *
 * Provides authoritative management and querying for metal types and purity standards.
 * Supports system-default metals (Gold, Silver) and operator-created metals/purities.
 * All fineness arithmetic is Decimal-safe.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

export interface MetalOption {
  id: string;
  metalKey: string;
  displayName: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface PurityOption {
  id: string;
  metalMasterId: string;
  label: string;
  purityPercent: number;
  finenessCode?: string | null;
  isSystem: boolean;
  isActive: boolean;
}

// System defaults to initialize if database is empty
const DEFAULT_METALS = [
  { metalKey: "GOLD", displayName: "Gold", isSystem: true },
  { metalKey: "SILVER", displayName: "Silver", isSystem: true },
];

const DEFAULT_PURITIES: Record<
  string,
  Array<{ label: string; purityPercent: number; finenessCode: string }>
> = {
  GOLD: [
    { label: "24K", purityPercent: 99.9, finenessCode: "999" },
    { label: "22K", purityPercent: 91.6, finenessCode: "916" },
    { label: "18K", purityPercent: 75.0, finenessCode: "750" },
    { label: "14K", purityPercent: 58.5, finenessCode: "585" },
  ],
  SILVER: [
    { label: "Fine Silver", purityPercent: 99.9, finenessCode: "999" },
    { label: "Sterling Silver", purityPercent: 92.5, finenessCode: "925" },
  ],
};

/**
 * Ensures system default metals and purities exist in the database.
 */
export async function ensureDefaultMasterData() {
  for (const m of DEFAULT_METALS) {
    const metal = await prisma.metalMaster.upsert({
      where: { metalKey: m.metalKey },
      create: {
        metalKey: m.metalKey,
        displayName: m.displayName,
        isSystem: true,
        isActive: true,
      },
      update: {},
    });

    const purities = DEFAULT_PURITIES[m.metalKey] || [];
    for (const p of purities) {
      await prisma.purityMaster.upsert({
        where: {
          metalMasterId_label: {
            metalMasterId: metal.id,
            label: p.label,
          },
        },
        create: {
          metalMasterId: metal.id,
          label: p.label,
          purityPercent: new Decimal(p.purityPercent),
          finenessCode: p.finenessCode,
          isSystem: true,
          isActive: true,
        },
        update: {},
      });
    }
  }
}

/**
 * Get all active metals.
 */
export async function getActiveMetals(): Promise<MetalOption[]> {
  try {
    let metals = await prisma.metalMaster.findMany({
      where: { isActive: true },
      orderBy: [{ isSystem: "desc" }, { displayName: "asc" }],
    });

    if (metals.length === 0) {
      await ensureDefaultMasterData();
      metals = await prisma.metalMaster.findMany({
        where: { isActive: true },
        orderBy: [{ isSystem: "desc" }, { displayName: "asc" }],
      });
    }

    return metals.map((m) => ({
      id: m.id,
      metalKey: m.metalKey,
      displayName: m.displayName,
      isSystem: m.isSystem,
      isActive: m.isActive,
    }));
  } catch (err) {
    console.error("Failed to query MetalMaster:", err);
    // Return hardcoded fallback if DB table not yet migrated
    return [
      { id: "gold-default", metalKey: "GOLD", displayName: "Gold", isSystem: true, isActive: true },
      { id: "silver-default", metalKey: "SILVER", displayName: "Silver", isSystem: true, isActive: true },
    ];
  }
}

/**
 * Create a new custom metal.
 */
export async function createCustomMetal(input: {
  displayName: string;
  createdById?: string;
}): Promise<MetalOption> {
  const trimmed = input.displayName.trim();
  if (!trimmed) {
    throw new Error("Metal name is required");
  }

  const metalKey = trimmed.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

  // Check if exists
  const existing = await prisma.metalMaster.findUnique({
    where: { metalKey },
  });

  if (existing) {
    if (!existing.isActive) {
      // Reactivate
      const reactivated = await prisma.metalMaster.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      return {
        id: reactivated.id,
        metalKey: reactivated.metalKey,
        displayName: reactivated.displayName,
        isSystem: reactivated.isSystem,
        isActive: reactivated.isActive,
      };
    }
    return {
      id: existing.id,
      metalKey: existing.metalKey,
      displayName: existing.displayName,
      isSystem: existing.isSystem,
      isActive: existing.isActive,
    };
  }

  const created = await prisma.metalMaster.create({
    data: {
      metalKey,
      displayName: trimmed,
      isSystem: false,
      isActive: true,
      createdById: input.createdById,
    },
  });

  return {
    id: created.id,
    metalKey: created.metalKey,
    displayName: created.displayName,
    isSystem: created.isSystem,
    isActive: created.isActive,
  };
}

/**
 * Get active purities for a given metal.
 */
export async function getActivePurities(metalKey: string): Promise<PurityOption[]> {
  try {
    const metal = await prisma.metalMaster.findUnique({
      where: { metalKey },
    });

    if (!metal) {
      // If metal not found in DB, return standard presets
      const defaults = DEFAULT_PURITIES[metalKey] || [];
      return defaults.map((d, idx) => ({
        id: `preset-${idx}`,
        metalMasterId: metalKey,
        label: d.label,
        purityPercent: d.purityPercent,
        finenessCode: d.finenessCode,
        isSystem: true,
        isActive: true,
      }));
    }

    let purities = await prisma.purityMaster.findMany({
      where: { metalMasterId: metal.id, isActive: true },
      orderBy: { purityPercent: "desc" },
    });

    if (purities.length === 0 && DEFAULT_PURITIES[metalKey]) {
      await ensureDefaultMasterData();
      purities = await prisma.purityMaster.findMany({
        where: { metalMasterId: metal.id, isActive: true },
        orderBy: { purityPercent: "desc" },
      });
    }

    return purities.map((p) => ({
      id: p.id,
      metalMasterId: p.metalMasterId,
      label: p.label,
      purityPercent: Number(p.purityPercent),
      finenessCode: p.finenessCode,
      isSystem: p.isSystem,
      isActive: p.isActive,
    }));
  } catch (err) {
    console.error("Failed to query PurityMaster:", err);
    const defaults = DEFAULT_PURITIES[metalKey] || [];
    return defaults.map((d, idx) => ({
      id: `preset-${idx}`,
      metalMasterId: metalKey,
      label: d.label,
      purityPercent: d.purityPercent,
      finenessCode: d.finenessCode,
      isSystem: true,
      isActive: true,
    }));
  }
}

/**
 * Create a new custom purity under a metal.
 */
export async function createCustomPurity(input: {
  metalKey: string;
  label: string;
  purityPercent: number;
  finenessCode?: string;
  createdById?: string;
}): Promise<PurityOption> {
  const label = input.label.trim();
  if (!label) throw new Error("Purity label is required");

  const pct = Number(input.purityPercent);
  if (isNaN(pct) || pct <= 0 || pct > 100) {
    throw new Error("Purity percentage must be between 0.01% and 100%");
  }

  // Find metal
  let metal = await prisma.metalMaster.findUnique({
    where: { metalKey: input.metalKey },
  });

  if (!metal) {
    // Auto-create metal record if it was system default
    metal = await prisma.metalMaster.create({
      data: {
        metalKey: input.metalKey,
        displayName: input.metalKey.charAt(0) + input.metalKey.slice(1).toLowerCase(),
        isSystem: input.metalKey === "GOLD" || input.metalKey === "SILVER",
      },
    });
  }

  const existing = await prisma.purityMaster.findUnique({
    where: {
      metalMasterId_label: {
        metalMasterId: metal.id,
        label,
      },
    },
  });

  if (existing) {
    const updated = await prisma.purityMaster.update({
      where: { id: existing.id },
      data: {
        purityPercent: new Decimal(pct),
        finenessCode: input.finenessCode || existing.finenessCode,
        isActive: true,
      },
    });
    return {
      id: updated.id,
      metalMasterId: updated.metalMasterId,
      label: updated.label,
      purityPercent: Number(updated.purityPercent),
      finenessCode: updated.finenessCode,
      isSystem: updated.isSystem,
      isActive: updated.isActive,
    };
  }

  const created = await prisma.purityMaster.create({
    data: {
      metalMasterId: metal.id,
      label,
      purityPercent: new Decimal(pct),
      finenessCode: input.finenessCode || `${Math.round(pct * 10)}`,
      isSystem: false,
      isActive: true,
      createdById: input.createdById,
    },
  });

  return {
    id: created.id,
    metalMasterId: created.metalMasterId,
    label: created.label,
    purityPercent: Number(created.purityPercent),
    finenessCode: created.finenessCode,
    isSystem: created.isSystem,
    isActive: created.isActive,
  };
}
