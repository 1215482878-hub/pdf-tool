// 设备指纹 — 跨浏览器识别同一设备
// 结合屏幕分辨率、时区、Canvas 指纹等特征生成唯一标识
"use client";

const FP_KEY = "pdf-tool-fingerprint";

/**
 * 生成设备指纹（跨浏览器稳定，同设备不同浏览器生成相同指纹）
 * 同时存入多个存储位置防止单一清除
 */
export function getFingerprint(): string {
  const existing = getStored();
  if (existing) return existing;

  // 仅使用跨浏览器稳定的特征
  const components: string[] = [
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform || "unknown",
    getCanvasFingerprint(),
    getWebGLFingerprint(),
  ];

  const raw = components.join("|");
  const hash = simpleHash(raw);
  storeFingerprint(hash);
  return hash;
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Device Fingerprint 设备指纹", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Device Fingerprint 设备指纹", 4, 17);

    return canvas.toDataURL().slice(0, 120);
  } catch {
    return "canvas-error";
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return "no-webgl";

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      return `${gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)}`;
    }
    return "webgl-no-debug";
  } catch {
    return "webgl-error";
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return (hash >>> 0).toString(36).padStart(8, "0");
}

function getStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(FP_KEY);
  } catch {
    return null;
  }
}

function storeFingerprint(fp: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FP_KEY, fp);
  } catch {
    // 隐私模式下可能失败，静默忽略
  }
}
