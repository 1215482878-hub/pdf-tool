// 许可证管理 — 免费版每日3次+水印，付费版永久解锁
// 使用设备指纹跨浏览器追踪用量，换浏览器不重置
"use client";

import { getFingerprint } from "./fingerprint";

const STORAGE_KEY = "pdf-tool-license";
const USAGE_PREFIX = "pdf-tool-usage-";
const USED_CODES_KEY = "pdf-tool-used-codes";
const DAILY_LIMIT = 3;

const SECRET = "pdf-tool-2026-secret-key-v1";

export interface LicenseState {
  activated: boolean;
  code?: string;
  activatedAt?: string;
}

interface UsageData {
  date: string;
  count: number;
}

function usageKey(): string {
  return USAGE_PREFIX + getFingerprint();
}

export function getLicense(): LicenseState {
  if (typeof window === "undefined") return { activated: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activated: false };
    return JSON.parse(raw) as LicenseState;
  } catch {
    return { activated: false };
  }
}

export function getUsage(): UsageData {
  if (typeof window === "undefined") return { date: today(), count: 0 };
  try {
    const raw = localStorage.getItem(usageKey());
    const todayStr = today();
    if (!raw) return { date: todayStr, count: 0 };
    const data = JSON.parse(raw) as UsageData;
    if (data.date !== todayStr) {
      const fresh = { date: todayStr, count: 0 };
      localStorage.setItem(usageKey(), JSON.stringify(fresh));
      return fresh;
    }
    return data;
  } catch {
    return { date: today(), count: 0 };
  }
}

export function recordUsage(): UsageData {
  const usage = getUsage();
  usage.count += 1;
  localStorage.setItem(usageKey(), JSON.stringify(usage));
  return usage;
}

export function canUse(): boolean {
  const license = getLicense();
  if (license.activated) return true;
  return getUsage().count < DAILY_LIMIT;
}

export function remainingFree(): number {
  const license = getLicense();
  if (license.activated) return Infinity;
  return Math.max(0, DAILY_LIMIT - getUsage().count);
}

export function activateLicense(
  code: string
): { success: boolean; message: string } {
  const cleanCode = code.trim().toUpperCase();

  if (!cleanCode.startsWith("PT-") || cleanCode.length !== 13) {
    return { success: false, message: "激活码格式错误" };
  }

  if (!validateCode(cleanCode)) {
    return { success: false, message: "激活码无效" };
  }

  const license: LicenseState = {
    activated: true,
    code: cleanCode,
    activatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(license));
  return { success: true, message: "激活成功！永久解锁全部功能" };
}

function validateCode(code: string): boolean {
  const payload = code.replace("PT-", "");
  return simpleHash(payload + SECRET).startsWith(payload.slice(0, 4));
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const h = (hash >>> 0).toString(16).padStart(8, "0");
  return h + h.slice(0, 4);
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function generateActivationCode(): string {
  const usedCodes = getUsedCodes();

  let code: string;
  let attempts = 0;
  do {
    const rand = Array.from({ length: 8 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    const hash = simpleHash(rand + SECRET);
    const suffix = hash.slice(0, 4);
    code = `PT-${rand}${suffix}`;
    attempts++;
  } while (usedCodes.has(code) && attempts < 100);

  usedCodes.add(code);
  saveUsedCodes(usedCodes);

  return code;
}

function getUsedCodes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(USED_CODES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveUsedCodes(codes: Set<string>): void {
  localStorage.setItem(USED_CODES_KEY, JSON.stringify([...codes]));
}
