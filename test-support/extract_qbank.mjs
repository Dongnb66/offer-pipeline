// 一次性迁移脚本:从私有备战站 HTML 提取 BANK 题库,校验结构,按分类映射方向,输出可嵌入 offer-pipeline 的 JS 片段
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SRC = "C:/Users/dong/WorkBuddy/2026-09-06-00-45-18/面试备战站_杨运栋.html";
const h = fs.readFileSync(SRC, "utf8");
const i = h.indexOf("BANK");
const start = h.indexOf("[", i);

let depth = 0, end = -1, inStr = false, q = null, esc = false;
for (let p = start; p < h.length; p++) {
  const c = h[p];
  if (inStr) {
    if (esc) esc = false;
    else if (c === "\\") esc = true;
    else if (c === q) inStr = false;
    continue;
  }
  if (c === '"' || c === "'" || c === "`") { inStr = true; q = c; continue; }
  if (c === "[") depth++;
  else if (c === "]") { depth--; if (depth === 0) { end = p + 1; break; } }
}
const literal = h.slice(start, end);
const tmp = path.join(os.tmpdir(), "qbank_literal.js");
fs.writeFileSync(tmp, "module.exports=" + literal + ";");
const QBANK = require2(tmp);

function require2(p) {
  // 简易 require:用 Function 求值 CommonJS 片段
  const code = fs.readFileSync(p, "utf8");
  const module = { exports: {} };
  new Function("module", "exports", code)(module, module.exports);
  return module.exports;
}

console.log("literal length:", literal.length);
console.log("entries:", QBANK.length);
const cats = {};
QBANK.forEach((e) => (cats[e.cat] = (cats[e.cat] || 0) + 1));
console.log("cats:", JSON.stringify(cats));
const types = {};
QBANK.forEach((e) => (types[e.type] = (types[e.type] || 0) + 1));
console.log("types:", JSON.stringify(types));
const badSel = QBANK.filter((e) => e.type === "sel" && (!Array.isArray(e.o) || e.o.length !== 4 || typeof e.a !== "number" || e.a < 0 || e.a > 3));
console.log("sel 结构异常:", badSel.length);
console.log("含 </script> 的条目:", QBANK.filter((e) => JSON.stringify(e).includes("</scr" + "ipt>")).length);
console.log("id 唯一:", new Set(QBANK.map((e) => e.id)).size === QBANK.length);
const noQaE = QBANK.filter((e) => e.type === "qa" && (!e.e || e.e.length < 20));
console.log("qa 缺参考答案:", noQaE.length);

// 分类 → 方向映射(生成 dir 字段)
const DIR_MAP = {
  "RAG": "agent", "Agent 基础": "agent", "记忆 & 上下文": "agent", "AI 工程化": "agent", "工具调用 & MCP": "agent",
  "后端基础": "be", "MySQL": "be", "计算机网络": "be", "操作系统": "be", "Redis": "be", "场景设计题": "be",
  "算法手撕": "common", "Python 语言": "common", "面试战术": "common"
};
const unmapped = [...new Set(QBANK.filter((e) => !DIR_MAP[e.cat]).map((e) => e.cat))];
console.log("未映射分类:", JSON.stringify(unmapped));

const out = QBANK.map((e) => ({ ...e, dir: DIR_MAP[e.cat] || "common" }));
fs.writeFileSync(path.join(os.tmpdir(), "qbank_out.json"), JSON.stringify(out));
console.log("输出:", path.join(os.tmpdir(), "qbank_out.json"));
