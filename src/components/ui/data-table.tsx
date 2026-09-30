"use client";

import React, { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Inbox,
  Search,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  searchKey?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  defaultPageSize?: number;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  searchKey,
  searchPlaceholder = "Filter results...",
  emptyTitle = "No records found",
  emptyDescription = "No data matches your current filters or search query.",
  emptyAction,
  defaultPageSize = 10,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [{ pageIndex, pageSize }, setPagination] = useState({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4 w-full">
      {/* Search Input if enabled */}
      {searchKey && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="input-field pl-10 text-xs py-2 w-full"
            />
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="glass-card overflow-hidden" style={{ borderColor: "var(--border-card)" }}>
        <div className="overflow-x-auto min-h-[380px]">
          <table className="data-table w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        className={
                          canSort
                            ? "cursor-pointer select-none hover:opacity-80 transition-opacity"
                            : ""
                        }
                      >
                        <div className="flex items-center gap-1.5">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className="inline-flex shrink-0">
                              {header.column.getIsSorted() === "asc" ? (
                                <ArrowUp
                                  className="w-3.5 h-3.5"
                                  style={{ color: "var(--accent-text)" }}
                                />
                              ) : header.column.getIsSorted() === "desc" ? (
                                <ArrowDown
                                  className="w-3.5 h-3.5"
                                  style={{ color: "var(--accent-text)" }}
                                />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((_, colIndex) => (
                      <td key={colIndex} className="py-4">
                        <Skeleton variant="text" className="w-full h-5" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={onRowClick ? "cursor-pointer transition-colors" : ""}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-64 text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: "var(--accent-bg)", color: "var(--accent-text)" }}
                      >
                        <Inbox className="w-7 h-7" />
                      </div>
                      <div>
                        <div
                          className="text-base font-bold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {emptyTitle}
                        </div>
                        <div
                          className="text-xs mt-1 max-w-sm mx-auto"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {emptyDescription}
                        </div>
                      </div>
                      {emptyAction && <div className="pt-2">{emptyAction}</div>}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {!isLoading && data.length > 0 && (
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 text-xs font-medium"
            style={{
              borderTop: "1px solid var(--border-secondary)",
              background: "var(--bg-secondary)",
            }}
          >
            <div className="flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
              <span>Showing</span>
              <strong style={{ color: "var(--text-primary)" }}>
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
              </strong>
              <span>to</span>
              <strong style={{ color: "var(--text-primary)" }}>
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) *
                    table.getState().pagination.pageSize,
                  data.length
                )}
              </strong>
              <span>of</span>
              <strong style={{ color: "var(--text-primary)" }}>{data.length}</strong>
              <span>records</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--text-tertiary)" }}>Rows per page:</span>
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => {
                    table.setPageSize(Number(e.target.value));
                  }}
                  className="input-field py-1 px-2 text-xs w-auto"
                >
                  {[5, 10, 15, 20, 50].map((pageSizeOption) => (
                    <option key={pageSizeOption} value={pageSizeOption}>
                      {pageSizeOption}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="p-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    borderColor: "var(--border-primary)",
                    background: "var(--bg-card)",
                    color: "var(--text-secondary)",
                  }}
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1 px-2.5"
                  style={{
                    borderColor: "var(--border-primary)",
                    background: "var(--bg-card)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev</span>
                </button>
                <span className="px-2 font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                  {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
                </span>
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1 px-2.5"
                  style={{
                    borderColor: "var(--border-primary)",
                    background: "var(--bg-card)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className="p-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    borderColor: "var(--border-primary)",
                    background: "var(--bg-card)",
                    color: "var(--text-secondary)",
                  }}
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
