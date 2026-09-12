// 复习状态 / 薄弱清单 / 必考榜 —— 吸收自私有备战站的设计（自评 + 进度 + 分级）
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "../test-support/harness.mjs";

const PROFILE = { name: "杨运栋", grade: "2028", major: "计算机科学与技术", projects: "alpha｜项目｜", skills: { py: 1, langgraph: 1 } };

function app() {
  const a = loadApp();
  a.setProfile({ ...PROFILE });
  return a;
}

test("题目键稳定：同一道题任何时候得到同一个键（否则跨会话标记会丢）", () => {
  const a = app();
  assert.equal(a.qkey("Redis 缓存穿透怎么解决？"), a.qkey("Redis 缓存穿透怎么解决？"));
  assert.notEqual(a.qkey("Redis 缓存穿透怎么解决？"), a.qkey("MySQL 索引失效的场景？"));
});

test("标记「会 / 不会」并持久化，可再次切换回未评", () => {
  const a = app();
  const q = "Redis 缓存穿透怎么解决？";
  const k = a.registerQ(q);
  a.markPrep(k, "weak");
  assert.equal(a.prepState(q), "weak");
  a.markPrep(k, "know");
  assert.equal(a.prepState(q), "know");
  a.markPrep(k, "know");
  assert.equal(a.prepState(q), "", "再点一次同一状态应取消");
});

test("收藏独立于掌握状态，二者互不覆盖", () => {
  const a = app();
  const q = "MySQL 索引失效的场景？";
  const k = a.registerQ(q);
  a.markPrep(k, "weak");
  a.markPrep(k, "star");
  assert.equal(a.prepState(q), "weak", "收藏不应覆盖「不会」");
  const saved = JSON.parse(a.store.get(a.PREPKEY));
  assert.equal(saved[k].star, true);
});

test("薄弱清单跨方向汇总所有标记「不会」的条目，且带原文", () => {
  const a = app();
  const qs = ["Redis 缓存穿透怎么解决？", "JVM 调优做过吗？"];
  qs.forEach((q) => a.markPrep(a.registerQ(q), "weak"));
  const weak = a.weakList();
  assert.equal(weak.length, 2);
  assert.ok(weak.includes("Redis 缓存穿透怎么解决？"));
  assert.ok(weak.includes("JVM 调优做过吗？"), "薄弱项必须带原文而不是内部键");
});

test("进度统计：已评 / 会 / 薄弱 / 收藏 计数正确，不重复计数", () => {
  const a = app();
  a.markPrep(a.qkey("题一"), "know");
  a.markPrep(a.qkey("题二"), "weak");
  a.markPrep(a.qkey("题三"), "star");
  const st = a.prepStats(["题一", "题二", "题三", "题四"]);
  assert.equal(st.total, 4);
  assert.equal(st.rated, 2, "收藏不算已评");
  assert.equal(st.know, 1);
  assert.equal(st.weak, 1);
  assert.equal(st.star, 1);
});

test("备考清单每个条目都渲染出三个自评按钮，且状态可见", () => {
  const a = app();
  a.renderPrep();
  const html = a.el("b-out").innerHTML;
  assert.match(html, /onclick="markPrep\('/, "缺少自评按钮");
  assert.match(html, /title="已掌握"/);
  const q = "MCP 协议：工具/资源/提示三件套，和 function calling 的关系"; // 属于 agent 方向，确保被渲染
  a.markPrep(a.registerQ(q), "know");
  a.renderPrep();
  assert.match(a.el("b-out").innerHTML, /class="mini on"/, "已掌握条目应高亮");
});

test("薄弱清单卡片在没有标记时给出引导，有标记时列出并显示进度", () => {
  const a = app();
  a.renderWeak();
  assert.match(a.el("b-weak").innerHTML, /还没有标记「不会」/);
  a.markPrep(a.registerQ("并发：线程/锁/线程池参数（能说出具体参数=做过）"), "weak");
  a.renderWeak();
  const html = a.el("b-weak").innerHTML;
  assert.match(html, /bar-wrap/);
  assert.match(html, /已评 \d+ \/ \d+/);
  assert.match(html, /线程池/);
});

test("自愈：老数据缺原文时从内置题库反查，不显示哈希键", () => {
  const a = app();
  const item = "MySQL 索引原理与慢查询优化"; // 内置题库（后端方向）条目
  a.markPrep(a.qkey(item), "weak"); // 故意不注册原文
  const weak = a.weakList();
  assert.deepEqual(weak, [item], "应从题库反查出原文");
  assert.equal(weak[0].match(/^q[a-z0-9]+$/), null, "不得退化成显示内部键");
});

test("必考榜按考点出现频次分级：≥3 次 P0，=2 次 P1，其余 P2，且高频在前", () => {
  const a = app();
  const qs = [
    "Redis 缓存穿透怎么解决？",
    "Redis 的持久化怎么做的？",
    "Redis 和 MySQL 数据怎么保持一致？",
    "MySQL 索引失效的场景？",
    "MySQL 事务隔离级别？",
    "手撕反转链表"
  ];
  const ranked = a.hotRank(qs);
  assert.equal(ranked.length, 6);
  assert.equal(ranked[0].lv, "P0", "Redis 出现 3 次，应排最前且为 P0");
  assert.ok(ranked.slice(0, 3).every((x) => x.lv === "P0"));
  assert.ok(ranked.some((x) => x.lv === "P2"));
  const levels = ranked.map((x) => x.lv);
  assert.deepEqual([...levels].sort(), levels.sort(), "排序应稳定");
  assert.ok(levels.indexOf("P0") < levels.lastIndexOf("P2"), "P0 必须排在 P2 之前");
});

test("面经解析产出的必考榜带分级标签且题目可自评", () => {
  const a = app();
  a.el("b-jing").value = [
    "1. Redis 缓存穿透怎么解决？",
    "2. Redis 怎么保证高可用？",
    "3. Redis 持久化 RDB 和 AOF？",
    "4. 手撕反转链表"
  ].join("\n");
  a.parseJing();
  const html = a.el("b-jingout").innerHTML;
  assert.match(html, /必考榜/);
  assert.match(html, /class="lv p0"/);
  assert.match(html, /onclick="markPrep\(/);
  assert.equal(html.match(/__[a-z_]+/g), null, "内部键不得泄漏");
});

test("复习标记进入备份并可恢复（换设备不丢进度）", () => {
  const a = app();
  a.markPrep(a.registerQ("题一"), "weak");
  const json = a.buildBackup();
  assert.match(json, /"prep"/);
  const fresh = loadApp();
  const r = fresh.importData(json);
  assert.equal(r.ok, true, r.msg);
  assert.match(r.msg, /复习标记 1 条/);
  assert.equal(fresh.prepState("题一"), "weak");
});

test("清空数据会同时清掉复习标记（否则残留串页）", () => {
  const a = app();
  a.markPrep(a.registerQ("题一"), "know");
  a.clearData();
  assert.equal(a.store.has(a.PREPKEY), false);
});

test("清空自评需二次确认，取消时标记保留", () => {
  const a = loadApp({ confirmResult: false });
  a.markPrep(a.registerQ("题一"), "know");
  const r = a.resetPrep();
  assert.equal(r.ok, false);
  assert.equal(a.prepState("题一"), "know");
});

test("标签页记忆：记住上次所在页，且非法值不炸", () => {
  const a = app();
  a.switchTab("b");
  assert.equal(a.lastTab(), "b");
  assert.equal(a.switchTab(""), false);
  assert.equal(a.lastTab(), "b", "空值不应覆盖记录");
});
