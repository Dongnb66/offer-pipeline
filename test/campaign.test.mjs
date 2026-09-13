// 求职分线：按方向分线管理岗位池，与台账互通
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

test("addCampaign 空名拒绝；成功后可查到且默认无岗位", () => {
  const app = loadApp();
  const bad = app.addCampaign("  ");
  assert.equal(bad.ok, false);
  const r = app.addCampaign("AI Agent 实习主线", "agent");
  assert.equal(r.ok, true);
  const cs = app.getCampaigns();
  assert.equal(cs.length, 1);
  assert.equal(cs[0].name, "AI Agent 实习主线");
  assert.equal(cs[0].dir, "agent");
  assert.equal(cs[0].jobs.length, 0);
});

test("addCampaignJob：空岗拒绝、重复岗拒绝、成功计数", () => {
  const app = loadApp();
  app.addCampaign("主线", "agent");
  const id = app.getCampaigns()[0].id;
  assert.equal(app.addCampaignJob(id, "", "").ok, false, "公司岗位都空应拒绝");
  assert.equal(app.addCampaignJob(id, "某司", "Agent 实习生", "已投递").ok, true);
  const dup = app.addCampaignJob(id, "某司", "Agent 实习生", "准备投");
  assert.equal(dup.ok, false, "同公司同岗位不得重复加入");
  assert.match(dup.msg, /不重复加/);
  assert.equal(app.getCampaigns()[0].jobs.length, 1);
  assert.equal(app.addCampaignJob(id, "另一家", "后端实习生", "约面").total, 2);
});

test("campaignProgress 统计已投出与约面，准备投不计入已投出", () => {
  const app = loadApp();
  app.addCampaign("主线", "agent");
  const id = app.getCampaigns()[0].id;
  app.addCampaignJob(id, "A", "岗1", "准备投");
  app.addCampaignJob(id, "B", "岗2", "已投递");
  app.addCampaignJob(id, "C", "岗3", "约面");
  app.addCampaignJob(id, "D", "岗4", "挂了");
  const p = app.campaignProgress(app.getCampaigns()[0]);
  assert.equal(p.total, 4);
  assert.equal(p.applied, 3, "已投递+约面+挂了 计入已投出，准备投不算");
  assert.equal(p.interview, 1);
});

test("importLedgerToCampaign 从台账导入且重复跳过", () => {
  const app = loadApp();
  app.store.set("pipeline_ledger", JSON.stringify([
    { co: "某司", role: "Agent 实习生", date: "2026-09-12", status: "已投递", jd: "" },
    { co: "另一家", role: "后端实习生", date: "2026-09-12", status: "已读未回", jd: "" }
  ]));
  app.addCampaign("主线", "agent");
  const id = app.getCampaigns()[0].id;
  app.addCampaignJob(id, "某司", "Agent 实习生", "已投递");
  const r = app.importLedgerToCampaign(id);
  assert.equal(r.ok, true);
  assert.equal(r.added, 1, "台账 2 条里 1 条重复，只导 1 条");
  assert.match(r.msg, /重复自动跳过/);
  assert.equal(app.getCampaigns()[0].jobs.length, 2);
  const empty = app.importLedgerToCampaign("不存在");
  assert.equal(empty.ok, false);
});

test("setCampaignJobStatus / delCampaignJob / delCampaign 正常工作", () => {
  const app = loadApp();
  app.addCampaign("主线", "agent");
  const id = app.getCampaigns()[0].id;
  app.addCampaignJob(id, "A", "岗1", "准备投");
  assert.equal(app.setCampaignJobStatus(id, 0, "约面").ok, true);
  assert.equal(app.getCampaigns()[0].jobs[0].status, "约面");
  assert.equal(app.delCampaignJob(id, 0).ok, true);
  assert.equal(app.getCampaigns()[0].jobs.length, 0);
  assert.equal(app.delCampaign(id).ok, true);
  assert.equal(app.getCampaigns().length, 0);
});

test("分线随备份导出并可导入还原", () => {
  const app = loadApp();
  app.addCampaign("主线", "agent");
  const id = app.getCampaigns()[0].id;
  app.addCampaignJob(id, "某司", "Agent 实习生", "已投递");
  const json = app.buildBackup();
  const data = JSON.parse(json);
  assert.equal(data.version, 4, "备份版本应升到 4（v0.4 起含已收面经）");
  assert.equal(data.campaigns.length, 1);
  const fresh = loadApp();
  const r = fresh.importData(json);
  assert.equal(r.ok, true, r.msg);
  assert.match(r.msg, /分线 1 条/);
  assert.equal(fresh.getCampaigns()[0].jobs[0].co, "某司");
});

test("renderCampaigns 输出分线名与进度，不泄漏内部 id 键", () => {
  const app = loadApp();
  app.addCampaign("后端支线", "be");
  app.renderCampaigns();
  const html = app.el("c-out").innerHTML;
  assert.match(html, /后端支线/);
  assert.match(html, /岗位 0 个/);
  assert.ok(!html.includes("pipeline_campaigns"), "localStorage 键名不得出现在界面");
});
