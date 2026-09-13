// 本地服务：HTML 清洗与链接校验（纯函数级，不需要真起服务）
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../test-support/harness.mjs";

const require = createRequire(import.meta.url);
const srv = require(path.join(ROOT, "server.js"));

test("require 服务模块不会启动监听（保证可测试、可复用）", () => {
  assert.equal(typeof srv.stripHtml, "function");
  assert.equal(typeof srv.PORT, "number");
});

test("stripHtml 去掉脚本与样式，不把代码混进正文", () => {
  const out = srv.stripHtml("<div>题干<script>var a=1;</script><style>.x{color:red}</style>结尾</div>");
  assert.ok(!out.includes("var a=1"), "脚本内容泄漏");
  assert.ok(!out.includes("color:red"), "样式内容泄漏");
  assert.match(out, /题干/);
  assert.match(out, /结尾/);
});

test("stripHtml 把块级标签转成换行，保留题目分行", () => {
  const out = srv.stripHtml("<p>第一题</p><p>第二题</p><li>第三题</li>");
  const lines = out.split("\n").map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(lines, ["第一题", "第二题", "第三题"]);
});

test("stripHtml 解码常见 HTML 实体", () => {
  const out = srv.stripHtml("<p>Redis &amp; MySQL &lt;索引&gt; &quot;八股&quot;</p>");
  assert.match(out, /Redis & MySQL <索引> "八股"/);
});

test("只接受牛客域名，其他站点一律拒绝", () => {
  assert.equal(srv.isNowcoderUrl("https://m.nowcoder.com/discuss/123"), true);
  assert.equal(srv.isNowcoderUrl("https://nowcoder.com/discuss/123"), true);
  assert.equal(srv.isNowcoderUrl("https://evil-nowcoder.com/x"), false, "仿冒域名不得通过");
  assert.equal(srv.isNowcoderUrl("https://example.com/nowcoder.com/discuss/1"), false, "路径里的字样不得通过");
  assert.equal(srv.isNowcoderUrl(""), false);
});

test("discuss 链接可取到 id；exam / feed / 非数字一律不抓", () => {
  assert.equal(srv.parseNowcoderId("https://m.nowcoder.com/discuss/857123"), "857123");
  assert.equal(srv.parseNowcoderId("https://www.nowcoder.com/discuss/857123?type=all"), "857123");
  assert.equal(srv.parseNowcoderId("https://www.nowcoder.com/exam/test/123"), null, "exam 页在登录态，必须拒绝");
  assert.equal(srv.parseNowcoderId("https://m.nowcoder.com/feed/main/detail/abc"), null);
  assert.equal(srv.parseNowcoderId("https://m.nowcoder.com/discuss/"), null);
});

test("请求体上限为 100KB，防止本地服务被灌爆", () => {
  assert.equal(srv.MAX_BODY, 100 * 1024);
});

test("未配置 llm.json 时 loadLLM 返回 null 而不是抛错", () => {
  const cfg = srv.loadLLM();
  assert.ok(cfg === null || typeof cfg === "object");
});

test("checkOrigin 只放行无 Origin / file://(null) / 本机回环，外站一律拒绝", () => {
  assert.equal(srv.checkOrigin({ headers: {} }), true, "同源 GET / curl 无 Origin，放行");
  assert.equal(srv.checkOrigin({ headers: { origin: "null" } }), true, "file:// 离线页 Origin 为 null，放行");
  assert.equal(srv.checkOrigin({ headers: { origin: "http://127.0.0.1:8321" } }), true);
  assert.equal(srv.checkOrigin({ headers: { origin: "http://localhost:3000" } }), true);
  assert.equal(srv.checkOrigin({ headers: { origin: "https://evil.com" } }), false, "外站不得调用本服务");
  assert.equal(srv.checkOrigin({ headers: { origin: "https://127.0.0.1.evil.com" } }), false, "后缀仿冒不得通过");
});

test("牛客抓取必须带超时，不得无限挂起", () => {
  const src = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  assert.match(src, /AbortSignal\.timeout\(\d+\)/, "fetch 必须设置 AbortSignal 超时");
});
