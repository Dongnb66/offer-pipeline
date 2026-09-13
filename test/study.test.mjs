// 备考学习闭环：知识点讲解卡 + 场景题参考思路 + 按目标岗位出模拟题
// 产品约束：备战页不能只让用户自评——不会的知识点要能点开学；投什么岗位，就优先备什么、出什么题
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

const PROFILE = { name: "杨运栋", grade: "2028", major: "计算机科学与技术", projects: "alpha｜项目｜", skills: { py: 1, langgraph: 1, mcp: 1 } };

test("invariant：KB 必须覆盖 BANK 全部知识点，note/答题要点/高频追问一个不空", () => {
  const app = loadApp();
  const missing = [];
  for (const dir of Object.keys(app.BANK)) {
    app.BANK[dir].points.forEach((p) => {
      const kb = app.KB[dir] && app.KB[dir][p];
      if (!kb) missing.push(dir + " 缺讲解卡：" + p);
      else if (!kb.note || !Array.isArray(kb.key) || !kb.key.length || !Array.isArray(kb.ask) || !kb.ask.length) {
        missing.push(dir + " 讲解卡内容不全：" + p);
      }
    });
  }
  assert.equal(missing.length, 0, missing.join("；"));
});

test("invariant：SCENE_A 必须覆盖 BANK 全部场景题，每题至少 3 条思路要点", () => {
  const app = loadApp();
  const missing = [];
  for (const dir of Object.keys(app.BANK)) {
    app.BANK[dir].scene.forEach((q) => {
      const a = app.SCENE_A[q];
      if (!a) missing.push("缺参考思路：" + q);
      else if (!Array.isArray(a) || a.length < 3) missing.push("思路要点不足 3 条：" + q);
    });
  }
  assert.equal(missing.length, 0, missing.join("；"));
});

test("JD 分析写入备考目标：备战页显示岗位与考点，并按考点优先排序知识点", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  app.el("j-role").value = "AI Agent 开发实习生";
  app.el("j-jd").value = "岗位要求：熟悉 LangGraph 与 MCP 协议";
  app.analyzeJD();

  const target = app.getTarget();
  assert.ok(target, "分析后应有备考目标");
  assert.equal(target.role, "AI Agent 开发实习生");
  assert.ok(target.topics.includes("MCP"), "目标考点应含 MCP");

  app.renderPrep();
  const html = app.el("b-out").innerHTML;
  assert.match(html, /正在备考「<b>AI Agent 开发实习生<\/b>」岗位/);
  assert.match(html, /MCP/);
  // 「MCP 协议」知识点应排到内置顺序第一的「工作流打底」前面
  assert.ok(html.indexOf("MCP 协议") < html.indexOf("工作流打底"), "岗位要求的考点应排在前");
});

test("知识点行带「讲」按钮，展开后有讲解/答题要点/高频追问", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  app.renderPrep();
  const html = app.el("b-out").innerHTML;
  assert.match(html, /toggleKb\('/, "知识点行缺「讲」按钮");
  assert.match(html, /是什么：/, "讲解卡正文缺失");
  assert.match(html, /答题要点：/);
  assert.match(html, /高频追问：/);
});

test("场景题行带「答」按钮与参考思路；面经必考榜同样可看思路", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  app.renderPrep();
  assert.match(app.el("b-out").innerHTML, /参考思路（先自己答 30 秒再看）/);

  app.el("b-jing").value = "1. Redis 缓存穿透怎么解决？";
  app.parseJing();
  assert.match(app.el("b-jingout").innerHTML, /toggleAns\('/, "必考榜缺「答」按钮");
});

test("模拟出题：薄弱项排最前、已掌握不再出、无重复、至多 10 道", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  const weakQ = "工具调用越权怎么防？";
  const knowQ = "评测集被污染了怎么办？";
  app.markPrep(app.registerQ(weakQ), "weak");
  app.markPrep(app.registerQ(knowQ), "know");

  const quiz = app.buildQuiz();
  assert.ok(quiz.length > 0 && quiz.length <= 10, "出题数量应在 1~10");
  assert.equal(new Set(quiz).size, quiz.length, "不得重复出题");
  assert.equal(quiz.includes(knowQ), false, "已标「会」的不得再出");
  assert.equal(quiz[0], weakQ, "标过「不会」的必须排最前");

  const rendered = app.genQuiz();
  assert.deepEqual(rendered, app.buildQuiz(20), "genQuiz 默认按出题数量选择器（20）出题");
  assert.match(app.el("b-quiz").innerHTML, /markPrep\(/, "模拟题必须可自评");
  assert.match(app.el("b-quiz").innerHTML, /参考思路|答对了|答错了/, "模拟题要能看思路或判定");
});

test("目标岗位考点命中出题：JD 要 MCP，追问池里的 MCP 相关题排前", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  app.el("j-role").value = "Agent 实习";
  app.el("j-jd").value = "要求 LangGraph 与 MCP";
  app.analyzeJD();
  const quiz = app.buildQuiz();
  assert.ok(quiz.some((q) => /MCP|宿主|工具服务器/.test(q)), "应出与目标考点 MCP 相关的题");
});
