// 已收面经库：跨篇聚合、必考榜跨篇分级、HR 考点桶、搜索跳转
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

function app() {
  const a = loadApp();
  a.setProfile({ name: "杨运栋", grade: "2028", major: "计算机科学与技术", projects: "", skills: { py: 1, langgraph: 1 } });
  return a;
}

test("saveJing 收录面经；同一篇重复解析自动跳过（按题目集合签名去重）", () => {
  const a = app();
  const qs = ["1. Redis 缓存穿透怎么解决？", "2. MySQL 索引失效的场景？"];
  const r1 = a.saveJing("https://www.nowcoder.com/discuss/1", qs);
  assert.equal(r1.ok, true);
  assert.equal(r1.total, 1);
  const r2 = a.saveJing("https://www.nowcoder.com/discuss/1", [...qs].reverse());
  assert.equal(r2.ok, false, "同题集合换顺序也是同一篇");
  assert.match(r2.msg, /不重复存/);
  assert.equal(a.getJings().length, 1);
});

test("跨篇聚合：考点按「考过的篇数」计数，每篇最多计 1 次", () => {
  const a = app();
  a.saveJing("a", ["1. Redis 缓存穿透怎么解决？", "2. Redis 持久化怎么做？"]);
  a.saveJing("b", ["1. Redis 和 MySQL 数据一致性？"]);
  a.saveJing("c", ["1. 手撕反转链表"]);
  const stats = a.jingTopicStats();
  assert.equal(stats.redis, 2, "Redis 出现在 2 篇里，计 2（a 篇问了两道 Redis 也只计 1 次）");
  assert.equal(stats.mysql, 1, "MySQL 只在 b 篇被考到，计 1");
});

test("跨篇必考榜：3 篇各问 1 次 Redis → P0（与单篇连问 3 次同级）", () => {
  const a = app();
  a.saveJing("a", ["1. Redis 缓存穿透怎么解决？"]);
  a.saveJing("b", ["1. Redis 持久化 RDB 和 AOF？"]);
  a.saveJing("c", ["1. Redis 高可用怎么保证？"]);
  const ranked = a.hotRankCross(["1. Redis 缓存和数据库不一致怎么处理？"]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].lv, "P0", "跨篇 3 次应判 P0");
});

test("单篇连问 3 次仍判 P0（跨篇分级不得弱化原语义）", () => {
  const a = app();
  const ranked = a.hotRankCross([
    "1. Redis 缓存穿透怎么解决？",
    "2. Redis 持久化怎么做？",
    "3. Redis 高可用怎么保证？"
  ]);
  assert.equal(ranked[0].lv, "P0");
});

test("HR/软素质桶：HR 题进面经考点榜，但不混进 JD 分析的缺口区", () => {
  const a = app();
  a.el("b-jing").value = ["1. 实习时长多久？每周实习几天？", "2. 什么时候可以到岗？转正留用比例？"].join("\n");
  a.parseJing();
  const html = a.el("b-jingout").innerHTML;
  assert.match(html, /HR\/软素质/, "HR 题应计入跨篇考点榜");
  assert.equal(html.match(/__[a-z_]+/g), null, "内部键不得泄漏");

  const b = app();
  b.el("j-role").value = "测试岗";
  b.el("j-jd").value = "岗位要求 Python，邮件标题注明「姓名-HR推荐」";
  b.analyzeJD();
  assert.ok(!b.el("j-out").innerHTML.includes("HR/软素质"), "JD 里出现 HR 字样不应被当成能力缺口");
});

test("delJing 删除后跨篇统计同步下降", () => {
  const a = app();
  a.saveJing("a", ["1. Redis 缓存穿透怎么解决？"]);
  a.saveJing("b", ["1. Redis 高可用怎么保证？"]);
  assert.equal(a.jingTopicStats().redis, 2);
  a.delJing(0);
  assert.equal(a.jingTopicStats().redis, 1);
});

test("renderJings 输出已收列表（篇数/来源/题数），空态有引导", () => {
  const a = app();
  a.renderJings();
  assert.match(a.el("b-jings").innerHTML, /还没有收录面经/);
  a.saveJing("https://www.nowcoder.com/discuss/9", ["1. Redis 缓存穿透？"]);
  a.renderJings();
  const html = a.el("b-jings").innerHTML;
  assert.match(html, /已收面经（1 篇）/);
  assert.match(html, /nowcoder\.com\/discuss\/9/);
});

test("parseJing 解析即自动收录，重复点击统计不产生重复收录", () => {
  const a = app();
  a.el("b-jing").value = "1. Redis 缓存穿透怎么解决？\n2. MySQL 索引失效的场景？";
  a.parseJing();
  a.parseJing();
  a.parseJing();
  assert.equal(a.getJings().length, 1, "同一篇解析三次只收一份");
  assert.match(a.el("b-jingout").innerHTML, /跨篇高频考点榜/);
});

test("openNowcoderSearch 按当前方向拼搜索词，零爬取、只开浏览器", () => {
  const a = app();
  const url = a.openNowcoderSearch();
  assert.match(url, /^https:\/\/www\.nowcoder\.com\/search\/all\?query=/);
  assert.ok(decodeURIComponent(url).includes("面经"), "搜索词应带「面经」");
});

test("已收面经进入备份并可还原；非法结构的面经库被拒收", () => {
  const a = app();
  a.saveJing("a", ["1. Redis 缓存穿透怎么解决？"]);
  const json = a.buildBackup();
  const fresh = loadApp();
  const r = fresh.importData(json);
  assert.equal(r.ok, true, r.msg);
  assert.match(r.msg, /面经 1 篇/);
  assert.equal(fresh.getJings().length, 1);

  const bad = fresh.importData('{"jings":"not-an-array"}');
  assert.equal(bad.ok, false);
  assert.match(bad.msg, /面经库不是数组/);
});
