import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

const SAMPLE = [
  "1. 自我介绍",
  "2. 讲一下你的 Agent 项目？为什么用 LangGraph？",
  "3. Redis 缓存穿透怎么解决？",
  "4. MySQL 索引失效的场景？",
  "问：如果模型幻觉了怎么办？",
  "面经就这些，求个 offer。"
].join("\n");

function countItems(html) {
  return html.split("<li>").length - 1;
}

test("parseJing 能抽出问句行（编号 / 问号 / 问：三种写法）", () => {
  const app = loadApp();
  app.el("b-jing").value = SAMPLE;
  app.parseJing();
  const html = app.el("b-jingout").innerHTML;
  assert.match(html, /抽出的题/);
  assert.equal(countItems(html), 5, "应抽出 5 道题（含编号行与问：行），普通叙述行不计");
});

test("parseJing 按主题统计高频考点", () => {
  const app = loadApp();
  app.el("b-jing").value = SAMPLE;
  app.parseJing();
  const html = app.el("b-jingout").innerHTML;
  assert.match(html, /Redis/, "高频榜应命中 Redis");
  assert.match(html, /MySQL索引/, "高频榜应把 MySQL 归到索引主题");
});

test("parseJing 全量列出题目，不静默截断", () => {
  const app = loadApp();
  const many = Array.from({ length: 60 }, (_, i) => `${i + 1}. 第 ${i + 1} 个问题？`).join("\n");
  app.el("b-jing").value = many;
  app.parseJing();
  assert.equal(countItems(app.el("b-jingout").innerHTML), 60, "60 道题必须全部输出");
});

test("parseJing 空输入给出明确提示而不是空白", () => {
  const app = loadApp();
  app.el("b-jing").value = "";
  app.parseJing();
  assert.match(app.el("b-jingout").innerHTML, /先粘贴面经原文/);
});

test("parseJing 抽不到问句时给出可操作提示", () => {
  const app = loadApp();
  app.el("b-jing").value = "今天面试官人挺好，聊了一个小时，最后说让我等通知。";
  app.parseJing();
  assert.match(app.el("b-jingout").innerHTML, /没抽到问句/);
});

// 回归断言：内部主题键（__xxx__）只应存在于代码中，绝不能渲染给用户。
// 该 bug 曾真实存在：TOPICS 用单下划线键、TLABEL 用双下划线键，导致界面显示 "__idx"。
test("回归：内部主题键不得泄漏到界面，且必须解析为可读标签", () => {
  const app = loadApp();
  app.el("b-jing").value = [
    "1. Kafka 消息队列怎么保证不丢？",
    "2. MySQL 索引失效的场景？",
    "3. JVM 调优做过吗？",
    "4. 分布式锁怎么实现？",
    "5. 并发编程的锁升级过程？"
  ].join("\n");
  app.parseJing();
  const jingHtml = app.el("b-jingout").innerHTML;
  assert.equal(jingHtml.match(/__[a-z_]+/g), null, "面经高频榜泄漏了内部键：" + jingHtml.slice(0, 200));
  assert.match(jingHtml, /消息队列/);
  assert.match(jingHtml, /MySQL索引/);
  assert.match(jingHtml, /JVM/);
  assert.match(jingHtml, /分布式/);
});
