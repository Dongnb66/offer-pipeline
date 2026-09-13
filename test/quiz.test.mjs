// QBANK 题库（自私有备战站迁移）：结构 invariant + 出题规模 + 选择题判分交互
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

const PROFILE = { name: "杨运栋", grade: "2028", major: "计算机科学与技术", projects: "alpha｜项目｜", skills: { py: 1, langgraph: 1 } };

function makeApp() {
  const a = loadApp();
  a.setProfile({ ...PROFILE });
  return a;
}

test("QBANK 结构 invariant：规模、id/q 唯一、sel 四选项带答案、qa 带参考答案、dir 合法", () => {
  const app = loadApp();
  const bank = app.QBANK;
  assert.ok(bank.length >= 100, "题库规模应不少于 100 题，实际 " + bank.length);
  assert.equal(new Set(bank.map((e) => e.id)).size, bank.length, "id 必须唯一");
  assert.equal(Object.keys(app.QB_BY_KEY).length, bank.length, "每道题都能按题干定位（qkey 无碰撞）");
  const dirs = new Set(["agent", "be", "fe", "common"]);
  const problems = bank.filter((e) => {
    if (!dirs.has(e.dir)) return true;
    if (e.type === "sel") return !Array.isArray(e.o) || e.o.length !== 4 || typeof e.a !== "number" || e.a < 0 || e.a > 3;
    if (e.type === "qa") return !e.e || e.e.length < 20;
    return true;
  });
  assert.equal(problems.length, 0, "结构异常条目：" + problems.map((e) => e.id).join(","));
});

test("出题规模：指定 30 道就出 30 道，题池来自 QBANK+场景+追问（不再只有十几道）", () => {
  const app = makeApp();
  const quiz = app.buildQuiz(30);
  assert.equal(quiz.length, 30);
  assert.ok(quiz.some((q) => app.QB_BY_KEY[app.qkey(q)]), "应包含 QBANK 题库中的题目");
  const quiz10 = app.buildQuiz(10);
  assert.equal(quiz10.length, 10);
});

test("方向过滤：agent 方向出题应含 agent/common 分类，不含纯后端分类", () => {
  const app = makeApp();
  app.el("b-dir").value = "agent";
  const quiz = app.buildQuiz(30);
  const entries = quiz.map((q) => app.QB_BY_KEY[app.qkey(q)]).filter(Boolean);
  assert.ok(entries.length > 0, "应出 QBANK 题");
  const offDir = entries.filter((e) => e.dir !== "agent" && e.dir !== "common");
  assert.equal(offDir.length, 0, "混入了其他方向的题：" + offDir.map((e) => e.cat).join(","));
});

test("换一批：同一数量下轮换出题，两批不重叠且合起来不超出题池", () => {
  const app = makeApp();
  const batch1 = app.genQuiz();
  const batch2 = app.genQuiz(1);
  assert.equal(batch1.length, 20);
  assert.equal(batch2.length, 20);
  const overlap = batch2.filter((q) => batch1.includes(q));
  assert.equal(overlap.length, 0, "换一批不应重复上一批：" + overlap.slice(0, 3).join(" / "));
});

test("选择题交互：选对判对、选错给正确答案，都展示解析，且一题只判一次", () => {
  const app = makeApp();
  const entry = app.QBANK.find((e) => e.type === "sel");
  const key = app.qkey(entry.q);
  assert.equal(app.chooseSel(key, (entry.a + 1) % 4, entry.a), false, "选错应判错");
  const fbWrong = app.el("selfb-" + key).innerHTML;
  assert.match(fbWrong, /答错了，正确答案是 [A-D]/);
  assert.match(fbWrong, new RegExp(entry.e.slice(0, 20).replace(/[.*+?^${}()|[\]\\<]/g, "\\$&")), "解析未展示");
  assert.equal(app.chooseSel(key, entry.a, entry.a), undefined, "已判过的题不得重复判分");

  const entry2 = app.QBANK.find((e) => e.type === "sel" && e.id !== entry.id);
  const key2 = app.qkey(entry2.q);
  assert.equal(app.chooseSel(key2, entry2.a, entry2.a), true, "选对应判对");
  assert.match(app.el("selfb-" + key2).innerHTML, /答对了/);
});

test("问答题渲染：带「答」按钮，展开后是备战站的结构化参考答案", () => {
  const app = makeApp();
  const qa = app.QBANK.find((e) => e.type === "qa");
  const html = app.quizRow(qa);
  assert.match(html, /toggleQa\('/);
  assert.ok(html.includes(qa.e.slice(0, 30)), "参考答案内容未渲染");
  app.toggleQa(app.qkey(qa.q));
});

test("QBANK 题的自评与薄弱清单打通：标「不会」的题下次优先出", () => {
  const app = makeApp();
  const entry = app.QBANK.find((e) => e.type === "qa");
  app.markPrep(app.registerQ(entry.q), "weak");
  const quiz = app.buildQuiz(30);
  assert.equal(quiz[0], entry.q, "标过「不会」的题库题必须排最前");
  const weak = app.weakList();
  assert.ok(weak.includes(entry.q), "题库题应进薄弱清单");
});
