"use server";

import { checkAuth } from "@/lib/auth/session";
import { getDashboardStats, getDashboardChartData, DashboardFilter } from "@/lib/services/dashboard";
import { serializeForClient } from "@/lib/serialize";
import { projectDashboardStats, projectDashboardChartData } from "@/lib/projection";

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

