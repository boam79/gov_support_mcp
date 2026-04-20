/**
 * manageAlertProfile — 알림 프로파일 관리 (PRD §4.6)
 *
 * Action: create | update | delete | list | get
 */

import { z } from "zod";
import {
  listAlertProfiles,
  getAlertProfile,
  saveAlertProfile,
  deleteAlertProfile,
  type AlertProfile,
} from "../core/store.js";

// ─── 스키마 ───────────────────────────────────────────────────────────────────

export const ManageAlertProfileSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
  }),
  z.object({
    action: z.literal("get"),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal("create"),
    name: z.string().min(1).max(100),
    keywords: z.array(z.string()).optional().default([]),
    fields: z
      .array(z.enum(["창업", "금융", "기술", "인력", "수출", "내수", "경영", "기타"]))
      .optional()
      .default([]),
    regions: z.array(z.string()).optional().default([]),
    targetTypes: z
      .array(z.enum(["예비창업자", "초기창업", "중소기업", "중견기업", "소상공인"]))
      .optional()
      .default([]),
    sources: z
      .array(z.enum(["bizinfo", "kstartup", "smes24"]))
      .optional()
      .default(["bizinfo", "kstartup"]),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().min(1),
    name: z.string().min(1).max(100).optional(),
    keywords: z.array(z.string()).optional(),
    fields: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    targetTypes: z.array(z.string()).optional(),
    sources: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("delete"),
    id: z.string().min(1),
  }),
]);

export type ManageAlertProfileInput = z.infer<typeof ManageAlertProfileSchema>;

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `ap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── 핸들러 ───────────────────────────────────────────────────────────────────

export async function handleManageAlertProfile(input: ManageAlertProfileInput): Promise<unknown> {
  const now = new Date().toISOString();

  switch (input.action) {
    case "list": {
      const profiles = await listAlertProfiles();
      return {
        action: "list",
        count: profiles.length,
        profiles: profiles.map((p) => ({
          id: p.id,
          name: p.name,
          keywords: p.keywords,
          fields: p.fields,
          regions: p.regions,
          targetTypes: p.targetTypes,
          sources: p.sources,
          updatedAt: p.updatedAt,
        })),
      };
    }

    case "get": {
      const profile = await getAlertProfile(input.id);
      if (!profile) {
        return { error: true, message: `프로파일 ID '${input.id}' 를 찾을 수 없습니다.` };
      }
      return { action: "get", profile };
    }

    case "create": {
      const profile: AlertProfile = {
        id: generateId(),
        name: input.name,
        keywords: input.keywords,
        fields: input.fields,
        regions: input.regions,
        targetTypes: input.targetTypes,
        sources: input.sources,
        createdAt: now,
        updatedAt: now,
      };
      await saveAlertProfile(profile);
      return { action: "create", success: true, profile };
    }

    case "update": {
      const existing = await getAlertProfile(input.id);
      if (!existing) {
        return { error: true, message: `프로파일 ID '${input.id}' 를 찾을 수 없습니다.` };
      }
      const updated: AlertProfile = {
        ...existing,
        ...(input.name !== undefined && { name: input.name }),
        ...(input.keywords !== undefined && { keywords: input.keywords }),
        ...(input.fields !== undefined && { fields: input.fields }),
        ...(input.regions !== undefined && { regions: input.regions }),
        ...(input.targetTypes !== undefined && { targetTypes: input.targetTypes }),
        ...(input.sources !== undefined && { sources: input.sources }),
        updatedAt: now,
      };
      await saveAlertProfile(updated);
      return { action: "update", success: true, profile: updated };
    }

    case "delete": {
      const deleted = await deleteAlertProfile(input.id);
      if (!deleted) {
        return { error: true, message: `프로파일 ID '${input.id}' 를 찾을 수 없습니다.` };
      }
      return { action: "delete", success: true, id: input.id };
    }
  }
}
