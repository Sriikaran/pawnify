/**
 * Settings Service — AppSetting CRUD
 * Business-rule knobs that should never be hardcoded in application code.
 */

import { prisma } from "@/lib/db";

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function getSettings() {
  return await prisma.appSetting.findMany({
    orderBy: { key: "asc" },
  });
}

export async function updateSetting(key: string, value: string) {
  return await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function updateSettings(settings: Array<{ key: string; value: string }>) {
  return await prisma.$transaction(
    settings.map((s) =>
      prisma.appSetting.upsert({
        where: { key: s.key },
        update: { value: s.value },
        create: { key: s.key, value: s.value },
      })
    )
  );
}

/**
 * Grouped settings for the admin UI.
 */
export function groupSettings(
  settings: Array<{ key: string; value: string }>
): Record<string, Array<{ key: string; value: string; label: string }>> {
  const groups: Record<string, Array<{ key: string; value: string; label: string }>> = {
    "LTV Slabs": [],
    Interest: [],
    "Grace Period": [],
    "PAN Threshold": [],
    Other: [],
  };

  const labelMap: Record<string, { group: string; label: string }> = {
    "ltv.tier1.max": { group: "LTV Slabs", label: "Tier 1 Max Value (₹)" },
    "ltv.tier1.percent": { group: "LTV Slabs", label: "Tier 1 LTV (%)" },
    "ltv.tier2.max": { group: "LTV Slabs", label: "Tier 2 Max Value (₹)" },
    "ltv.tier2.percent": { group: "LTV Slabs", label: "Tier 2 LTV (%)" },
    "ltv.tier3.percent": { group: "LTV Slabs", label: "Tier 3 LTV (%)" },
    "interest.default.monthly": { group: "Interest", label: "Default Monthly Rate (%)" },
    "grace.period.days": { group: "Grace Period", label: "Grace Period (days)" },
    "pan.threshold": { group: "PAN Threshold", label: "PAN Required Above (₹)" },
  };

  for (const setting of settings) {
    const meta = labelMap[setting.key];
    if (meta) {
      groups[meta.group].push({ ...setting, label: meta.label });
    } else {
      groups["Other"].push({ ...setting, label: setting.key });
    }
  }

  for (const key of Object.keys(groups)) {
    if (groups[key].length === 0) delete groups[key];
  }

  return groups;
}
