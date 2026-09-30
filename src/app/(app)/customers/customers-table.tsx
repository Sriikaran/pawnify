"use client";

import React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Phone, MapPin, ShieldCheck, ShieldAlert, Clock, ArrowRight, Plus } from "lucide-react";

export interface CustomerRowData {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  city: string;
  state: string;
  _count: {
    loans: number;
  };
  kycDocuments: Array<{
    status: string;
  }>;
}

interface CustomersTableProps {
  data: CustomerRowData[];
  isLoading?: boolean;
}

const getKycBadge = (docs: Array<{ status: string }>) => {
  if (docs.length === 0) {
    return (
      <span className="badge-pending text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-medium">
        <Clock className="w-3 h-3" />
        <span>No KYC Docs</span>
      </span>
    );
  }
  const hasVerified = docs.some((d) => d.status === "VERIFIED");
  const hasRejected = docs.some((d) => d.status === "REJECTED");

  if (hasVerified) {
    return (
      <span className="badge-verified text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold">
        <ShieldCheck className="w-3 h-3" />
        <span>Verified KYC</span>
      </span>
    );
  }
  if (hasRejected) {
    return (
      <span className="badge-rejected text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold">
        <ShieldAlert className="w-3 h-3" />
        <span>Rejected</span>
      </span>
    );
  }
  return (
    <span className="badge-pending text-[10px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-medium">
      <Clock className="w-3 h-3" />
      <span>Pending Review</span>
    </span>
  );
};

export function CustomersTable({ data, isLoading = false }: CustomersTableProps) {
  const columns: ColumnDef<CustomerRowData>[] = [
    {
      accessorKey: "fullName",
      header: "Customer",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-white shadow-xs"
              style={{
                backgroundColor: "#C4B5A5",
              }}
            >
              {c.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <Link
                href={`/customers/${c.id}`}
                className="font-bold text-xs uppercase tracking-tight hover:underline transition-colors block"
                style={{ color: "var(--text-primary)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {c.fullName}
              </Link>
              {c.email && (
                <div
                  className="text-[11px] truncate max-w-[180px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {c.email}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Contact Info",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div
            className="flex items-center gap-1.5 font-mono text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span>{c.phone}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "city",
      header: "Location",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span>
              {c.city}, {c.state}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "_count.loans",
      header: "Active Loans",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <span
            className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono"
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          >
            {c._count.loans}
          </span>
        );
      },
    },
    {
      id: "kyc",
      header: "KYC Status",
      cell: ({ row }) => {
        return getKycBadge(row.original.kycDocuments);
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="text-right">
            <Link
              href={`/customers/${c.id}`}
              className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <span>View Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
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
      emptyTitle="No Customers Found"
      emptyDescription="No customer profiles matched your current search filters."
      emptyAction={
        <Link
          href="/customers/new"
          className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5 mt-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Register New Customer
        </Link>
      }
      defaultPageSize={10}
      onRowClick={(row) => {
        window.location.href = `/customers/${row.id}`;
      }}
    />
  );
}
