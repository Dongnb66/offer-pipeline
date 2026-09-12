// 三不原则的机械化断言 —— 对应产品红线，任何改动都不许绕过。
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

const PROFILE = {
  name: "杨运栋",
  grade: "2028",
  major: "计算机科学与技术",
  school: "吉首大学张家界学院",
  certs: "",
  intern: "",
  github: "https://github.com/Dongnb66",
  projects: "python-learning-agent｜FastAPI+LangGraph 教学智能体，94 条 pytest｜https://github.com/Dongnb66/python-learning-agent｜2026.03",
  skills: { py: 1, fastapi: 1, langgraph: 1 }
};

function setup(jd, who = "hr") {
  const app = loadApp();
  app.setProfile({ ...PROFILE, skills: { ...PROFILE.skills } });
  app.el("j-role").value = "AI Agent 开发实习生";
  app.el("j-who").value = who;
  app.el("j-jd").value = jd;
  app.analyzeJD();
  return app;
}

test("红线①：招呼语绝不出现学校名，也不出现「学校」字样", () => {
  const app = setup("岗位要求：Python、FastAPI、LangGraph、MySQL、Redis");
  const greet = app.el("greet").textContent;
  assert.ok(!greet.includes("吉首大学张家界学院"), "招呼语泄漏了学校名");
  assert.ok(!/学校|学院|大学/.test(greet), "招呼语出现了院校字样");
  assert.match(greet, /2028 届|2028届/, "开场身份应为届数+专业+姓名");
});

test("红线②：画像里没有的技能，绝不写进招呼语（缺口不代填）", () => {
  const app = setup("岗位要求：Python、FastAPI、LangGraph、MySQL、Redis、Kafka、Elasticsearch、Linux");
  const greet = app.el("greet").textContent;
  ["MySQL", "Redis", "Kafka", "Elasticsearch", "Linux"].forEach((kw) => {
    assert.ok(!greet.includes(kw), `缺口技能 ${kw} 被写进了招呼语`);
  });
  assert.match(greet, /Python|FastAPI|LangGraph/, "已具备的技能应被写入");
});

test("红线②：缺口只做标注，界面必须出现「只标注不代填」的明示", () => {
  const app = setup("岗位要求：Python、Kafka、Elasticsearch");
  const out = app.el("j-out").innerHTML;
  assert.match(out, /只标注不代填/, "缺口区缺少不代填提示");
  assert.match(out, /消息队列/, "缺口应以可读标签列出供用户自查");
  assert.match(out, /Elasticsearch/);
});

test("红线③：招呼语不承诺未验证的量化数字，且项目信息来自画像原文", () => {
  const app = setup("岗位要求：Python、FastAPI");
  const greet = app.el("greet").textContent;
  assert.match(greet, /94 条 pytest/, "应引用画像中的真实项目描述");
  assert.ok(!/精通|熟练掌握|专家/.test(greet), "招呼语不得出现「精通/熟练掌握」等无法验证的自评");
});

test("画像缺项时不编造：无届数/无项目时留占位符而非虚构内容", () => {
  const app = loadApp();
  app.setProfile({ name: "张三", grade: "", major: "计算机科学与技术", projects: "", skills: { py: 1 } });
  app.el("j-role").value = "后端实习生";
  app.el("j-jd").value = "要求 Python";
  app.analyzeJD();
  const greet = app.el("greet").textContent;
  assert.match(greet, /__届/, "缺届数应留占位符");
  assert.ok(!/2027|2026 届/.test(greet), "不得凭空编造届数");
});

test("技术官与 HR 的称呼区分：技术官用「老师好」", () => {
  const app = setup("岗位要求：Python", "tech");
  assert.match(app.el("greet").textContent, /老师好/);
});
