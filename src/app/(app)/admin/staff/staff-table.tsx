"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { StaffActionsMenu } from "./staff-client";
import { ShieldCheck, CheckCircle2, XCircle, Clock } from "lucide-react";

export interface StaffRowData {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  _count: {
    loansHandled: number;
    paymentsCollected: number;
  };
  createdAt: string;
  isSelf: boolean;
}

interface StaffTableProps {
  data: StaffRowData[];
  isLoading?: boolean;
}

const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
};

export function StaffTable({ data, isLoading = false }: StaffTableProps) {
  const columns: ColumnDef<StaffRowData>[] = [
    {
      accessorKey: "name",
      header: "Staff Member",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 shadow-inner"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-text)",
                border: "1px solid var(--accent-border)",
              }}
            >
              {u.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div
                className="font-bold text-sm flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <span>{u.name}</span>
                {u.isSelf && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-normal"
                    style={{
                      background: "var(--bg-tertiary)",
                      color: "var(--text-tertiary)",
                      border: "1px solid var(--border-primary)",
                    }}
                  >
                    You
                  </span>
                )}
              </div>
              <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                {u.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Role Assignment",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <span
            className="text-[10px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1"
            style={{
              background: u.role === "ADMIN" ? "var(--accent-bg)" : "rgba(59, 130, 246, 0.1)",
              color: u.role === "ADMIN" ? "var(--accent-text)" : "#3b82f6",
              border:
                u.role === "ADMIN"
                  ? "1px solid var(--accent-border)"
                  : "1px solid rgba(59, 130, 246, 0.3)",
            }}
          >
            {u.role === "ADMIN" && <ShieldCheck className="w-3 h-3" />}
            {u.role}
          </span>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const u = row.original;
        return u.isActive ? (
          <span className="badge-verified text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Active</span>
          </span>
        ) : (
          <span className="badge-rejected text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold">
            <XCircle className="w-3 h-3" />
            <span>Deactivated</span>
          </span>
        );
      },
    },
    {
      id: "activity",
      header: "Activity Stats",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
            <span>
              Loans:{" "}
              <strong style={{ color: "var(--accent-text)" }}>{u._count.loansHandled}</strong>
            </span>
            <span className="mx-2" style={{ color: "var(--text-muted)" }}>
              |
            </span>
            <span>
              Receipts:{" "}
              <strong style={{ color: "var(--text-primary)" }}>{u._count.paymentsCollected}</strong>
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created Date",
      cell: ({ row }) => {
        return (
          <div
            className="text-xs flex items-center gap-1.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Clock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <span>{formatDate(row.original.createdAt)}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Access Controls",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="text-right" onClick={(e) => e.stopPropagation()}>
            <StaffActionsMenu user={u} isSelf={u.isSelf} />
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      searchKey="name"
      searchPlaceholder="Search staff by name, email, role..."
      emptyTitle="No Staff Accounts Found"
      emptyDescription="No institutional users matched your current search query."
      defaultPageSize={10}
    />
  );
}
