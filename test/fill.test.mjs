// 控制台填充脚本：红线不变量——只填空框、不发请求、不点按钮
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

const PROFILE = {
  name: "杨运栋", grade: "2028", major: "计算机科学与技术",
  school: "吉首大学张家界学院", intern: "某科技｜后端实习｜2026.07-2026.09｜参与接口开发",
  github: "https://github.com/Dongnb66",
  projects: "alpha｜项目 A 描述｜https://github.com/x/a｜2026.03",
  skills: { py: 1, test: 1, aitools: 1 }
};

function setup() {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  return app;
}

test("packFields(BOSS) 只取 BOSS 块，解析出字段名与值", () => {
  const app = setup();
  const secs = app.buildPack();
  const f = app.packFields("BOSS", secs);
  const labels = f.map((x) => x.label);
  assert.ok(labels.includes("项目名称"), "应解析出项目名称");
  assert.ok(labels.includes("项目内容"));
  assert.ok(labels.includes("项目链接"));
  assert.ok(labels.includes("个人优势"), "个人优势应作为整块字段");
  assert.ok(!f.some((x) => (x.block || "").includes("实习僧")), "BOSS 脚本不得混入实习僧块");
  assert.ok(labels.includes("学校"), "教育经历字段应被解析");
});

test("packFields(实习僧) 取实习僧块，含经历描述与实习经历", () => {
  const app = setup();
  const f = app.packFields("实习僧", app.buildPack());
  const labels = f.map((x) => x.label);
  assert.ok(labels.includes("经历描述"));
  assert.ok(labels.includes("公司"), "实习块的公司字段应被解析");
  assert.ok(!f.some((x) => (x.block || "").includes("BOSS")), "实习僧脚本不得混入 BOSS 块");
});

test("占位符与空值不进脚本（防把【占位】文本填进真表单）", () => {
  const app = setup();
  const f = app.packFields("BOSS", app.buildPack());
  assert.equal(
    f.filter((x) => /^【.*】$/.test(x.value)).length, 0,
    "防编造占位符不得作为字段值嵌入脚本"
  );
  assert.ok(f.every((x) => x.value.trim().length > 0), "空值字段不得进入脚本");
});

test("生成的脚本：不发请求、不点击、不收集密码，明确留给用户自己保存", () => {
  const app = setup();
  const src = app.buildFillScript("BOSS", app.buildPack());
  assert.equal(src.match(/\bfetch\s*\(/g), null, "脚本不得发网络请求");
  assert.ok(!src.includes("XMLHttpRequest"), "脚本不得发网络请求");
  assert.ok(!/\.submit\s*\(|\.click\s*\(/.test(src), "脚本不得点击/提交任何元素");
  assert.ok(!/password|账号密码输入/i.test(src.replace("它不收集账号密码，不发任何网络请求", "")), "不得出现收集口令的逻辑");
  assert.match(src, /自己点保存/, "必须明示最后一步由用户完成");
  assert.match(src, /已填充/, "应有填充结果反馈");
  assert.match(src, /__offerPackApplied/, "应防重复运行");
});

test("脚本内嵌字段数据与平台一致，且防重复运行", () => {
  const app = setup();
  const boss = app.buildFillScript("BOSS", app.buildPack());
  const xs = app.buildFillScript("实习僧", app.buildPack());
  assert.match(boss, /"label":"项目名称"/);
  assert.match(boss, /个人优势/);
  assert.ok(!boss.includes("经历描述"), "BOSS 脚本不应嵌实习僧的经历描述");
  assert.match(xs, /"label":"经历描述"/);
  assert.ok(xs.includes("实习僧"), "脚本头应标明目标平台");
});

test("genFillScript 输出到界面并提供复制块", () => {
  const app = setup();
  const src = app.genFillScript();
  assert.ok(src && src.length > 200);
  assert.match(app.el("v-script").innerHTML, /复制脚本/);
  assert.match(app.el("v-script").innerHTML, /不点保存/, "界面必须重申红线");
});

test("未保存画像时 genFillScript 拒绝并提示", () => {
  const app = loadApp();
  const src = app.genFillScript();
  assert.equal(src, null);
  assert.match(app.el("v-script").innerHTML, /请先保存画像/);
});
