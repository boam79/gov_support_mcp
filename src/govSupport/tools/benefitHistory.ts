/**
 * manageBenefitHistory — 수혜 이력 관리 (PRD §4.9)
 *
 * Action: list | get | create | update | add_expense | add_milestone | delete
 */

import { z } from "zod";
import {
  listBenefitRecords,
  getBenefitRecord,
  saveBenefitRecord,
  deleteBenefitRecord,
  type BenefitRecord,
} from "../core/store.js";

// ─── 스키마 ───────────────────────────────────────────────────────────────────

const MilestoneSchema = z.object({
  name: z.string().min(1),
  dueDate: z.string(),
  completedAt: z.string().optional(),
  note: z.string().optional(),
});

const ExpenseSchema = z.object({
  category: z.string().min(1),
  amount: z.number().min(0),
  date: z.string(),
  description: z.string(),
  receipt: z.string().optional(),
});

export const ManageBenefitHistorySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    businessNumber: z.string().optional(),
  }),
  z.object({
    action: z.literal("get"),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal("create"),
    businessNumber: z.string().min(1),
    companyName: z.string().min(1),
    announcementId: z.string().min(1),
    announcementTitle: z.string().min(1),
    agency: z.string().min(1),
    approvedAmount: z.number().min(0),
    currency: z.string().default("KRW"),
    periodStart: z.string(),
    periodEnd: z.string(),
    status: z
      .enum(["신청중", "선정", "진행중", "완료", "취소"])
      .default("신청중"),
    memo: z.string().optional(),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().min(1),
    status: z.enum(["신청중", "선정", "진행중", "완료", "취소"]).optional(),
    usedAmount: z.number().min(0).optional(),
    memo: z.string().optional(),
  }),
  z.object({
    action: z.literal("add_expense"),
    id: z.string().min(1),
    expense: ExpenseSchema,
  }),
  z.object({
    action: z.literal("add_milestone"),
    id: z.string().min(1),
    milestone: MilestoneSchema,
  }),
  z.object({
    action: z.literal("delete"),
    id: z.string().min(1),
  }),
]);

export type ManageBenefitHistoryInput = z.infer<typeof ManageBenefitHistorySchema>;

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `bh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function summary(record: BenefitRecord) {
  const totalExpenses = record.expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = record.approvedAmount - record.usedAmount;
  const usageRate =
    record.approvedAmount > 0
      ? Math.round((record.usedAmount / record.approvedAmount) * 100)
      : 0;
  return {
    ...record,
    totalExpensesLogged: totalExpenses,
    remaining,
    usageRate: `${usageRate}%`,
  };
}

// ─── 핸들러 ───────────────────────────────────────────────────────────────────

export async function handleManageBenefitHistory(
  input: ManageBenefitHistoryInput
): Promise<unknown> {
  const now = new Date().toISOString();

  switch (input.action) {
    case "list": {
      const records = await listBenefitRecords(input.businessNumber);
      return {
        action: "list",
        count: records.length,
        records: records.map((r) => ({
          id: r.id,
          companyName: r.companyName,
          announcementTitle: r.announcementTitle,
          agency: r.agency,
          approvedAmount: r.approvedAmount,
          usedAmount: r.usedAmount,
          status: r.status,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          updatedAt: r.updatedAt,
        })),
      };
    }

    case "get": {
      const record = await getBenefitRecord(input.id);
      if (!record) {
        return { error: true, message: `수혜 이력 ID '${input.id}' 를 찾을 수 없습니다.` };
      }
      return { action: "get", record: summary(record) };
    }

    case "create": {
      const record: BenefitRecord = {
        id: generateId(),
        businessNumber: input.businessNumber,
        companyName: input.companyName,
        announcementId: input.announcementId,
        announcementTitle: input.announcementTitle,
        agency: input.agency,
        approvedAmount: input.approvedAmount,
        usedAmount: 0,
        currency: input.currency,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: input.status,
        milestones: [],
        expenses: [],
        memo: input.memo,
        createdAt: now,
        updatedAt: now,
      };
      await saveBenefitRecord(record);
      return { action: "create", success: true, record };
    }

    case "update": {
      const existing = await getBenefitRecord(input.id);
      if (!existing) {
        return { error: true, message: `수혜 이력 ID '${input.id}' 를 찾을 수 없습니다.` };
      }
      const updated: BenefitRecord = {
        ...existing,
        ...(input.status !== undefined && { status: input.status }),
        ...(input.usedAmount !== undefined && { usedAmount: input.usedAmount }),
        ...(input.memo !== undefined && { memo: input.memo }),
        updatedAt: now,
      };
      await saveBenefitRecord(updated);
      return { action: "update", success: true, record: summary(updated) };
    }

    case "add_expense": {
      const existing = await getBenefitRecord(input.id);
      if (!existing) {
        return { error: true, message: `수혜 이력 ID '${input.id}' 를 찾을 수 없습니다.` };
      }
      const updated: BenefitRecord = {
        ...existing,
        expenses: [...existing.expenses, input.expense],
        usedAmount: existing.usedAmount + input.expense.amount,
        updatedAt: now,
      };
      await saveBenefitRecord(updated);
      return {
        action: "add_expense",
        success: true,
        addedExpense: input.expense,
        newUsedAmount: updated.usedAmount,
        remaining: updated.approvedAmount - updated.usedAmount,
      };
    }

    case "add_milestone": {
      const existing = await getBenefitRecord(input.id);
      if (!existing) {
        return { error: true, message: `수혜 이력 ID '${input.id}' 를 찾을 수 없습니다.` };
      }
      const updated: BenefitRecord = {
        ...existing,
        milestones: [...existing.milestones, input.milestone],
        updatedAt: now,
      };
      await saveBenefitRecord(updated);
      return { action: "add_milestone", success: true, milestone: input.milestone };
    }

    case "delete": {
      const deleted = await deleteBenefitRecord(input.id);
      if (!deleted) {
        return { error: true, message: `수혜 이력 ID '${input.id}' 를 찾을 수 없습니다.` };
      }
      return { action: "delete", success: true, id: input.id };
    }
  }
}
