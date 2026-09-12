// 简历直填包生成器（BOSS / 实习僧表单字段）
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp, currentYm } from "../test-support/harness.mjs";

const PROFILE = {
  name: "杨运栋",
  grade: "2028",
  major: "计算机科学与技术",
  school: "吉首大学张家界学院",
  certs: "计算机二级 WPS",
  intern: "",
  github: "https://github.com/Dongnb66",
  projects: [
    "python-learning-agent｜FastAPI+LangGraph 教学智能体，94 条 pytest｜https://github.com/Dongnb66/python-learning-agent｜2026.03",
    "campus-mutual-aid｜校园互助平台，71 条测试｜https://github.com/Dongnb66/campus-mutual-aid"
  ].join("\n"),
  skills: { py: 1, git: 1, test: 1, aitools: 1 }
};

test("genPack 输出 BOSS 与实习僧四类文本块", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  app.genPack();
  const out = app.el("v-out").innerHTML;
  assert.match(out, /BOSS 项目经历/);
  assert.match(out, /BOSS 个人优势/);
  assert.match(out, /BOSS 教育经历/);
  assert.match(out, /实习僧 学术经历/);
});

test("实习僧任职时间结束月份 = 当前月（平台无「至今」选项）", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  app.genPack();
  const out = app.el("v-out").innerHTML;
  assert.ok(out.includes("至 " + currentYm()), "结束月份应等于当前月 " + currentYm());
  assert.ok(!out.includes("2026-03 至 至今"), "实习僧不应出现「至今」");
});

test("业绩栏是防编造占位，不生成任何虚构数字", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  app.genPack();
  const out = app.el("v-out").innerHTML;
  assert.match(out, /别编/, "业绩栏必须保留防编造提示");
  const invented = out.match(/项目业绩：\s*[^【\n]*\d{2,}/g);
  assert.equal(invented, null, "业绩栏不得自动填入数字");
});

test("教育经历按届数推算在校时间，学校字段仅出现在表单块里", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  app.genPack();
  const out = app.el("v-out").innerHTML;
  assert.match(out, /2024\.09-2028\.06/);
  assert.match(out, /学校：吉首大学张家界学院/);
});

test("个人优势至少生成 5 条（不足时留占位提示）", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE });
  app.genPack();
  const out = app.el("v-out").innerHTML;
  assert.match(out, /5\. /);
  assert.match(out, /技术栈：/);
  assert.match(out, /AI 承担提效/);
});

test("项目缺链接时留占位，不伪造链接", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE, skills: { py: 1 }, projects: "无链接项目｜只写了描述没有仓库地址" });
  app.genPack();
  assert.match(app.el("v-out").innerHTML, /【GitHub 链接】/);
});

test("无项目时提示先填项目，而不是输出空块", () => {
  const app = loadApp();
  app.setProfile({ ...PROFILE, projects: "" });
  app.genPack();
  assert.match(app.el("v-out").innerHTML, /至少一个项目/);
});

test("未保存画像时提示", () => {
  const app = loadApp();
  app.genPack();
  assert.match(app.el("v-out").innerHTML, /请先保存画像/);
});
