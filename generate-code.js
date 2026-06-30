// 激活码生成器 — 收到用户付款后，运行此脚本生成激活码发给用户
// 用法：node generate-code.js
// 每次运行生成 1 个激活码

const SECRET = "pdf-tool-2026-secret-key-v1";

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const h = (hash >>> 0).toString(16).padStart(8, "0");
  return h + h.slice(0, 4);
}

function generateCode() {
  // 生成随机 8 位 hex
  const rand = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  const payload = rand;
  const hash = simpleHash(payload + SECRET);
  // 验证码 = PT-XXXX + hash 前4位交叉
  const suffix = hash.slice(0, 4);
  return `PT-${payload}${suffix}`;
}

const code = generateCode();
console.log("");
console.log("  ==============================");
console.log("  激活码：", code);
console.log("  ==============================");
console.log("");
console.log("  把这个码发给付款用户，用户在网站上输入即可永久激活。");
console.log("");
