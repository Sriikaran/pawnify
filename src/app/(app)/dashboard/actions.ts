"use server";

import { checkAuth, checkAdmin } from "@/lib/auth/session";
import { getDashboardStats, getDashboardChartData, DashboardFilter } from "@/lib/services/dashboard";
import { serializeForClient } from "@/lib/serialize";
import { projectDashboardStats, projectDashboardChartData } from "@/lib/projection";
import { updateSettings } from "@/lib/services/settings";

export async function getDashboardDataAction(filter?: DashboardFilter) {
  const auth = await checkAuth();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const [stats, chartData] = await Promise.all([getDashboardStats(filter), getDashboardChartData()]);

  const projectedStats = projectDashboardStats(stats, auth.calculationMode);
  const projectedChartData = projectDashboardChartData(chartData, auth.calculationMode);

  return serializeForClient({ stats: projectedStats, chartData: projectedChartData });
}

export async function updateMetalRatesAction(
  goldRate: number | string,
  silverRate: number | string
) {
  const auth = await checkAdmin();
  if (!auth.authenticated) {
    throw new Error(auth.error);
  }

  const gold = typeof goldRate === "number" ? goldRate : parseFloat(String(goldRate).trim());
  const silver = typeof silverRate === "number" ? silverRate : parseFloat(String(silverRate).trim());

  if (isNaN(gold) || gold <= 0) {
    throw new Error("Invalid gold rate: must be a positive number");
  }
  if (isNaN(silver) || silver <= 0) {
    throw new Error("Invalid silver rate: must be a positive number");
  }

  const nowIso = new Date().toISOString();
  await updateSettings([
    { key: "rate.gold.per_gram", value: gold.toString() },
    { key: "rate.silver.per_gram", value: silver.toString() },
    { key: "rate.last_updated", value: nowIso },
  ]);

  return serializeForClient({
    success: true,
    goldRate: gold,
    silverRate: silver,
    lastUpdated: nowIso,
  });
}
