"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import { Coins, ShieldAlert, Sparkles, PieChart as PieIcon, BarChart3 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface DashboardChartsProps {
  data: {
    metalBreakdown: Array<{ name: string; count: number; value: number; fill: string }>;
    statusBreakdown: Array<{ name: string; count: number; value: number; fill: string }>;
    monthlyTrend: Array<{ month: string; disbursed: number; collected: number }>;
  };
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color?: string;
  fill?: string;
  payload: {
    count?: number;
    fill?: string;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const formatINR = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
  return `₹${val}`;
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[160px] backdrop-blur-xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <p
          className="font-bold pb-1 mb-1"
          style={{
            color: "var(--text-primary)",
            borderBottom: "1px solid var(--border-secondary)",
          }}
        >
          {label}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <span
              className="flex items-center gap-1.5 font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>
              {new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }).format(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div
        className="p-3 rounded-xl shadow-xl text-xs space-y-1 min-w-[140px] backdrop-blur-xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center gap-2 font-bold" style={{ color: "var(--text-primary)" }}>
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.payload.fill || entry.fill }}
          />
          {entry.name}
        </div>
        <p style={{ color: "var(--text-tertiary)" }}>
          Valuation:{" "}
          <span className="font-bold" style={{ color: "var(--accent-text)" }}>
            {new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(entry.value)}
          </span>
        </p>
        <p style={{ color: "var(--text-tertiary)" }}>
          Accounts:{" "}
          <span className="font-bold" style={{ color: "var(--text-primary)" }}>
            {entry.payload.count} loans
          </span>
        </p>
      </div>
    );
  }
  return null;
};

export function DashboardCharts({ data }: DashboardChartsProps) {
  const [activeTab, setActiveTab] = useState<"trend" | "portfolio">("trend");
  const { theme } = useTheme();

  const axisColor = theme === "light" ? "#94a3b8" : "#64748b";
  const strokeLight = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-6 mb-8"
    >
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4"
        style={{ borderBottom: "1px solid var(--border-primary)" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--accent-bg)", color: "var(--accent-text)" }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <h3
              className="text-lg font-bold tracking-tight flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              Portfolio Analytics & Trends
            </h3>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Visualizing disbursement volume, collection velocity, and metal collateral valuation.
          </p>
        </div>

        <div
          className="flex items-center p-1 rounded-xl"
          style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)" }}
        >
          <button
            onClick={() => setActiveTab("trend")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={
              activeTab === "trend"
                ? {
                    background: "var(--bg-card)",
                    color: "var(--accent-text)",
                    boxShadow: "var(--shadow-sm)",
                    border: "1px solid var(--border-primary)",
                  }
                : { color: "var(--text-muted)", border: "1px solid transparent" }
            }
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Cashflow Trends
          </button>
          <button
            onClick={() => setActiveTab("portfolio")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={
              activeTab === "portfolio"
                ? {
                    background: "var(--bg-card)",
                    color: "var(--accent-text)",
                    boxShadow: "var(--shadow-sm)",
                    border: "1px solid var(--border-primary)",
                  }
                : { color: "var(--text-muted)", border: "1px solid transparent" }
            }
          >
            <PieIcon className="w-3.5 h-3.5" />
            Collateral & Status
          </button>
        </div>
      </div>

      {activeTab === "trend" ? (
        <div className="space-y-4">
          <div
            className="flex items-center justify-between text-xs px-2"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded inline-block"
                style={{ backgroundColor: "#16a34a" }}
              />{" "}
              Disbursed Principal
            </span>
            <span className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded inline-block"
                style={{ backgroundColor: "#4ade80" }}
              />{" "}
              Collected Payments
            </span>
          </div>
          <div className="h-[300px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.monthlyTrend}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorDisbursed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  stroke={axisColor}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={axisColor}
                  fontSize={11}
                  tickFormatter={formatINR}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="disbursed"
                  name="Disbursed"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorDisbursed)"
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Collected"
                  stroke="#4ade80"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCollected)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Metal Breakdown */}
          <div
            className="p-4 rounded-xl flex flex-col items-center"
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-secondary)",
            }}
          >
            <h4
              className="text-xs font-bold uppercase tracking-wider mb-2 self-start flex items-center gap-1.5"
              style={{ color: "var(--text-muted)" }}
            >
              <Coins className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />
              Collateral Value by Metal Type
            </h4>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.metalBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.metalBreakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        stroke={strokeLight}
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-6 text-xs mt-2 w-full justify-center">
              {data.metalBreakdown.map((m) => (
                <div key={m.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.fill }} />
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
                    {m.name}:
                  </span>
                  <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                    {m.count} ({formatINR(m.value)})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Status Breakdown */}
          <div
            className="p-4 rounded-xl flex flex-col items-center"
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-secondary)",
            }}
          >
            <h4
              className="text-xs font-bold uppercase tracking-wider mb-2 self-start flex items-center gap-1.5"
              style={{ color: "var(--text-muted)" }}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
              Loan Account Status Distribution
            </h4>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.statusBreakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        stroke={strokeLight}
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs mt-2 w-full justify-center">
              {data.statusBreakdown.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.fill }} />
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
                    {s.name}:
                  </span>
                  <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
