// 岗位关键词命中 / 缺口分类
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

function app0(skills, jd) {
  const app = loadApp();
  app.setProfile({ name: "张三", grade: "2028", major: "计算机科学与技术", projects: "", github: "", skills });
  app.el("j-role").value = "测试岗";
  app.el("j-jd").value = jd;
  app.analyzeJD();
  return app;
}

test("命中关键词：画像有的技能被识别为可写项", () => {
  const app = app0({ py: 1, langgraph: 1 }, "要求 Python 和 LangGraph，了解 RAG 更好");
  const out = app.el("j-out").innerHTML;
  assert.match(out, /命中（画像内/);
  assert.match(out, /Python/);
  assert.match(out, /LangGraph/);
});

test("缺口关键词：画像没有的被划入缺口区", () => {
  const app = app0({ py: 1 }, "要求 Java 与 Spring，熟悉 MySQL");
  const out = app.el("j-out").innerHTML;
  assert.match(out, /Java/);
  assert.match(out, /MySQL/);
  assert.match(out, /缺口/);
});

test("无词表外的能力标签（消息队列 / Elasticsearch）按主题归入缺口", () => {
  const app = app0({ py: 1 }, "熟悉 Kafka 与 Elasticsearch，了解微服务");
  const out = app.el("j-out").innerHTML;
  assert.match(out, /消息队列/);
  assert.match(out, /Elasticsearch/);
  assert.match(out, /微服务/);
});

test("未保存画像时给出提示而不是抛错", () => {
  const app = loadApp();
  app.el("j-jd").value = "要求 Python";
  app.analyzeJD();
  assert.match(app.el("j-out").innerHTML, /请先在「我的画像」保存基本信息/);
});

test("空 JD 时给出提示", () => {
  const app = app0({ py: 1 }, "   ");
  assert.match(app.el("j-out").innerHTML, /请粘贴 JD 全文/);
});

test("回归：缺口区不得出现内部键，K8s 等标签须可读", () => {
  const app = app0({ py: 1 }, "要求 K8s、Kafka、JVM、分布式、八股");
  const out = app.el("j-out").innerHTML;
  assert.equal(out.match(/__[a-z_]+/g), null, "缺口区泄漏了内部键：" + out.slice(0, 200));
  assert.match(out, /容器\/K8s/);
  assert.match(out, /消息队列/);
});
