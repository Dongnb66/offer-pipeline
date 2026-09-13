// 测试夹具：把 index.html 里的 <script> 抽出来，在注入桩环境的沙箱中求值，
// 从而在零依赖、无浏览器的情况下测试单文件应用的核心逻辑。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = root;

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error("index.html 中未找到 <script> 块");

export function loadApp(opts = {}) {
  const elems = new Map();

  // 桩 DOM 不解析 HTML：在 innerHTML 被赋值时把其中带 id 的子块注册成可查询元素，
  // 这样 analyzeJD / genPack 生成的 #greet、#pack0 等就能被测试取到文本。
  function registerFromHtml(html) {
    const re = /id="([A-Za-z0-9_-]+)"[^>]*>([\s\S]*?)<\/div>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const child = elems.get(m[1]) || makeEl();
      child.innerHTML = "";
      child.textContent = m[2].trim();
      elems.set(m[1], child);
    }
  }

  function makeEl() {
    const el = {
      value: "",
      textContent: "",
      style: {},
      dataset: {},
      selectedOptions: [{ text: "AI Agent 应用开发" }],
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      appendChild() {},
      click() {},
      onclick: null
    };
    let _html = "";
    Object.defineProperty(el, "innerHTML", {
      get() { return _html; },
      set(v) { _html = String(v); registerFromHtml(_html); }
    });
    return el;
  }

  // 检索桩：返回匹配的元素数组（测试里不渲染真实 DOM，只返回已注册的元素）
  function querySelectorAllStub(sel) {
    const m = /data-t="([a-z]+)"/.exec(sel || "");
    if (m) return [documentStub.getElementById("tab-" + m[1])];
    return [];
  }

  const store = new Map();

  const documentStub = {
    getElementById(id) {
      if (!elems.has(id)) elems.set(id, makeEl());
      return elems.get(id);
    },
    querySelectorAll: querySelectorAllStub,
    createElement() { return makeEl(); },
    activeElement: null
  };

  const localStorageStub = {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); }
  };

  const navigatorStub = { clipboard: { writeText: async () => {} } };
  const alertStub = () => {};
  const confirmStub = () => opts.confirmResult !== false;
  const fetchStub = async () => { throw new Error("测试环境未启用本地服务"); };

  const body = scriptMatch[1] + "\n;return {" +
    "projList,dirBest,renderPlan,renderInfer,confirmInfer,genPack,parseJing,analyzeJD," +
    "renderLedger,renderDirs,renderPrep,loadProfile,saveProfile,esc,monthNow,SKILLS,DIRS,JD_DICT,TOPICS,ALIAS,ADJ,BANK," +
    "addRecord,buildBackup,importData,clearData,copyToClipboard,greetLength,switchTab,msg,toLedger," +
    "qkey,getPrep,prepState,markPrep,prepStats,miniBtns,prepRow,weakList,renderWeak,allPrepItems,hotRank,resetPrep,lastTab,registerQ,PREPKEY,TABKEY," +
    "buildPack,saveSnapshot,getSnaps,restoreSnapshot,delSnapshot,renderSnaps,SNAPKEY," +
    "buildFillScript,packFields,genFillScript," +
    "getCampaigns,addCampaign,onAddCampaign,delCampaign,addCampaignJob,setCampaignJobStatus,delCampaignJob,campaignProgress,importLedgerToCampaign,renderCampaigns,CAMPKEY," +
    "getJings,saveJing,delJing,jingTopicStats,hotRankCross,renderJings,openNowcoderSearch,JINGKEY," +
    "buildPolishReq,KB,SCENE_A,getTarget,studyRow,sceneRow,answerCard,buildQuiz,genQuiz,TARGETKEY,toggleKb,toggleAns," +
    "QBANK,QB_BY_KEY,quizRow,toggleQa,chooseSel," +
    "setProfile:(p)=>{profile=p},getProfile:()=>profile,el:el};";

  const factory = new Function(
    "document", "localStorage", "navigator", "alert", "confirm", "fetch", "window",
    body
  );

  const api = factory(documentStub, localStorageStub, navigatorStub, alertStub, confirmStub, fetchStub, {});
  return { ...api, elems, store };
}

export function readRepoFile(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

export function currentYm() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
