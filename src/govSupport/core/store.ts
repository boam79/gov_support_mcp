/**
 * JSON 파일 기반 영속성 저장소 (PRD §3.5 Repository Pattern)
 *
 * data/
 *   alertProfiles.json      — 알림 프로파일
 *   benefitHistory.json     — 수혜 이력
 *   companyProfiles.json    — 회사 프로파일
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../data");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(filename: string, defaults: T): Promise<T> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return defaults;
  }
}

async function writeJson<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ─── 알림 프로파일 저장소 ───────────────────────────────────────────────────

export interface AlertProfile {
  id: string;
  name: string;
  keywords: string[];
  fields: string[];
  regions: string[];
  targetTypes: string[];
  sources: string[];
  createdAt: string;
  updatedAt: string;
}

interface AlertStore {
  profiles: AlertProfile[];
}

export async function listAlertProfiles(): Promise<AlertProfile[]> {
  const store = await readJson<AlertStore>("alertProfiles.json", { profiles: [] });
  return store.profiles;
}

export async function getAlertProfile(id: string): Promise<AlertProfile | undefined> {
  const store = await readJson<AlertStore>("alertProfiles.json", { profiles: [] });
  return store.profiles.find((p) => p.id === id);
}

export async function saveAlertProfile(profile: AlertProfile): Promise<void> {
  const store = await readJson<AlertStore>("alertProfiles.json", { profiles: [] });
  const idx = store.profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    store.profiles[idx] = profile;
  } else {
    store.profiles.push(profile);
  }
  await writeJson("alertProfiles.json", store);
}

export async function deleteAlertProfile(id: string): Promise<boolean> {
  const store = await readJson<AlertStore>("alertProfiles.json", { profiles: [] });
  const before = store.profiles.length;
  store.profiles = store.profiles.filter((p) => p.id !== id);
  await writeJson("alertProfiles.json", store);
  return store.profiles.length < before;
}

// ─── 수혜 이력 저장소 ────────────────────────────────────────────────────────

export interface BenefitRecord {
  id: string;
  businessNumber: string;
  companyName: string;
  announcementId: string;
  announcementTitle: string;
  agency: string;
  approvedAmount: number;
  usedAmount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: "신청중" | "선정" | "진행중" | "완료" | "취소";
  milestones: {
    name: string;
    dueDate: string;
    completedAt?: string;
    note?: string;
  }[];
  expenses: {
    category: string;
    amount: number;
    date: string;
    description: string;
    receipt?: string;
  }[];
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

interface BenefitStore {
  records: BenefitRecord[];
}

export async function listBenefitRecords(businessNumber?: string): Promise<BenefitRecord[]> {
  const store = await readJson<BenefitStore>("benefitHistory.json", { records: [] });
  if (businessNumber) {
    return store.records.filter((r) => r.businessNumber === businessNumber);
  }
  return store.records;
}

export async function getBenefitRecord(id: string): Promise<BenefitRecord | undefined> {
  const store = await readJson<BenefitStore>("benefitHistory.json", { records: [] });
  return store.records.find((r) => r.id === id);
}

export async function saveBenefitRecord(record: BenefitRecord): Promise<void> {
  const store = await readJson<BenefitStore>("benefitHistory.json", { records: [] });
  const idx = store.records.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    store.records[idx] = record;
  } else {
    store.records.push(record);
  }
  await writeJson("benefitHistory.json", store);
}

export async function deleteBenefitRecord(id: string): Promise<boolean> {
  const store = await readJson<BenefitStore>("benefitHistory.json", { records: [] });
  const before = store.records.length;
  store.records = store.records.filter((r) => r.id !== id);
  await writeJson("benefitHistory.json", store);
  return store.records.length < before;
}

// ─── 회사 프로파일 저장소 ──────────────────────────────────────────────────

export interface StoredCompanyProfile {
  businessNumber: string;
  companyName: string;
  businessType: "법인" | "개인";
  industry: string;
  ksicCode: string;
  employeeCount: number;
  annualRevenue: number;
  foundedDate: string;
  regionHeadOffice?: string;
  regionWorksite?: string;
  companySizeClass?: string;
  certifications: string[];
  hasLab?: boolean;
  isSmes24Member: boolean;
  medicalInstitutionType?: string;
  bedCount?: number;
  isNonProfit?: boolean;
  updatedAt: string;
}

interface CompanyStore {
  profiles: StoredCompanyProfile[];
}

export async function getCompanyProfile(
  businessNumber: string
): Promise<StoredCompanyProfile | undefined> {
  const store = await readJson<CompanyStore>("companyProfiles.json", { profiles: [] });
  return store.profiles.find((p) => p.businessNumber === businessNumber);
}

export async function saveCompanyProfile(profile: StoredCompanyProfile): Promise<void> {
  const store = await readJson<CompanyStore>("companyProfiles.json", { profiles: [] });
  const idx = store.profiles.findIndex((p) => p.businessNumber === profile.businessNumber);
  if (idx >= 0) {
    store.profiles[idx] = profile;
  } else {
    store.profiles.push(profile);
  }
  await writeJson("companyProfiles.json", store);
}

export async function listCompanyProfiles(): Promise<StoredCompanyProfile[]> {
  const store = await readJson<CompanyStore>("companyProfiles.json", { profiles: [] });
  return store.profiles;
}
