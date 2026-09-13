// 简历版本快照：生成→存→改→恢复，改口径防覆盖
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

const PROFILE = {
  name: "杨运栋", grade: "2028", major: "计算机科学与技术",
  school: "吉首大学张家界学院", intern: "",
  github: "https://github.com/Dongnb66",
  projects: "alpha｜项目 A 描述｜https://github.com/x/a｜2026.03",
  skills: { py: 1 }
};

function seeded() {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  return app;
}

test("未生成直填包时存快照被拒绝", () => {
  const app = loadApp();
  const r = app.saveSnapshot();
  assert.equal(r.ok, false);
  assert.match(r.msg, /生成直填包/);
});

test("生成→存快照→改画像重生成→恢复旧版内容", () => {
  const app = seeded();
  const secs1 = app.genPack();
  assert.ok(Array.isArray(secs1) && secs1.length >= 4);
  const s1 = app.saveSnapshot();
  assert.equal(s1.ok, true);
  assert.equal(app.getSnaps().length, 1);
  assert.equal(app.getSnaps()[0].secs.length, secs1.length);

  // 模拟改口径：换项目描述再生成
  app.setProfile({ ...PROFILE, projects: "beta｜改坏之后的描述｜｜2026.09" });
  app.genPack();
  assert.match(app.el("v-out").innerHTML, /改坏之后的描述/);

  // 恢复快照 → 旧文案回来
  const r = app.restoreSnapshot(0);
  assert.equal(r.ok, true, r.msg);
  assert.match(app.el("v-out").innerHTML, /项目 A 描述/);
  assert.ok(!app.el("v-out").innerHTML.includes("改坏之后的描述"), "恢复后不应残留新版文案");
  assert.equal(app.getSnaps().length, 1, "恢复不删快照，可反复恢复");
});

test("delSnapshot 删除指定快照；越界恢复被拒", () => {
  const app = seeded();
  app.genPack();
  app.saveSnapshot();
  app.genPack();
  app.saveSnapshot();
  assert.equal(app.getSnaps().length, 2);
  assert.equal(app.delSnapshot(0).ok, true);
  assert.equal(app.getSnaps().length, 1);
  assert.equal(app.restoreSnapshot(5).ok, false);
  assert.match(app.restoreSnapshot(5).msg, /快照不存在/);
});

test("快照随备份导出并可导入还原", () => {
  const app = seeded();
  app.genPack();
  app.saveSnapshot();
  const json = app.buildBackup();
  const data = JSON.parse(json);
  assert.equal(data.snapshots.length, 1);
  const fresh = loadApp();
  const r = fresh.importData(json);
  assert.equal(r.ok, true, r.msg);
  assert.match(r.msg, /简历快照 1 份/);
  assert.equal(fresh.getSnaps()[0].secs[0][0], "BOSS 项目经历");
});

test("clearData 连快照与分线一起清空", () => {
  const app = seeded();
  app.genPack();
  app.saveSnapshot();
  app.addCampaign("主线", "agent");
  const r = app.clearData();
  assert.equal(r.ok, true);
  assert.equal(app.store.has(app.SNAPKEY), false);
  assert.equal(app.store.has(app.CAMPKEY), false);
});
