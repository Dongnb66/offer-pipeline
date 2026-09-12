// 仓库级不变量：安全承诺与文档/代码一致性（对应「声明 vs 机制」自检）
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, readRepoFile } from "../test-support/harness.mjs";

test("仓库内不存在 llm.json（密钥绝不入库）", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "llm.json")), false, "llm.json 出现在工作区");
});

test(".gitignore 必须忽略 llm.json", () => {
  assert.match(readRepoFile(".gitignore"), /^llm\.json$/m);
});

test("index.html 内不含任何硬编码密钥", () => {
  const html = readRepoFile("index.html");
  assert.equal(html.match(/sk-[A-Za-z0-9]{10,}/), null, "疑似硬编码 Key");
  assert.equal(html.match(/Bearer\s+[A-Za-z0-9._-]{20,}/), null, "疑似硬编码 Token");
});

test("本地服务只监听回环地址，不对局域网暴露", () => {
  const srv = readRepoFile("server.js");
  assert.match(srv, /listen\(PORT,\s*"127\.0\.0\.1"/, "必须绑定 127.0.0.1");
  assert.ok(!/0\.0\.0\.0/.test(srv), "不得绑定 0.0.0.0");
});

test("面经抓取只接受 discuss 链接，其余给出可读原因", () => {
  const srv = readRepoFile("server.js");
  assert.match(srv, /discuss/);
  assert.match(srv, /exam 页在登录态抓不到/);
});

test("三不原则在 README 与界面中同时存在（承诺不落空）", () => {
  const html = readRepoFile("index.html");
  const readme = readRepoFile("README.md");
  ["不收账号密码", "不自动代投", "不代填"].forEach((rule) => {
    assert.ok(html.includes(rule), `界面缺少红线文案：${rule}`);
    assert.ok(readme.includes(rule), `README 缺少红线文案：${rule}`);
  });
});

test("start.bat 为纯 ASCII + CRLF（避免中文路径乱码）", () => {
  const buf = fs.readFileSync(path.join(ROOT, "start.bat"));
  const text = buf.toString("utf8");
  assert.equal(buf.toString("latin1") === text, true, "start.bat 含非 ASCII 字符");
  assert.ok(text.includes("\r\n"), "start.bat 必须为 CRLF 换行");
});

test("index.html 保持零外部依赖（无 CDN / 无外链脚本样式）", () => {
  const html = readRepoFile("index.html");
  assert.equal(html.match(/<script[^>]+src=/i), null, "出现外链脚本");
  assert.equal(html.match(/<link[^>]+stylesheet/i), null, "出现外链样式");
  assert.equal(html.match(/https?:\/\/cdn\./i), null, "出现 CDN 依赖");
});
