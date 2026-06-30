// 许可证管理 — 免费版每日3次+水印，付费版永久解锁
"use client";

const STORAGE_KEY = "pdf-tool-license";
const USAGE_KEY = "pdf-tool-usage";
const USED_CODES_KEY = "pdf-tool-used-codes";
const DAILY_LIMIT = 3;

// 用于验证激活码的密钥
const SECRET = "pdf-tool-2026-secret-key-v1";

export interface LicenseState {
  activated: boolean;
  code?: string;
  activatedAt?: string;
}

export interface UsageState {
  date: string; // YYYY-MM-DD
  count: number;
}

/**
 * 获取当前许可证状态
 */
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

/**
 * 获取今日使用次数
 */
export function getUsage(): UsageState {
  if (typeof window === "undefined") return { date: today(), count: 0 };
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    const todayStr = today();
    if (!raw) return { date: todayStr, count: 0 };
    const usage = JSON.parse(raw) as UsageState;
    if (usage.date !== todayStr) {
      // 新的一天，重置
      const fresh = { date: todayStr, count: 0 };
      localStorage.setItem(USAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return usage;
  } catch {
    return { date: today(), count: 0 };
  }
}

/**
 * 记录一次使用
 */
export function recordUsage(): UsageState {
  const usage = getUsage();
  usage.count += 1;
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  return usage;
}

/**
 * 检查能否使用
 */
export function canUse(): boolean {
  const license = getLicense();
  if (license.activated) return true;
  const usage = getUsage();
  return usage.count < DAILY_LIMIT;
}

/**
 * 剩余免费次数
 */
export function remainingFree(): number {
  const license = getLicense();
  if (license.activated) return Infinity;
  const usage = getUsage();
  return Math.max(0, DAILY_LIMIT - usage.count);
}

/**
 * 验证并激活许可证
 */
export function activateLicense(code: string): { success: boolean; message: string } {
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

/**
 * 验证激活码（简化版 HMAC 校验）
 */
function validateCode(code: string): boolean {
  // 取 code 中 "-" 后面的部分
  const payload = code.replace("PT-", "");
  // 用内置的简单校验算法
  return simpleHash(payload + SECRET).startsWith(payload.slice(0, 4));
}

/**
 * 简单哈希函数（纯 JS，无需 crypto）
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  // 转为 hex
  const h = (hash >>> 0).toString(16).padStart(8, "0");
  return h + h.slice(0, 4); // 12 位 hex
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 生成一个未使用过的激活码
 */
export function generateActivationCode(): string {
  const usedCodes = getUsedCodes();

  let code: string;
  let attempts = 0;
  do {
    // 生成随机 8 位 hex
    const rand = Array.from({ length: 8 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    const hash = simpleHash(rand + SECRET);
    const suffix = hash.slice(0, 4);
    code = `PT-${rand}${suffix}`;
    attempts++;
  } while (usedCodes.has(code) && attempts < 100);

  // 记录已使用
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
