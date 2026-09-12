// 能力推断 + 补强计划（加强 / 拓展 / 新项目）
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

function profile(skills, projects) {
  return { name: "张三", grade: "2028", major: "计算机科学与技术", school: "", github: "", projects, skills };
}

test("renderInfer 从项目描述推断技能，且只推未勾选的", () => {
  const app = loadApp();
  app.setProfile(profile({ py: 1 }, "alpha｜用 LangGraph 编排、Redis 缓存、pytest 覆盖｜"));
  app.renderInfer();
  const html = app.el("p-infer").innerHTML;
  assert.match(html, /LangGraph/);
  assert.match(html, /Redis/);
  assert.match(html, /pytest/);
  assert.ok(!html.includes("Python"), "已勾选的技能不应重复推断");
});

test("无项目描述时推断区为空，不产生噪音", () => {
  const app = loadApp();
  app.setProfile(profile({ py: 1 }, ""));
  app.renderInfer();
  assert.equal(app.el("p-infer").innerHTML, "");
});

test("confirmInfer 点击后写入技能并落到本地存储", () => {
  const app = loadApp();
  app.setProfile(profile({ py: 1 }, "alpha｜LangGraph 项目｜"));
  app.confirmInfer("langgraph");
  assert.equal(app.getProfile().skills.langgraph, 1);
  const saved = JSON.parse(app.store.get("pipeline_profile"));
  assert.equal(saved.skills.langgraph, 1, "确认的推断必须持久化");
});

test("renderPlan：加强项来自投递台账里的真实 JD 高频考点", () => {
  const app = loadApp();
  app.setProfile(profile({ py: 1, langgraph: 1 }, "alpha｜LangGraph 项目｜"));
  app.store.set("pipeline_ledger", JSON.stringify([
    { co: "A", role: "后端", date: "2026-09-01", status: "已投递", jd: "要求 Redis 缓存与 Kafka 消息队列" },
    { co: "B", role: "后端", date: "2026-09-02", status: "已投递", jd: "Redis 缓存穿透，MySQL 事务与索引" }
  ]));
  app.renderPlan();
  const html = app.el("d-plan").innerHTML;
  assert.match(html, /加强/);
  assert.match(html, /Redis|消息队列|MySQL索引/);
});

test("renderPlan：拓展项不得包含已勾选技能", () => {
  const app = loadApp();
  app.setProfile(profile({ py: 1, langgraph: 1, redis: 1, docker: 1 }, "alpha｜LangGraph 项目｜"));
  app.renderPlan();
  const html = app.el("d-plan").innerHTML;
  assert.ok(!/>Redis</.test(html), "已掌握的 Redis 不应出现在拓展建议里");
  assert.ok(!/>Docker</.test(html), "已掌握的 Docker 不应出现在拓展建议里");
});

test("renderPlan：新项目只推荐尚未被技能覆盖的方向", () => {
  const app = loadApp();
  app.setProfile(profile({ py: 1, langgraph: 1 }, "alpha｜LangGraph 项目｜"));
  app.renderPlan();
  const html = app.el("d-plan").innerHTML;
  assert.match(html, /新项目/);
  assert.ok(!/AI Agent 应用开发<\/b>/.test(html), "已覆盖的 AI Agent 方向不应被推荐为新项目");
});

test("技能覆盖全部三个方向时，提示深耕而非铺新项目", () => {
  const app = loadApp();
  app.setProfile(profile(
    { py: 1, langgraph: 1, node: 1, mysql: 1, fastapi: 1, react: 1 },
    "alpha｜LangGraph + React 全栈项目｜"
  ));
  app.renderPlan();
  assert.match(app.el("d-plan").innerHTML, /打磨深/);
});

test("无画像时补强计划给出引导而不是空白", () => {
  const app = loadApp();
  app.renderPlan();
  assert.match(app.el("d-plan").innerHTML, /先在「我的画像」勾技能并保存/);
});
