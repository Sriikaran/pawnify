import { api } from "./baseApi";
import {
  getReportsDataAction,
  getLoanRegisterReportAction,
  getPaymentRegisterReportAction,
  getDisbursementRegisterReportAction,
  getOverdueLoansReportAction,
  getCustomerWiseLoanSummaryReportAction,
  getAccountWiseFinancialSummaryReportAction,
  getDayBookSummaryReportAction,
  getPortfolioSummaryReportAction,
  getTransactionHistoryReportAction,
} from "@/app/(app)/reports/actions";
import type {
  LoanRegisterFilter,
  PaymentRegisterFilter,
  DisbursementRegisterFilter,
  OverdueLoansFilter,
  CustomerWiseSummaryFilter,
  AccountWiseSummaryFilter,
  DayBookSummaryFilter,
  PortfolioSummaryFilter,
  TransactionHistoryFilter,
} from "@/lib/services/reports";

export type ReportsData = Awaited<ReturnType<typeof getReportsDataAction>>;
export type LoanRegisterData = Awaited<ReturnType<typeof getLoanRegisterReportAction>>;
export type PaymentRegisterData = Awaited<ReturnType<typeof getPaymentRegisterReportAction>>;
export type DisbursementRegisterData = Awaited<ReturnType<typeof getDisbursementRegisterReportAction>>;
export type OverdueLoansData = Awaited<ReturnType<typeof getOverdueLoansReportAction>>;
export type CustomerWiseSummaryData = Awaited<ReturnType<typeof getCustomerWiseLoanSummaryReportAction>>;
export type AccountWiseSummaryData = Awaited<ReturnType<typeof getAccountWiseFinancialSummaryReportAction>>;
export type DayBookSummaryReportData = Awaited<ReturnType<typeof getDayBookSummaryReportAction>>;
export type PortfolioSummaryData = Awaited<ReturnType<typeof getPortfolioSummaryReportAction>>;
export type TransactionHistoryData = Awaited<ReturnType<typeof getTransactionHistoryReportAction>>;

export const reportsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getReportsData: builder.query<ReportsData, void>({
      query: () => ({ action: getReportsDataAction, args: [] }),
      providesTags: ["Report"],
    }),
    getLoanRegister: builder.query<LoanRegisterData, LoanRegisterFilter | void>({
      query: (filter) => ({ action: getLoanRegisterReportAction, args: filter ? [filter] : [] }),
      providesTags: ["Report"],
    }),
    getPaymentRegister: builder.query<PaymentRegisterData, PaymentRegisterFilter | void>({
      query: (filter) => ({ action: getPaymentRegisterReportAction, args: filter ? [filter] : [] }),
      providesTags: ["Report"],
    }),
    getDisbursementRegister: builder.query<DisbursementRegisterData, DisbursementRegisterFilter | void>({
      query: (filter) => ({ action: getDisbursementRegisterReportAction, args: filter ? [filter] : [] }),
      providesTags: ["Report"],
    }),
    getOverdueLoans: builder.query<OverdueLoansData, OverdueLoansFilter | void>({
      query: (filter) => ({ action: getOverdueLoansReportAction, args: filter ? [filter] : [] }),
      providesTags: ["Report"],
    }),
    getCustomerWiseSummary: builder.query<CustomerWiseSummaryData, CustomerWiseSummaryFilter | void>({
      query: (filter) => ({ action: getCustomerWiseLoanSummaryReportAction, args: filter ? [filter] : [] }),
      providesTags: ["Report"],
    }),
    getAccountWiseSummary: builder.query<AccountWiseSummaryData, AccountWiseSummaryFilter | void>({
      query: (filter) => ({ action: getAccountWiseFinancialSummaryReportAction, args: filter ? [filter] : [] }),
      providesTags: ["Report"],
    }),
    getDayBookSummaryReport: builder.query<DayBookSummaryReportData, DayBookSummaryFilter | void>({
      query: (filter) => ({ action: getDayBookSummaryReportAction, args: filter ? [filter] : [] }),
      providesTags: ["Report"],
    }),
    getPortfolioSummary: builder.query<PortfolioSummaryData, PortfolioSummaryFilter | void>({
      query: (filter) => ({ action: getPortfolioSummaryReportAction, args: filter ? [filter] : [] }),
      providesTags: ["Report"],
    }),
    getTransactionHistory: builder.query<TransactionHistoryData, TransactionHistoryFilter | void>({
      query: (filter) => ({ action: getTransactionHistoryReportAction, args: filter ? [filter] : [] }),
      providesTags: ["Report"],
    }),
  }),
});

export const {
  useGetReportsDataQuery,
  useGetLoanRegisterQuery,
  useGetPaymentRegisterQuery,
  useGetDisbursementRegisterQuery,
  useGetOverdueLoansQuery,
  useGetCustomerWiseSummaryQuery,
  useGetAccountWiseSummaryQuery,
  useGetDayBookSummaryReportQuery,
  useGetPortfolioSummaryQuery,
  useGetTransactionHistoryQuery,
} = reportsApi;
