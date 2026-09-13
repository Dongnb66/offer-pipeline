// 画像持久化 roundtrip + AI 润色请求体的院校红线
// 回归背景：saveProfile 曾漏存 school/certs/intern 三个字段，用户填完一刷新就丢，
// 且直填包里「学校」永远渲染占位符——单靠 setProfile 注入的测试抓不到，必须走完整链路。
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

function appWithForm() {
  const app = loadApp();
  app.el("p-name").value = "杨运栋";
  app.el("p-grade").value = "2028";
  app.el("p-major").value = "计算机科学与技术";
  app.el("p-github").value = "https://github.com/Dongnb66";
  app.el("p-school").value = "吉首大学张家界学院";
  app.el("p-certs").value = "计算机二级 WPS";
  app.el("p-intern").value = "某科技｜后端实习｜2026.07-2026.09｜参与接口开发";
  app.el("p-projects").value = "alpha｜项目 A 描述｜https://github.com/x/a｜2026.03";
  app.el("p-schoolmention").value = "never";
  return app;
}

test("saveProfile→loadProfile roundtrip：school/certs/intern/院校策略一个都不能丢", () => {
  const app = appWithForm();
  app.saveProfile();
  const saved = JSON.parse(app.store.get("pipeline_profile"));
  assert.equal(saved.school, "吉首大学张家界学院", "学校必须持久化");
  assert.equal(saved.certs, "计算机二级 WPS", "证书必须持久化");
  assert.equal(saved.intern.includes("后端实习"), true, "实习经历必须持久化");
  assert.equal(saved.schoolMention, "never", "院校策略必须持久化");

  // 模拟刷新页面：清空表单后从存储载入，三个字段必须回来
  ["p-school", "p-certs", "p-intern"].forEach((id) => (app.el(id).value = ""));
  app.loadProfile();
  assert.equal(app.el("p-school").value, "吉首大学张家界学院");
  assert.equal(app.el("p-certs").value, "计算机二级 WPS");
  assert.equal(app.el("p-intern").value.includes("参与接口开发"), true);
  assert.equal(app.el("p-schoolmention").value, "never");
});

test("buildPack 的教育块用得上持久化后的学校（而非一直渲染占位符）", () => {
  const app = appWithForm();
  app.saveProfile();
  app.loadProfile();
  const secs = app.buildPack();
  const edu = secs.find((s) => s[0] === "BOSS 教育经历");
  assert.ok(edu[1].includes("学校：吉首大学张家界学院"), "学校应进入教育经历块");
  assert.ok(!edu[1].includes("【学校】"), "不应再渲染占位符");
});

test("润色请求体：默认（从不提）剥离学校字段——约束放代码不放 prompt", () => {
  const app = appWithForm();
  app.saveProfile();
  const req = app.buildPolishReq();
  assert.equal(req.prompt.includes("吉首大学张家界学院"), false, "payload 不得含学校名");
  assert.match(req.system, /绝不出现学校名/);
});

test("润色请求体：「总是提」时学校保留在 payload，系统提示词相应放开", () => {
  const app = appWithForm();
  app.el("p-schoolmention").value = "always";
  app.saveProfile();
  const req = app.buildPolishReq();
  assert.equal(req.prompt.includes("吉首大学张家界学院"), true, "院校是优势时应允许进入润色上下文");
  assert.match(req.system, /原样保留/);
  assert.ok(!/绝不出现学校名/.test(req.system), "always 模式不得再下「绝不出现」的反指令");
});

test("院校策略落到招呼语：总是提时开场带校名，从不提（默认）不带", () => {
  const always = appWithForm();
  always.el("p-schoolmention").value = "always";
  always.saveProfile();
  always.el("j-role").value = "测试岗";
  always.el("j-jd").value = "要求 Python";
  always.analyzeJD();
  assert.match(always.el("greet").textContent, /吉首大学张家界学院/, "「总是提」时招呼语应带校名");

  const never = appWithForm();
  never.saveProfile();
  never.el("j-role").value = "测试岗";
  never.el("j-jd").value = "要求 Python";
  never.analyzeJD();
  assert.ok(!/吉首大学张家界学院|学校|学院|大学/.test(never.el("greet").textContent), "默认从不提，不得出现院校字样");
});

test("备考目标随备份还原；清空数据时一并清掉（不得残留旧岗位）", () => {
  const app = appWithForm();
  app.saveProfile();
  app.el("j-role").value = "Agent 实习";
  app.el("j-jd").value = "要求 LangGraph";
  app.analyzeJD();
  assert.ok(app.getTarget(), "分析后应有备考目标");

  const fresh = loadApp();
  const r = fresh.importData(app.buildBackup());
  assert.equal(r.ok, true, r.msg);
  assert.equal(fresh.getTarget().role, "Agent 实习", "换设备后备考目标应还原");

  const cleared = loadApp();
  cleared.store.set("pipeline_profile", JSON.stringify({ name: "x", skills: {} }));
  cleared.store.set("pipeline_target", JSON.stringify({ role: "旧岗位", topics: ["x"], ts: "2026-09-13T00:00:00Z" }));
  assert.equal(cleared.clearData().ok, true);
  assert.equal(cleared.store.has("pipeline_target"), false, "清空后不得残留备考目标");
  assert.equal(cleared.getTarget(), null);
});

test("坏结构的备考目标被拒收", () => {
  const app = loadApp();
  const r = app.importData('{"target":"not-an-object"}');
  assert.equal(r.ok, false);
  assert.match(r.msg, /备考目标不是对象/);
});
