/**
 * Customer Service — CRUD, Search, KYC Management
 */

import { Prisma, KycStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

// ==================== Types ====================

export interface CustomerCreateData {
  fullName: string;
  phone: string;
  email?: string;
  dob?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  photoUrl?: string;
  kycDocuments?: Array<{
    docType: "AADHAAR" | "PAN" | "VOTER_ID" | "PASSPORT" | "DRIVING_LICENSE";
    docNumber: string;
    fileUrl?: string;
  }>;
}

export interface CustomerFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

// ==================== CRUD ====================

export async function createCustomer(data: CustomerCreateData, staffId: string) {
  return await prisma.customer.create({
    data: {
      fullName: data.fullName,
      phone: data.phone,
      email: data.email || null,
      dob: data.dob ? new Date(data.dob) : null,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || null,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      photoUrl: data.photoUrl || null,
      createdById: staffId,
      kycDocuments: data.kycDocuments?.length
        ? {
            create: data.kycDocuments.map((doc) => ({
              docType: doc.docType,
              docNumber: doc.docNumber,
              fileUrl: doc.fileUrl || null,
            })),
          }
        : undefined,
    },
    include: { kycDocuments: true },
  });
}

export async function getCustomers(filters: CustomerFilters = {}) {
  const { page = 1, pageSize = 20, search } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.CustomerWhereInput = {};

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        kycDocuments: { select: { docType: true, status: true } },
        _count: { select: { loans: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getCustomerById(id: string) {
  return await prisma.customer.findUnique({
    where: { id },
    include: {
      kycDocuments: true,
      createdBy: { select: { id: true, name: true } },
      loans: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          loanNumber: true,
          loanDate: true,
          dueDate: true,
          gracePeriodDays: true,
          principalAmount: true,
          principalOutstanding: true,
          status: true,
          totalAssessedValue: true,
        },
      },
    },
  });
}

/**
 * Typeahead search for customer selection in loan creation.
 */
export async function searchCustomers(query: string, limit = 10) {
  if (!query || query.length < 2) return [];

  return await prisma.customer.findMany({
    where: {
      OR: [{ fullName: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }],
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      city: true,
    },
    take: limit,
    orderBy: { fullName: "asc" },
  });
}

// ==================== KYC ====================

export async function updateKycStatus(docId: string, status: KycStatus, verifiedById: string) {
  return await prisma.kycDocument.update({
    where: { id: docId },
    data: {
      status,
      verifiedById: status !== "PENDING" ? verifiedById : null,
    },
  });
}

export async function addKycDocument(
  customerId: string,
  docType: "AADHAAR" | "PAN" | "VOTER_ID" | "PASSPORT" | "DRIVING_LICENSE",
  docNumber: string,
  fileUrl?: string
) {
  return await prisma.kycDocument.create({
    data: {
      customerId,
      docType,
      docNumber,
      fileUrl: fileUrl || null,
    },
  });
}

/**
 * Check if PAN is required based on loan amount threshold.
 * Default threshold: ₹50,000 (configurable via AppSetting).
 */
export async function checkPanRequired(customerId: string): Promise<{
  required: boolean;
  hasPan: boolean;
  threshold: number;
}> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "pan.threshold" },
  });
  const threshold = setting ? parseFloat(setting.value) : 50000;

  const [panDoc, totalDisbursed] = await Promise.all([
    prisma.kycDocument.findFirst({
      where: { customerId, docType: "PAN" },
    }),
    prisma.loan.aggregate({
      where: { customerId, status: "ACTIVE" },
      _sum: { principalAmount: true },
    }),
  ]);

  const totalAmount = totalDisbursed._sum.principalAmount
    ? parseFloat(totalDisbursed._sum.principalAmount.toString())
    : 0;

  return {
    required: totalAmount >= threshold,
    hasPan: panDoc !== null,
    threshold,
  };
}
