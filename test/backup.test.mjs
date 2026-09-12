// 数据备份：导出 / 导入 / 清空（localStorage 会随浏览器数据消失，这是防丢关键路径）
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

const PROFILE = { name: "杨运栋", grade: "2028", major: "计算机科学与技术", projects: "alpha｜项目｜", skills: { py: 1 } };
const LEDGER = [{ co: "某公司", role: "AI 实习生", date: "2026-09-12", status: "已投递", jd: "要求 Python" }];

function seeded() {
  const app = loadApp();
  app.store.set("pipeline_profile", JSON.stringify(PROFILE));
  app.store.set("pipeline_ledger", JSON.stringify(LEDGER));
  app.loadProfile();
  return app;
}

test("buildBackup 输出的备份含版本号、时间、画像与台账并可被 JSON 解析", () => {
  const app = seeded();
  const json = app.buildBackup();
  const data = JSON.parse(json);
  assert.equal(data.app, "offer-pipeline");
  assert.ok(data.version >= 2);
  assert.match(data.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(data.profile.name, "杨运栋");
  assert.equal(data.ledger.length, 1);
});

test("导出再导入可完整还原台账（换浏览器场景）", () => {
  const app = seeded();
  const json = app.buildBackup();
  const fresh = loadApp();
  const r = fresh.importData(json);
  assert.equal(r.ok, true, r.msg);
  const recs = JSON.parse(fresh.store.get("pipeline_ledger"));
  assert.equal(recs.length, 1);
  assert.equal(recs[0].co, "某公司");
  assert.equal(JSON.parse(fresh.store.get("pipeline_profile")).name, "杨运栋");
});

test("导入非法内容被拒且不破坏已有数据", () => {
  const app = seeded();
  const bad = app.importData("这不是 JSON");
  assert.equal(bad.ok, false);
  assert.match(bad.msg, /不是合法 JSON/);
  const unrelated = app.importData('{"foo":1}');
  assert.equal(unrelated.ok, false);
  assert.match(unrelated.msg, /不是本工具的备份文件/);
  assert.equal(JSON.parse(app.store.get("pipeline_ledger")).length, 1, "原台账必须原样保留");
});

test("导入空画像不报错（备份里 profile 为 null 的合法情形）", () => {
  const app = loadApp();
  const r = app.importData('{"app":"offer-pipeline","version":2,"profile":null,"ledger":[]}');
  assert.equal(r.ok, true, r.msg);
  assert.match(r.msg, /画像 空/);
});

test("清空数据必须二次确认；用户取消时数据保留", () => {
  const app = loadApp({ confirmResult: false });
  app.store.set("pipeline_ledger", JSON.stringify(LEDGER));
  const r = app.clearData();
  assert.equal(r.ok, false);
  assert.match(r.msg, /已取消/);
  assert.equal(app.store.has("pipeline_ledger"), true, "取消后台账不得被删除");
});

test("确认为真时清空画像与台账两个键", () => {
  const app = loadApp();
  app.store.set("pipeline_profile", JSON.stringify(PROFILE));
  app.store.set("pipeline_ledger", JSON.stringify(LEDGER));
  const r = app.clearData();
  assert.equal(r.ok, true);
  assert.equal(app.store.has("pipeline_ledger"), false);
  assert.equal(app.store.has("pipeline_profile"), false);
});

test("复制结果有反馈，不再静默失败", async () => {
  const app = loadApp();
  const ok = await app.copyToClipboard("文案");
  assert.equal(ok.ok, true);
  app.el("greet").textContent = "你好，我是 2028 届…";
  assert.equal(app.greetLength(), "你好，我是 2028 届…".length);
});

test("toLedger 切到台账页靠 data-t 定位，不依赖标签序号", () => {
  const app = seeded();
  app.el("j-co").value = "某公司";
  app.el("j-role").value = "AI 实习生";
  app.el("j-jd").value = "要求 Python";
  const n = app.toLedger();
  assert.equal(n, 2, "新记录应插到台账最前");
  assert.equal(JSON.parse(app.store.get("pipeline_ledger"))[0].role, "AI 实习生");
});

test("台账日期留空时自动补今天，不产生空日期记录", () => {
  const app = loadApp();
  app.el("l-co").value = "某公司";
  app.el("l-role").value = "后端实习生";
  app.el("l-date").value = "";
  app.addRecord();
  const rec = JSON.parse(app.store.get("pipeline_ledger"))[0];
  assert.match(rec.date, /^\d{4}-\d{2}-\d{2}$/);
});

test("台账公司岗位都为空时不写入并给出提示", () => {
  const app = loadApp();
  const n = app.addRecord();
  assert.equal(n, 0);
  assert.match(app.el("toast").textContent, /至少填一个/);
});

test("台账高频考点统计与面试备战用同一套词表，且按考点而非关键词计数", () => {
  const app = loadApp();
  app.store.set("pipeline_ledger", JSON.stringify([
    { co: "A", role: "后端", date: "2026-09-01", status: "已投递", jd: "要求 Kafka 消息队列与 JVM 调优" },
    { co: "B", role: "后端", date: "2026-09-02", status: "已投递", jd: "Kafka 消息队列，MySQL 索引" }
  ]));
  app.renderLedger();
  const html = app.el("l-table").innerHTML;
  assert.match(html, /消息队列 × 2/, "两个岗位考了消息队列，应记为 2（不是 4 次关键词命中）");
  assert.match(html, /MySQL索引 × 1/, "索引命中时应归并到 MySQL索引，不再重复计 MySQL");
  assert.equal(html.match(/__[a-z_]+/g), null, "统计区泄漏内部键");
});
