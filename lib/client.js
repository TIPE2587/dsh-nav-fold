window.__ModuleLoader__.load({
	id: "dsh-nav-fold",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
/**
 * dsh-nav-fold · 浏览器半
 *
 * 把左侧栏顶部「功能入口」列表（ui-sidebar 声明的 sidebar.panellist 区域）做成
 * 三态可折叠——展开 / 紧凑图标网格 / 收起，并记住状态。
 *
 * 控件位置：挂在**被折叠的那一组行**的末尾（nav 的最后一个子节点），因为它的作用
 * 对象就是上面那几行，不是会话列表、也不是设置区。
 *
 * 两种控件模型（在「设置 → 功能入口折叠」里切换，存 localStorage）：
 *  - segmented：三档选择器，语义恒定、任意两档直达、当前档高亮（默认）
 *  - cycle：单按钮循环，点一下进下一档
 * 56px 图标轨里两种模型都退化成单个 收起⇄展开 循环按钮（轨道放不下排布）。
 *
 * 边界（设计取舍见 README「设计边界」段）：
 *  - 不读写官方 panelPins（外壳闭包私有内存，重载即重置）
 *  - 不改官方行：只在命中的 nav 上加属性，并追加一个自有控制条节点
 *  - 定位失败只 warn 一次并保持原生 UI
 */
const react = require("react");

/** 插件名（cordis 插件标识） */
const name = "nav-fold";
/** 版本号：必须与 package.json.version 一致（有单测守着） */
const PLUGIN_VERSION = "0.2.0";
/** 设置分区 / 控制条占用者 id */
const ENTRY_ID = "nav-fold";
/** 注入样式表的幂等标记 */
const STYLE_ID = "dsh-nav-fold";
/** localStorage：显示档位（桌面桶） */
const STORAGE_MODE = "dsh-nav-fold/v1/mode";
/** localStorage：显示档位（窄屏 / 手机桶） */
const STORAGE_MODE_NARROW = "dsh-nav-fold/v1/mode-narrow";
/** localStorage：自动档开关 */
const STORAGE_AUTO = "dsh-nav-fold/v1/auto";
/** localStorage：收起态要保留的行（按标签文本） */
const STORAGE_KEEP = "dsh-nav-fold/v1/keep";
/** localStorage：被标题行模型临时改写掉的档位（切回去时还原） */
const STORAGE_STASH = "dsh-nav-fold/v1/mode-stash";
/** localStorage：控件模型 */
const STORAGE_MODEL = "dsh-nav-fold/v1/model";
/** 命中导航元素的标记属性，三态值写在这个属性上 */
const NAV_ATTR = "data-navfold";
/** 自有控制条的标记属性 */
const BAR_ATTR = "data-navfold-bar";
/** 三态顺序即单按钮循环顺序 */
const MODES = ["expanded", "compact", "hidden"];
/** 控件模型 */
const MODELS = ["segmented", "cycle", "header"];
/** 设置菜单里显示的名字（与包名 dsh-nav-fold 同一词根；品牌名不翻译） */
const SETTINGS_LABEL = "nav-fold 导航折叠";
/** locale 命名空间 */
const NS = "dsh-nav-fold";

/** 文案字典：zh 是 key 来源，en 镜像全部 key */
const DICT = {
  zh: {
    "label": SETTINGS_LABEL,
    "density.expanded.label": "文字",
    "density.expanded.title": "显示为文字行（展开）",
    "density.compact.label": "图标",
    "density.compact.title": "显示为紧凑图标网格",
    "density.hidden.label": "收起",
    "density.hidden.title": "收起功能入口（只留第一行与更多）",
    "cycle.expanded": "展开为文字行",
    "cycle.compact": "切换为紧凑图标网格",
    "cycle.hidden": "收起功能入口（只留第一行与更多）",
    "bar.aria": SETTINGS_LABEL + "：显示方式",
    "bar.title": "功能入口显示方式",
    "bar.all": "全部",
    "bar.all.title": "全部功能入口",
    "popover.label": "功能入口",
    "badge.text": "已收起 {hidden}",
    "badge.title": "已收起 {hidden} 个入口，保留 {kept} 个（在设置里增减）",
    "mode.expanded": "文字行",
    "mode.compact": "图标网格",
    "mode.hidden": "已收起",
    "settings.hint": "{label}：把左侧栏顶部那组入口折叠成图标网格或收起，把高度还给会话列表。当前档位：{mode}。",
    "settings.hint.segmented": "三档选择器下，按钮高亮表示当前档位。",
    "settings.hint.cycle": "单按钮循环下，图标就是当前档，点一下换成下一档。",
    "settings.model.group": "控制条样式",
    "settings.model.segmented.title": "三档选择器",
    "settings.model.segmented.desc": "文字 / 图标 / 收起 三个按钮并列，点哪个是哪个",
    "settings.model.cycle.title": "单按钮循环",
    "settings.model.cycle.desc": "一个按钮，点一下换成下一档（文字 → 图标 → 收起）",
    "settings.model.header.title": "标题行",
    "settings.model.header.desc": "整组收成一行「功能入口」标题，点标题展开或收起；图标网格档不可用",
    "header.label": "功能入口",
    "header.collapse": "收起功能入口",
    "header.expand": "展开功能入口",
    "settings.auto.group": "自动档",
    "settings.auto.on.title": "自动档：开",
    "settings.auto.on.desc": "窗口够窄（<768）或够矮（<760）时，第一次打开直接进图标档",
    "settings.auto.off.title": "自动档：关",
    "settings.auto.off.desc": "始终用你选过的档位（没选过就是文字行）",
    "settings.auto.hint": "自动档只决定「第一次打开时用哪档」：手动点过控制条之后以你的选择为准，并按桌面 / 手机分别记住。",
    "settings.keep.hint": "一个都不选就默认保留第一行。",
    "settings.keep.empty": "还没读到侧栏入口——等界面渲染完再打开这里",
    "settings.summary.entries": "{n} 个入口",
    "settings.keptCount": "保留 {kept}/{total}",
    "settings.model.title": "控制条样式",
    "settings.model.desc": "三档并列点选；单按钮点一下换成下一档。",
    "settings.auto.title": "自动档",
    "settings.auto.desc": "首次打开时窗口够窄（<768）或够矮（<760）进图标档；手动选过以你为准。",
    "settings.keep.title": "收起时保留",
    "settings.keep.all": "全部",
    "settings.keep.none": "清空",
    "settings.restore": "恢复默认",
    "settings.restore.confirm": "再点一次确认",
    "settings.rail.hint": "56px 图标轨里两种样式都会收成一个图标，点一下换档。"
  },
  en: {
    "label": SETTINGS_LABEL,
    "density.expanded.label": "Text",
    "density.expanded.title": "Show as full text rows",
    "density.compact.label": "Icons",
    "density.compact.title": "Show as a compact icon grid",
    "density.hidden.label": "Collapse",
    "density.hidden.title": "Collapse the launchers (keep the first row and More)",
    "cycle.expanded": "Expand to text rows",
    "cycle.compact": "Switch to the compact icon grid",
    "cycle.hidden": "Collapse the launchers (keep the first row and More)",
    "bar.aria": SETTINGS_LABEL + ": display style",
    "bar.title": "Launcher display style",
    "bar.all": "All",
    "bar.all.title": "All launchers",
    "popover.label": "Launchers",
    "badge.text": "{hidden} collapsed",
    "badge.title": "{hidden} launchers collapsed, {kept} kept (change it in Settings)",
    "mode.expanded": "text rows",
    "mode.compact": "icon grid",
    "mode.hidden": "collapsed",
    "settings.hint": "{label}: fold the sidebar launcher list into an icon grid or collapse it, giving the height back to sessions. Current: {mode}.",
    "settings.hint.segmented": "With the segmented control the highlighted button is the current state.",
    "settings.hint.cycle": "With the cycle button the icon is the current state; click to advance.",
    "settings.model.group": "Control style",
    "settings.model.segmented.title": "Segmented",
    "settings.model.segmented.desc": "Three buttons — text / icons / collapse; click one to go there",
    "settings.model.cycle.title": "Cycle button",
    "settings.model.cycle.desc": "One button; click to advance (text → icons → collapse)",
    "settings.model.header.title": "Header row",
    "settings.model.header.desc": "Fold the whole group into one launcher header you click to expand or collapse",
    "header.label": "Launchers",
    "header.collapse": "Collapse the launchers",
    "header.expand": "Expand the launchers",
    "settings.auto.group": "Automatic",
    "settings.auto.on.title": "Automatic: on",
    "settings.auto.on.desc": "First open collapses to icons when the window is under 768 wide or 760 tall",
    "settings.auto.off.title": "Automatic: off",
    "settings.auto.off.desc": "Always use your last choice (text rows when there is none)",
    "settings.auto.hint": "Automatic only picks the very first state; once you click the control bar your choice wins, remembered per desktop / mobile.",
    "settings.keep.hint": "None selected keeps the first row.",
    "settings.keep.empty": "No launcher rows seen yet — open this again once the UI has rendered",
    "settings.summary.entries": "{n} entries",
    "settings.keptCount": "{kept}/{total} kept",
    "settings.model.title": "Control style",
    "settings.model.desc": "Segmented picks directly; the cycle button advances one step.",
    "settings.auto.title": "Automatic",
    "settings.auto.desc": "First open uses icons when the window is under 768 wide or 760 tall; your own choice wins after that.",
    "settings.keep.title": "Kept while collapsed",
    "settings.keep.all": "All",
    "settings.keep.none": "None",
    "settings.restore": "Restore defaults",
    "settings.restore.confirm": "Click again to confirm",
    "settings.rail.hint": "In the 56px rail both styles reduce to a single icon you click to advance."
  }
};

/**
 * 取一条文案。
 * @param dict - 字典。
 * @param key - key。
 * @returns 文案（缺失时回退为 key）。
 */
function dictText(dict, key) {
  return dict && typeof dict[key] === "string" ? dict[key] : key;
}

/**
 * 占位符替换（{name}）。
 * @param text - 模板。
 * @param params - 变量。
 * @returns 结果文本。
 */
function formatText(text, params) {
  if (!params) return text;
  return String(text).replace(/\{(\w+)\}/g, (whole, name) => (params[name] === undefined ? whole : String(params[name])));
}

/** 当前翻译函数；locale 服务可用时被换成 bound 版本 */
let t = (key, params) => formatText(dictText(DICT.zh, key), params);
/** 与外壳自身抽屉断点一致 */
const NARROW_QUERY = "(max-width: 767px)";
/** 定位重扫的节流窗口 */
const RESCAN_MS = 150;
/** 侧栏收成 56px 图标轨时，控制条只留图标 */
const ICON_ONLY_WIDTH = 120;
/** 首屏宽限：React 还没渲染出侧栏时的“找不到”不算结构变更 */
const WARN_AFTER_MS = 3000;
/** 自动档：窗口高度低于这个值就进图标档（宽度另有 767 断点） */
const AUTO_HEIGHT_PX = 760;

/** 图标（16 网格，stroke 走 currentColor） */
const CHEVRON_UP = ["M4 10.5 8 6.5l4 4"];
const CHEVRON_DOWN = ["M4 6.5 8 10.5l4-4"];
const LIST_ICON = ["M2.5 4h11", "M2.5 8h11", "M2.5 12h11"];
const ALL_ICON = ["M3 3.5h10v10H3z", "M5.5 8l1.8 1.8L10.8 6.3"];
const NONE_ICON = ["M3 3.5h10v10H3z", "M5.8 10.2 10.2 5.8", "M10.2 10.2 5.8 5.8"];
const GRID_ICON = ["M2.5 2.5h4.2v4.2h-4.2z", "M9.3 2.5h4.2v4.2h-4.2z", "M2.5 9.3h4.2v4.2h-4.2z", "M9.3 9.3h4.2v4.2h-4.2z"];
const TEXT_ICON = ["M2.5 4h11", "M2.5 8h11", "M2.5 12h7"];
const CYCLE_ICON = ["M3 8a5 5 0 0 1 8.5-3.5L13 6", "M13 3v3h-3", "M13 8a5 5 0 0 1-8.5 3.5L3 10", "M3 13v-3h3"];

/** 每档的图标（文案走 t()） */
const DENSITY_ICON = {
  expanded: TEXT_ICON,
  compact: GRID_ICON,
  hidden: CHEVRON_UP
};

/**
 * 某一档的图标。
 * @param mode - 档位。
 * @returns 图标路径。
 */
function densityIcon(mode) {
  return DENSITY_ICON[mode] || TEXT_ICON;
}

/**
 * 某一档的按钮短名。
 * @param mode - 档位。
 * @returns 短名。
 */
function densityLabel(mode) {
  return t("density." + mode + ".label");
}

/**
 * 某一档的 tooltip。
 * @param mode - 档位。
 * @returns 说明。
 */
function densityTitle(mode) {
  return t("density." + mode + ".title");
}

/**
 * 折叠表现全部收在自有命名空间下：只作用于带 data-navfold 属性的那一个 nav。
 * 紧凑态用 clip 隐藏文字而不是 display:none，保留无障碍名与 tooltip。
 */
const CSS_TEXT = [
  "/* dsh-nav-fold v" + PLUGIN_VERSION + "：功能入口三态（只作用于被打标的 nav） */",
  'nav[data-navfold="compact"]{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(34px,1fr));gap:2px;align-content:start;justify-items:stretch}',
  'nav[data-navfold="compact"]>button{position:relative!important;justify-content:center!important;padding:0!important;min-height:32px!important;height:32px!important}',
  'nav[data-navfold="compact"]>button>span+span{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}',
  'nav[data-navfold="compact"]>span{display:flex!important;align-items:center;position:relative}',
  'nav[data-navfold="compact"]>span>button{position:relative!important;justify-content:center!important;padding:0!important;min-height:32px!important;height:32px!important;width:100%!important}',
  'nav[data-navfold="compact"]>span>button>span+span{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}',
  'nav[data-navfold="hidden"]>button:not([data-navfold-keep]){display:none!important}',
  // rc.2 起每个入口多一层 div.panelEntry：同一套表现要按包裹层再写一遍
  'nav[data-navfold="compact"]>div:not([' + BAR_ATTR + ']){display:flex!important;min-width:0}',
  'nav[data-navfold="compact"]>div:not([' + BAR_ATTR + '])>button{flex:1!important;position:relative!important;justify-content:center!important;padding:0!important;min-height:32px!important;height:32px!important;border-radius:8px!important}',
  'nav[data-navfold="compact"]>div:not([' + BAR_ATTR + '])>button>span+span{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important}',
  'nav[data-navfold="compact"]>div:not([' + BAR_ATTR + '])>button:not([class*="panelRow"]){display:none!important}',
  'nav[data-navfold="hidden"]>div:not([data-navfold-keep]):not([' + BAR_ATTR + ']){display:none!important}',
  "nav[data-navfold]>[" + BAR_ATTR + "] [data-navfold-count]{margin-right:2px;font-variant-numeric:tabular-nums;opacity:.8}",
  "nav[data-navfold]>[" + BAR_ATTR + "]{display:flex;align-items:center;justify-content:flex-end;gap:2px;height:22px;margin-top:2px;padding:0 2px;font-size:11px;line-height:1;color:var(--dsw-alias-label-tertiary,#8a8a8a)}",
  'nav[data-navfold="compact"]>[' + BAR_ATTR + "]{grid-column:1/-1}",
  "nav[data-navfold]>[" + BAR_ATTR + "] button{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 5px;border:1px solid transparent;border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer}",
  "nav[data-navfold]>[" + BAR_ATTR + "] button:hover{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.14));color:var(--dsw-alias-label-secondary,#555)}",
  'nav[data-navfold]>[' + BAR_ATTR + '] button[aria-pressed="true"]{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.16));color:var(--dsw-alias-label-primary,#111)}',
  "nav[data-navfold]>[" + BAR_ATTR + "] button:focus-visible{outline:2px solid var(--dsw-alias-accent,currentColor);outline-offset:1px}",
  "nav[data-navfold]>[" + BAR_ATTR + "] button[data-navfold-action=\"cycle\"]{padding:0 10px}",
  "nav[data-navfold]>[" + BAR_ATTR + "][data-navfold-icononly]{justify-content:center;padding:0;margin-top:4px}",
  "nav[data-navfold]>[" + BAR_ATTR + "][data-navfold-icononly] [data-navfold-label]{display:none}",
  // 设置面板控件：状态样式只写在 CSS 里（内联混用 border 简写/长写会被 React diff 清成黑色）
  "[data-navfold-model]{border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#666);border-radius:6px;cursor:pointer}",
  "[data-navfold-model]:hover{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.12))}",
  '[data-navfold-model][aria-checked="true"]{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#111);border-color:var(--dsw-alias-label-tertiary,rgba(0,0,0,.28));font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.06)}',
  "[data-navfold-auto]{position:relative;width:38px;height:22px;padding:0;border:none;border-radius:999px;background:var(--dsw-alias-border-l2,rgba(0,0,0,.15));cursor:pointer;flex:0 0 auto}",
  '[data-navfold-auto][aria-checked="true"]{background:var(--dsw-alias-accent,#4d6bfe)}',
  "[data-navfold-auto]>span{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:999px;background:#fff;transition:left .12s ease}",
  '[data-navfold-auto][aria-checked="true"]>span{left:19px}',
  "[data-navfold-keep-row]{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.15));background:transparent;color:var(--dsw-alias-label-primary,#111);font-size:12px;line-height:1.5;cursor:pointer}",
  "[data-navfold-keep-row]:hover{border-color:var(--dsw-alias-label-tertiary,rgba(0,0,0,.3))}",
  '[data-navfold-keep-row][aria-pressed="true"]{border-color:var(--dsw-alias-accent,#4d6bfe);background:var(--dsw-alias-bg-layer-2,rgba(77,107,254,.10))}',
  '[data-navfold-keep-row]>span[aria-hidden="true"]{font-size:11px;color:var(--dsw-alias-accent,#4d6bfe)}',
  "nav[data-navfold]>[" + BAR_ATTR + "][data-navfold-header]{justify-content:flex-start;height:34px;margin:0 0 2px;padding:0 2px}",
  "nav[data-navfold]>[" + BAR_ATTR + "][data-navfold-header] button{display:inline-flex;align-items:center;gap:6px;width:100%;height:30px;padding:0 6px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#111);font-size:13px;cursor:pointer;justify-content:flex-start}",
  "nav[data-navfold]>[" + BAR_ATTR + "][data-navfold-header] button:hover{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.12))}",
  "[data-navfold-header-count]{color:var(--dsw-alias-label-tertiary,#8a8a8a);font-size:12px;font-variant-numeric:tabular-nums}",
  "[data-navfold-popover]{position:fixed;z-index:2147483000;min-width:180px;max-height:60vh;overflow:auto;display:grid;gap:2px;padding:6px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.15));background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 8px 24px rgba(0,0,0,.16)}",
  "[data-navfold-popover] button{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary,#111);font-size:12px;text-align:left;cursor:pointer}",
  "[data-navfold-popover] button:hover{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.14))}",
  "[data-navfold-micro]{padding:2px 6px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#777);font-size:12px;cursor:pointer}",
  "[data-navfold-micro]:hover{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.12))}",
  "[data-navfold-restore]{padding:3px 10px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.15));background:transparent;color:var(--dsw-alias-label-secondary,#666);font-size:12px;cursor:pointer}",
  "[data-navfold-restore]:hover{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.12))}",
  '[data-navfold-restore="confirm"]{border-color:var(--dsw-alias-state-error-primary,#d14343);color:var(--dsw-alias-state-error-primary,#d14343)}'
].join("\n");

/** 运行时单例 */
const runtime = {
  nav: null,
  bar: null,
  mode: "expanded",
  model: "segmented",
  auto: true,
  narrow: false,
  keep: [],
  totals: { kept: 1, total: 0 },
  signature: "",
  observer: null,
  resize: null,
  viewportHandler: null,

  timer: 0,
  warned: false,
  iconOnly: false,
  mountedAt: 0,
  listeners: new Set(),
  popover: null,
  headerDrift: 0,
  modeStash: null,
  confirmReset: false,
  resetTimer: 0
};

/* ───────────────────────── 纯函数（可单测） ───────────────────────── */

/**
 * 三态循环：展开 → 紧凑 → 收起 → 展开。
 * @param mode - 当前档位。
 * @returns 下一档位。
 */
function nextMode(mode) {
  const at = MODES.indexOf(mode);
  return MODES[(at + 1) % MODES.length];
}

/**
 * 决定启动档位：该设备桶的存档优先；否则手机一律图标档，桌面再按自动档看窗口高度。
 * @param stored - 该桶的存档。
 * @param narrow - 是否窄屏。
 * @param height - 视口高度。
 * @param auto - 自动档是否开启。
 * @returns 合法档位。
 */
function pickInitialMode(stored, narrow, height, auto) {
  if (typeof stored === "string" && MODES.indexOf(stored) !== -1) return stored;
  if (narrow) return "compact";
  if (auto && autoWantsCompact(false, height)) return "compact";
  return "expanded";
}

/**
 * 自动档开关的存档解析。
 * @param stored - localStorage 原始值。
 * @returns 是否开启。
 */
function resolveAuto(stored) {
  return stored !== "off";
}

/**
 * 决定控件模型：已存值优先，否则三档选择器。
 * @param stored - localStorage 里的原始值。
 * @returns 合法模型。
 */
function resolveModel(stored) {
  return typeof stored === "string" && MODELS.indexOf(stored) !== -1 ? stored : "segmented";
}

/**
 * 当前设备桶该用哪个 localStorage 键。
 * @param narrow - 是否窄屏。
 * @returns 存储键。
 */
function modeKey(narrow) {
  return narrow ? STORAGE_MODE_NARROW : STORAGE_MODE;
}

/**
 * 自动档：窗口够矮（或本来就在窄屏）时该不该进图标档。
 * @param narrow - 是否命中窄屏断点。
 * @param height - 视口高度。
 * @returns 是否应该自动进图标档。
 */
function autoWantsCompact(narrow, height) {
  if (narrow) return true;
  return typeof height === "number" && height > 0 && height < AUTO_HEIGHT_PX;
}

/** 是不是我们自己的控制条。 */
function isOwnBar(el) {
  return !!el && el !== runtime.bar && typeof el.getAttribute === "function" && el.getAttribute(BAR_ATTR) !== null;
}

/**
 * 在包裹层里找行按钮（不依赖 querySelector，假 DOM 与真 DOM 都能跑）。
 * rc.2 起结构是 div.panelEntry > button.panelRow，Tooltip 不额外包一层。
 * @param host - 包裹层元素。
 * @returns 行按钮或 null。
 */
function findRowButton(host) {
  if (!host || !host.children) return null;
  const kids = host.children;
  for (let i = 0; i < kids.length; i += 1) {
    const kid = kids[i];
    if (kid && kid.tagName === "BUTTON") return kid;
    if (kid && kid.children) {
      for (let j = 0; j < kid.children.length; j += 1) {
        if (kid.children[j] && kid.children[j].tagName === "BUTTON") return kid.children[j];
      }
    }
  }
  return null;
}

/**
 * 把 nav 的直接子节点归一成「入口行」。
 * - rc.1 及更早：子节点本身就是 button.panelRow
 * - rc.2 起：子节点是 div.panelEntry，按钮在它里面（行内可能还有 panelUnpin 等按钮）
 * @param child - nav 的直接子节点。
 * @returns { wrapper, button }；不是入口行时返回 null。
 */
function rowOf(child) {
  if (!child || child === runtime.bar || isOwnBar(child)) return null;
  if (child.tagName === "BUTTON") return { wrapper: child, button: child };
  if (child.tagName !== "DIV") return null;
  const btn = findRowButton(child);
  return btn ? { wrapper: child, button: btn } : null;
}

/** 「更多」锚点里的按钮（rc.1 span.moreAnchor 与 rc.3 换了类名的 span 都按 tagName 认）。 */
function moreButtonOf(child) {
  if (!child || child.tagName !== "SPAN") return null;
  return findRowButton(child);
}

/**
 * 判断一个元素是否是「功能入口」导航。
 * 判据只看结构不认类名（宿主类名每版都变）：
 * - 子节点是入口行（button，或 rc.2+ 的 div 包裹 + 按钮）与「更多」span；
 * - 至少 2 行，或 1 行且带 aria-label（窄屏时外壳不渲染标题 span，不能靠“两段结构”判定）；
 * - 不含输入控件 / 链接。
 * @param node - 待判定元素。
 * @returns 命中与否。
 */
function looksLikePanelNav(node) {
  if (!node || node.tagName !== "NAV") return false;
  const kids = node.children;
  if (!kids || kids.length === 0) return false;
  let rows = 0;
  let labelled = 0;
  for (let i = 0; i < kids.length; i += 1) {
    const kid = kids[i];
    if (kid === runtime.bar || isOwnBar(kid)) continue;
    const row = rowOf(kid);
    if (row) {
      rows += 1;
      if (typeof row.button.getAttribute === "function" && row.button.getAttribute("aria-label")) labelled += 1;
      continue;
    }
    if (kid.tagName === "SPAN") continue;
    return false;
  }
  if (rows === 0) return false;
  if (rows < 2 && labelled === 0) return false;
  if (typeof node.querySelector === "function" && node.querySelector("input, textarea, select, a, form")) return false;
  return true;
}

/**
 * 在文档里找「功能入口」导航。
 * @param doc - document 或等价对象。
 * @returns 命中的 nav，或 null。
 */
function findNav(doc) {
  if (!doc || typeof doc.querySelectorAll !== "function") return null;
  const navs = doc.querySelectorAll("nav");
  if (!navs || navs.length === 0) return null;
  let best = null;
  let bestRows = 0;
  for (let i = 0; i < navs.length; i += 1) {
    if (!looksLikePanelNav(navs[i])) continue;
    let count = 0;
    const kids = navs[i].children || [];
    for (let j = 0; j < kids.length; j += 1) if (rowOf(kids[j])) count += 1;
    if (count > bestRows) {
      best = navs[i];
      bestRows = count;
    }
  }
  return best;
}

/** 找不到导航时打一条可复现的结构诊断（宿主改版时靠它定位）。 */
function describeNavs(doc) {
  if (!doc || typeof doc.querySelectorAll !== "function") return "";
  const navs = doc.querySelectorAll("nav");
  const parts = [];
  for (let i = 0; i < navs.length && i < 3; i += 1) {
    const kids = navs[i].children || [];
    const shape = [];
    for (let j = 0; j < kids.length && j < 6; j += 1) {
      const kid = kids[j];
      const inner = kid && kid.children ? kid.children.length : 0;
      shape.push(kid.tagName + (inner ? "(" + inner + ")" : ""));
    }
    parts.push("nav[" + i + "] " + kids.length + " kids: " + shape.join(","));
  }
  return parts.join(" | ");
}

/**
 * 判断文档是否满足互动所需的最小能力。
 * @param doc - document。
 * @returns 是否可用。
 */
function hasDom(doc) {
  return !!doc && typeof doc.createElement === "function" && typeof doc.querySelector === "function";
}

/* ───────────────────────── DOM 层 ───────────────────────── */

/**
 * 幂等注入样式表。
 * @param doc - document。
 * @returns 注入的 style 元素；已存在时返回 null。
 */
function ensureStyle(doc) {
  if (!hasDom(doc)) return null;
  if (doc.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')) return null;
  const style = doc.createElement("style");
  style.setAttribute("data-plugin-css", STYLE_ID);
  style.textContent = CSS_TEXT;
  (doc.head || doc.documentElement).appendChild(style);
  return style;
}

/**
 * 画一个小图标（16 网格）。
 * @param doc - document。
 * @param paths - path 的 d 值列表。
 * @param size - 边长。
 * @returns svg 元素。
 */
function makeIcon(doc, paths, size) {
  const svg = doc.createElementNS ? doc.createElementNS("http://www.w3.org/2000/svg", "svg") : doc.createElement("svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", String(size || 12));
  svg.setAttribute("height", String(size || 12));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.4");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (let i = 0; i < paths.length; i += 1) {
    const path = doc.createElementNS ? doc.createElementNS("http://www.w3.org/2000/svg", "path") : doc.createElement("path");
    path.setAttribute("d", paths[i]);
    svg.appendChild(path);
  }
  return svg;
}

/**
 * 造一个控制条按钮：图标 + 文字，点击执行一个动作。
 * @param doc - document。
 * @param action - expanded | compact | hidden | cycle。
 * @param label - 文字标签（图标轨里被 CSS 隐藏）。
 * @param title - tooltip 与无障碍名。
 * @param iconPaths - 图标路径。
 * @param pressed - 传入时写 aria-pressed（三档选择器用）。
 * @returns button 元素。
 */
function makeAction(doc, action, label, title, iconPaths, pressed) {
  const button = doc.createElement("button");
  button.setAttribute("type", "button");
  button.setAttribute("data-navfold-action", action);
  button.setAttribute("title", title);
  button.setAttribute("aria-label", title);
  if (typeof pressed === "boolean") button.setAttribute("aria-pressed", pressed ? "true" : "false");
  button.appendChild(makeIcon(doc, iconPaths));
  const text = doc.createElement("span");
  text.setAttribute("data-navfold-label", "");
  text.textContent = label;
  button.appendChild(text);
  button.addEventListener("click", (event) => {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
      event.stopPropagation();
    }
    if (action === "all") toggleAll();
    else if (action === "cycle") setMode(nextMode(runtime.mode));
    else setMode(action);
  });
  return button;
}

/**
 * 造单按钮循环控件：**一次只显示当前档那一个图标**（与三档选择器用同一套图标），
 * 点一下换成下一档的图标。tooltip 说明点下去会变成什么。
 * @param doc - document。
 * @returns button 元素。
 */
function makeCycle(doc) {
  const next = nextMode(runtime.mode);
  const button = doc.createElement("button");
  button.setAttribute("type", "button");
  button.setAttribute("data-navfold-action", "cycle");
  button.setAttribute("data-navfold-glyph", runtime.mode);
  button.setAttribute("title", t("cycle." + next));
  button.setAttribute("aria-label", t("cycle." + next));
  button.setAttribute("data-navfold-size", "large");
  button.appendChild(makeIcon(doc, densityIcon(runtime.mode), 14));
  button.addEventListener("click", (event) => {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
      event.stopPropagation();
    }
    setMode(nextMode(runtime.mode));
  });
  return button;
}

/** 浮层的 Esc / 点外部 / 滚动 关闭处理器（挂载时注册，关闭时解绑） */
function onPopoverKey(event) {
  if (!event || event.key !== "Escape") return;
  if (typeof event.preventDefault === "function") event.preventDefault();
  closeAll();
}

function onPopoverOutside(event) {
  if (!runtime.popover) return;
  const target = event && event.target;
  if (!target) return;
  // 点触发按钮交给它自己 toggle，避免"关了又立刻打开"
  if (typeof target.closest === "function" && target.closest('[data-navfold-action="all"]')) return;
  if (typeof runtime.popover.contains === "function" && runtime.popover.contains(target)) return;
  closeAll();
}

/** 关闭"全部入口"浮层。 */
function closeAll() {
  const pop = runtime.popover;
  runtime.popover = null;
  if (typeof window.removeEventListener === "function") {
    window.removeEventListener("keydown", onPopoverKey, true);
    window.removeEventListener("pointerdown", onPopoverOutside, true);
    window.removeEventListener("scroll", closeAll, true);
  }
  if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
}

/** 打开/关闭"全部入口"浮层：收起态下一键直达任一入口。 */
function toggleAll() {
  if (runtime.popover) {
    closeAll();
    return;
  }
  const doc = document;
  const rows = collectRows(runtime.nav || null);
  if (!rows.length || !doc || !doc.body) return;
  const pop = doc.createElement("div");
  pop.setAttribute("data-navfold-popover", "");
  pop.setAttribute("role", "menu");
  pop.setAttribute("aria-label", t("popover.label"));
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const item = doc.createElement("button");
    item.setAttribute("type", "button");
    item.setAttribute("role", "menuitem");
    item.textContent = row.label;
    item.addEventListener("click", (event) => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
        event.stopPropagation();
      }
      closeAll();
      try {
        if (row.el && typeof row.el.click === "function") row.el.click();
      } catch (err) {
        warn("打开入口失败", err);
      }
    });
    pop.appendChild(item);
  }
  doc.body.appendChild(pop);
  const bar = runtime.bar;
  if (bar && typeof bar.getBoundingClientRect === "function" && typeof window.innerWidth === "number") {
    const rect = bar.getBoundingClientRect();
    const popRect = typeof pop.getBoundingClientRect === "function" ? pop.getBoundingClientRect() : null;
    const width = (popRect && popRect.width) || 200;
    const height = (popRect && popRect.height) || 0;
    const left = (rect.left || 0) + (rect.width || 0) - width;
    // 上方放不下就翻到控制条下方，避免贴到视口顶部盖住入口
    const above = (rect.top || 0) - height - 6;
    const below = (rect.top || 0) + (rect.height || 0) + 6;
    const top = above >= 8 ? above : Math.min(below, (window.innerHeight || 0) - height - 8);
    pop.style.top = Math.max(8, top) + "px";
    pop.style.left = Math.max(8, Math.min(left, window.innerWidth - width - 8)) + "px";
  }
  runtime.popover = pop;
  if (typeof window.addEventListener === "function") {
    window.addEventListener("keydown", onPopoverKey, true);
    window.addEventListener("pointerdown", onPopoverOutside, true);
    window.addEventListener("scroll", closeAll, true);
  }
  const first = pop.children && pop.children[0];
  if (first && typeof first.focus === "function") first.focus();
}

/**
 * 按当前档位与控件模型重绘控制条。
 */
function renderBar() {
  const bar = runtime.bar;
  if (!bar) return;
  const signature =
    runtime.model +
    "|" +
    runtime.mode +
    "|" +
    (runtime.iconOnly ? "rail" : "wide") +
    "|" +
    runtime.totals.kept +
    "/" +
    runtime.totals.total;
  if (signature === runtime.signature) return;
  runtime.signature = signature;
  const doc = bar.ownerDocument || document;
  bar.textContent = "";
  // 收起态先给一个"藏了多少"的徽标
  const hiddenCount = Math.max(0, runtime.totals.total - runtime.totals.kept);
  if (runtime.model !== "header" && runtime.mode === "hidden" && runtime.totals.total > 0 && hiddenCount > 0) {
    const badge = doc.createElement("span");
    badge.setAttribute("data-navfold-count", "");
    badge.setAttribute("title", t("badge.title", { hidden: hiddenCount, kept: runtime.totals.kept }));
    badge.textContent = t("badge.text", { hidden: hiddenCount });
    bar.appendChild(badge);
  }
  // 图标轨里放不下排布，两种模型都退化成单按钮循环
  const allButton = () => makeAction(doc, "all", t("bar.all"), t("bar.all.title"), LIST_ICON);
  if (runtime.iconOnly) {
    bar.appendChild(makeCycle(doc));
    if (runtime.mode === "hidden") bar.appendChild(allButton());
    return;
  }
  if (runtime.model === "header") {
    bar.appendChild(makeHeaderButton(doc));
    return;
  }
  if (runtime.model === "cycle") {
    bar.appendChild(makeCycle(doc));
    if (runtime.mode === "hidden") bar.appendChild(allButton());
    return;
  }
  for (let i = 0; i < MODES.length; i += 1) {
    const mode = MODES[i];
    bar.appendChild(makeAction(doc, mode, densityLabel(mode), densityTitle(mode), densityIcon(mode), mode === runtime.mode));
  }
  if (runtime.mode === "hidden") bar.appendChild(allButton());
}

/**
 * 侧栏是否被外壳收成了 56px 图标轨。
 * 先读外壳自己的状态属性（收起时内容只是被平移到轨道里、布局宽度不变，量不出来），
 * 读不到再退回宽度判断。
 * @param nav - 命中的 nav。
 * @returns 是否图标轨。
 */
function isRailMode(nav) {
  if (typeof document !== "undefined" && document && typeof document.querySelector === "function") {
    const collapsed = document.querySelector('[data-sidebar-collapsed="true"]');
    if (collapsed) return typeof collapsed.contains === "function" ? collapsed.contains(nav) : true;
    const expanded = document.querySelector('[data-sidebar-collapsed="false"]');
    if (expanded) return false;
  }
  const width = typeof nav.clientWidth === "number" ? nav.clientWidth : 0;
  return width > 0 && width < ICON_ONLY_WIDTH;
}

/**
 * 造"标题行"控件：整组只留这一行，点一下展开/收起。
 * @param doc - document。
 * @returns button 元素。
 */
function makeHeaderButton(doc) {
  const collapsed = runtime.mode === "hidden";
  const hiddenCount = Math.max(0, runtime.totals.total - runtime.totals.kept);
  const button = doc.createElement("button");
  button.setAttribute("type", "button");
  button.setAttribute("data-navfold-action", "header-toggle");
  button.setAttribute("title", collapsed ? t("header.expand") : t("header.collapse"));
  button.setAttribute("aria-label", collapsed ? t("header.expand") : t("header.collapse"));
  button.setAttribute("aria-expanded", collapsed ? "false" : "true");
  button.appendChild(makeIcon(doc, collapsed ? CHEVRON_DOWN : CHEVRON_UP, 14));
  const label = doc.createElement("span");
  label.textContent = t("header.label");
  button.appendChild(label);
  const count = doc.createElement("span");
  count.setAttribute("data-navfold-header-count", "");
  count.textContent = collapsed ? t("badge.text", { hidden: hiddenCount }) : String(runtime.totals.total);
  button.appendChild(count);
  button.addEventListener("click", (event) => {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
      event.stopPropagation();
    }
    setMode(runtime.mode === "hidden" ? "expanded" : "hidden");
  });
  return button;
}

/**
 * 让控制条跟上宽度档。
 * @param nav - 命中的 nav。
 */
function syncWidth(nav) {
  const bar = runtime.bar;
  if (!bar || !nav || typeof bar.removeAttribute !== "function") return;
  const iconOnly = isRailMode(nav);
  if (iconOnly) bar.setAttribute("data-navfold-icononly", "");
  else bar.removeAttribute("data-navfold-icononly");
  if (iconOnly !== runtime.iconOnly) {
    runtime.iconOnly = iconOnly;
    renderBar();
  }
}

/**
 * 把控制条挂到 nav 的末尾，并刷新内容。
 * @param nav - 命中的 nav。
 */
function mountBar(nav) {
  if (!nav) return;
  const doc = nav.ownerDocument || document;
  if (!runtime.bar) {
    const bar = doc.createElement("div");
    bar.setAttribute(BAR_ATTR, "");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", t("bar.aria"));
    bar.setAttribute("title", t("bar.title"));
    runtime.bar = bar;
  }
  const wantFirst = runtime.model === "header";
  if (typeof runtime.bar.setAttribute === "function") {
    if (wantFirst) runtime.bar.setAttribute("data-navfold-header", "");
    else if (typeof runtime.bar.removeAttribute === "function") runtime.bar.removeAttribute("data-navfold-header");
  }
  const kids = nav.children || [];
  const atFirst = kids[0] === runtime.bar;
  const atLast = kids[kids.length - 1] === runtime.bar;
  if (runtime.bar.parentNode !== nav || (wantFirst ? !atFirst : !atLast)) {
    if (wantFirst && typeof nav.insertBefore === "function") nav.insertBefore(runtime.bar, kids[0] || null);
    else nav.appendChild(runtime.bar);
  }
  syncKeeps(nav);
  syncWidth(nav);
  syncTitles(nav);
  renderBar();
}

/** 把当前档位写到命中的 nav 上（CSS 只认这一个属性）。 */
function paintNav() {
  const nav = runtime.nav;
  if (!nav || typeof nav.setAttribute !== "function") return;
  try {
    nav.setAttribute(NAV_ATTR, runtime.mode);
  } catch (err) {
    warn("写入档位失败", err);
  }
}

/** 通知所有订阅者（控制条与设置分区共用）。 */
function notify() {
  runtime.listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      /* 单个订阅失败不影响其余 */
    }
  });
}

/**
 * 切换档位并落盘。
 * @param mode - 目标档位。
 */
function setMode(mode) {
  runtime.mode = mode;
  paintNav();
  if (runtime.nav) syncTitles(runtime.nav);
  renderBar();
  try {
    window.localStorage.setItem(modeKey(runtime.narrow), mode);
  } catch (err) {
    /* 隐私模式 / 配额不足：本次会话内有效 */
  }
  notify();
}

/** 读取当前档位。 */
function getMode() {
  return runtime.mode;
}

/** 读取收起态要保留的行清单。 */
function getKeep() {
  return runtime.keep.slice();
}

/** 读取自动档开关。 */
function getAuto() {
  return runtime.auto;
}

/**
 * 切换自动档并落盘。
 * @param next - 是否开启。
 */
function setAuto(next) {
  runtime.auto = !!next;
  try {
    window.localStorage.setItem(STORAGE_AUTO, runtime.auto ? "on" : "off");
  } catch (err) {
    /* 同上 */
  }
  notify();
}

/**
 * 标题行模型只支持「文字行 / 收起」：进标题行时把图标档暂存，离开时还原。
 * @param nextModel - 即将生效的模型。
 */
function reconcileHeaderMode(nextModel) {
  if (nextModel === "header") {
    if (runtime.mode === "compact") {
      runtime.modeStash = "compact";
      runtime.mode = "expanded";
      persistStash();
    }
    return;
  }
  if (runtime.modeStash) {
    // 离开标题行：还回你进标题行之前真正想用的档位
    runtime.mode = runtime.modeStash;
    runtime.modeStash = null;
    persistStash();
  }
}

/** 把暂存档位写盘（null 时删键）。 */
function persistStash() {
  try {
    if (runtime.modeStash) window.localStorage.setItem(STORAGE_STASH, runtime.modeStash);
    else window.localStorage.removeItem(STORAGE_STASH);
  } catch (err) {
    /* 隐私模式：本次会话内有效即可 */
  }
}

/**
 * 切换控件模型并落盘。
 * @param model - segmented | cycle。
 */
function setModel(model) {
  const previousModel = runtime.model;
  runtime.model = resolveModel(model);
  if (runtime.model !== previousModel) reconcileHeaderMode(runtime.model);
  runtime.signature = "";
  paintNav();
  if (runtime.nav) mountBar(runtime.nav);
  else renderBar();
  try {
    window.localStorage.setItem(STORAGE_MODEL, runtime.model);
  } catch (err) {
    /* 同上 */
  }
  notify();
}

/** 读取当前控件模型。 */
function getModel() {
  return runtime.model;
}

/**
 * 订阅状态变化。
 * @param listener - 变化回调。
 * @returns 取消订阅。
 */
function subscribe(listener) {
  runtime.listeners.add(listener);
  return () => {
    runtime.listeners.delete(listener);
  };
}

/**
 * 统一告警出口。
 * @param message - 说明。
 * @param err - 可选异常。
 */
function warn(message, err) {
  const detail = err === undefined ? "" : " · " + (err && err.message ? err.message : String(err));
  console.warn("[dsh-nav-fold] " + message + detail);
}

/**
 * 找到导航就打标 + 挂控制条；找不到只告警一次（宽限期后）。
 */
function scan() {
  const nav = runtime.nav;
  if (nav && nav.isConnected !== false && looksLikePanelNav(nav)) {
    // 标题行必须始终是 nav 的第一个子节点；被外壳挪走就重挂，连续失败则退回按钮条
    if (runtime.model === "header" && nav.children && nav.children[0] !== runtime.bar) {
      runtime.headerDrift += 1;
      mountBar(nav);
      if (runtime.headerDrift > 3) {
        runtime.headerDrift = 0;
        warn("标题行被外壳反复挪动，已退回按钮条");
        runtime.model = "segmented";
        runtime.signature = "";
        paintNav();
        mountBar(nav);
        notify();
        return;
      }
      return;
    }
    runtime.headerDrift = 0;
    paintNav();
    mountBar(nav);
    return;
  }
  const found = findNav(document);
  if (!found) {
    if (!runtime.warned && Date.now() - runtime.mountedAt > WARN_AFTER_MS) {
      runtime.warned = true;
      warn("未找到「功能入口」导航（DSH 版本可能已变更），保持原生 UI " + describeNavs(document));
    }
    return;
  }
  runtime.nav = found;
  runtime.warned = false;
  paintNav();
  mountBar(found);
}

/**
 * 列出 nav 里的"入口行"按钮：直接子 button + 「更多」锚点（span > button），
 * 排除我们自己的控制条。
 * @param nav - 命中的 nav。
 * @returns 按钮数组。
 */
function rowButtons(nav) {
  const out = [];
  if (!nav || !nav.children) return out;
  for (let i = 0; i < nav.children.length; i += 1) {
    const child = nav.children[i];
    if (!child) continue;
    const row = rowOf(child);
    if (row) {
      out.push(row.button);
      continue;
    }
    const more = moreButtonOf(child);
    if (more) out.push(more);
  }
  return out;
}

/**
 * 图标档 / 图标轨下给每行补原生 title（悬停可见名称）；回到文字行则摘掉。
 * 只写我们加的那一份（打 data-navfold-title 标记），外壳自己的 title 一律不碰。
 * @param nav - 命中的 nav。
 */
function syncTitles(nav) {
  const buttons = rowButtons(nav);
  // rc.2 起外壳给每行配了 Tooltip：再叠原生 title 会双提示，交给外壳
  const rows = collectRows(nav);
  const shellHasTooltip = rows.some((row) => row.wrapper !== row.el);
  const wantTitles = (runtime.iconOnly || runtime.mode === "compact") && !shellHasTooltip;
  for (let i = 0; i < buttons.length; i += 1) {
    const el = buttons[i];
    if (!el || typeof el.setAttribute !== "function") continue;
    const marked = typeof el.getAttribute === "function" && el.getAttribute("data-navfold-title") !== null;
    if (!wantTitles) {
      if (marked) {
        if (typeof el.removeAttribute === "function") {
          el.removeAttribute("title");
          el.removeAttribute("data-navfold-title");
        }
      }
      continue;
    }
    if (hasOwnTitle(el)) continue;
    const label = rowLabel(el);
    if (!label) continue;
    el.setAttribute("title", label);
    el.setAttribute("data-navfold-title", "");
  }
}

/**
 * 元素上是否已经有 title（含我们上一轮加的）——有就不重复写。
 * @param el - 行按钮。
 * @returns 是否已有。
 */
function hasOwnTitle(el) {
  return typeof el.getAttribute === "function" && el.getAttribute("title") !== null;
}

/**
 * 读一行入口的显示名（用于稳定记住"保留哪几行"）。
 * @param row - 行元素。
 * @returns 标签文本。
 */
function rowLabel(row) {
  if (!row || !row.children) return "";
  for (let i = 0; i < row.children.length; i += 1) {
    const child = row.children[i];
    if (child && child.tagName === "SPAN" && typeof child.textContent === "string" && child.textContent.trim()) {
      return child.textContent.trim();
    }
  }
  return typeof row.textContent === "string" ? row.textContent.trim() : "";
}

/**
 * 收集当前导航里的所有入口行。
 * @param nav - 命中的 nav。
 * @returns [{ label, el }]。
 */
function collectRows(nav) {
  const rows = [];
  if (!nav || !nav.children) return rows;
  for (let i = 0; i < nav.children.length; i += 1) {
    const row = rowOf(nav.children[i]);
    if (!row) continue;
    rows.push({ label: rowLabel(row.button), el: row.button, wrapper: row.wrapper });
  }
  return rows;
}

/**
 * 把保留清单打标到行上，并更新计数（收起态徽标用）。
 * 清单为空时退回"保留第一行"，避免把面板入口做成死路。
 * @param nav - 命中的 nav。
 */
function syncKeeps(nav) {
  const rows = collectRows(nav);
  const resolved = resolveKeepIndices(rows);
  const effective = resolved.length > 0 ? resolved.map((item) => item.index) : rows.length > 0 ? [0] : [];
  // 自愈：行名变了（切语言 / 插件改名）就把解析到的当前名字写回存档
  if (runtime.keep.length > 0) {
    const healed = resolved.map((item) => ({ i: item.index, label: item.label }));
    if (JSON.stringify(healed) !== JSON.stringify(runtime.keep)) {
      runtime.keep = healed;
      persistKeep();
    }
  }
  let kept = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const keep = effective.indexOf(i) !== -1;
    if (keep) kept += 1;
    const targets = row.wrapper && row.wrapper !== row.el ? [row.wrapper, row.el] : [row.el];
    for (let t = 0; t < targets.length; t += 1) {
      const target = targets[t];
      if (!target) continue;
      if (typeof target.setAttribute === "function" && keep) target.setAttribute("data-navfold-keep", "");
      else if (typeof target.removeAttribute === "function") target.removeAttribute("data-navfold-keep");
    }
  }
  const changed = runtime.totals.kept !== kept || runtime.totals.total !== rows.length;
  runtime.totals = { kept, total: rows.length };
  if (changed && runtime.listeners.size > 0) notify();
}

/**
 * 切换某一行的"收起态保留"。
 * @param label - 行标签。
 */
function toggleKeep(label) {
  const rows = collectRows(runtime.nav || null);
  let at = -1;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].label === label) {
      at = i;
      break;
    }
  }
  if (at === -1) return;
  const exists = runtime.keep.some((entry) => entry.i === at || entry.label === label);
  runtime.keep = exists
    ? runtime.keep.filter((entry) => !(entry.i === at || entry.label === label))
    : runtime.keep.concat([{ i: at, label: rows[at].label }]);
  persistKeep();
  if (runtime.nav) syncKeeps(runtime.nav);
  runtime.signature = "";
  renderBar();
  notify();
}

/** 把保留清单写盘。 */
function persistKeep() {
  try {
    window.localStorage.setItem(STORAGE_KEEP, JSON.stringify(runtime.keep));
  } catch (err) {
    /* 同上 */
  }
}

/** 收起时全保留。 */
function keepAll() {
  runtime.keep = collectRows(runtime.nav || null).map((row, index) => ({ i: index, label: row.label }));
  persistKeep();
  if (runtime.nav) syncKeeps(runtime.nav);
  runtime.signature = "";
  renderBar();
  notify();
}

/** 清空保留清单（回到"默认保留第一行"）。 */
function clearKeep() {
  runtime.keep = [];
  persistKeep();
  if (runtime.nav) syncKeeps(runtime.nav);
  runtime.signature = "";
  renderBar();
  notify();
}

/**
 * 点「恢复默认」：第一次只进入确认态（3 秒后自动取消），第二次才真正执行。
 */
function requestReset() {
  if (runtime.confirmReset) {
    runtime.confirmReset = false;
    if (runtime.resetTimer) {
      window.clearTimeout(runtime.resetTimer);
      runtime.resetTimer = 0;
    }
    resetAll();
    return;
  }
  runtime.confirmReset = true;
  if (typeof window.setTimeout === "function") {
    runtime.resetTimer = window.setTimeout(() => {
      runtime.resetTimer = 0;
      runtime.confirmReset = false;
      notify();
    }, 3000);
  }
  notify();
}

/** 恢复默认：档位 / 控件样式 / 自动档 / 保留行 全部回到出厂值。 */
function resetAll() {
  runtime.confirmReset = false;
  runtime.modeStash = null;
  try {
    window.localStorage.removeItem(STORAGE_STASH);
  } catch (err) {
    /* 忽略 */
  }
  try {
    [STORAGE_MODE, STORAGE_MODE_NARROW, STORAGE_MODEL, STORAGE_AUTO, STORAGE_KEEP].forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch (err) {
    /* 同上 */
  }
  runtime.keep = [];
  runtime.model = "segmented";
  runtime.auto = true;
  runtime.mode = pickInitialMode(null, runtime.narrow, window.innerHeight, true);
  if (runtime.nav) syncKeeps(runtime.nav);
  paintNav();
  runtime.signature = "";
  renderBar();
  notify();
}

/**
 * 读保留清单存档：每项是 { i, label }；兼容早期版本存的纯标签数组。
 * 存索引是为了"切语言后名字变了也能对上"，存名字是为了"插件增删导致位置变了也能对上"。
 * @param raw - localStorage 原始值。
 * @returns { i, label } 数组。
 */
function resolveKeep(raw) {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out = [];
    for (let k = 0; k < parsed.length; k += 1) {
      const item = parsed[k];
      if (typeof item === "string") out.push({ i: -1, label: item });
      else if (item && typeof item.label === "string") out.push({ i: typeof item.i === "number" ? item.i : -1, label: item.label });
    }
    return out;
  } catch (err) {
    return [];
  }
}

/**
 * 把保存的保留项对到当前行上：先按名字精确匹配，再按索引兜底。
 * @param rows - collectRows 的结果。
 * @returns [{ index, label }]。
 */
function resolveKeepIndices(rows) {
  const out = [];
  const seen = new Set();
  for (let k = 0; k < runtime.keep.length; k += 1) {
    const entry = runtime.keep[k];
    if (!entry) continue;
    let at = -1;
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].label === entry.label) {
        at = i;
        break;
      }
    }
    if (at === -1 && typeof entry.i === "number" && entry.i >= 0 && entry.i < rows.length) at = entry.i;
    if (at === -1 || seen.has(at)) continue;
    seen.add(at);
    out.push({ index: at, label: rows[at].label });
  }
  return out;
}

/**
 * 跟随视口：窗口尺寸或断点变化时，没存档的桶按自动档重算档位。
 * @param media - 窄屏媒体查询对象。
 */
function followViewport(media) {
  if (runtime.viewportHandler) return;
  runtime.viewportHandler = () => {
    const narrow = media ? !!media.matches : false;
    runtime.narrow = narrow;
    let stored = null;
    try {
      stored = window.localStorage.getItem(modeKey(narrow));
    } catch (err) {
      stored = null;
    }
    const hasStored = typeof stored === "string" && MODES.indexOf(stored) !== -1;
    let next = pickInitialMode(hasStored ? stored : null, narrow, window.innerHeight, runtime.auto);
    if (runtime.model === "header" && next === "compact") next = "expanded";
    if (next !== runtime.mode) {
      runtime.mode = next;
      paintNav();
      renderBar();
    }
  };
  if (typeof window.addEventListener === "function") window.addEventListener("resize", runtime.viewportHandler);
  if (media && typeof media.addEventListener === "function") media.addEventListener("change", runtime.viewportHandler);
}

/**
 * 绑定 DOM：首扫 + 外壳重挂/重渲染时重挂控制条（节流），卸载时清理干净。
 * @returns 清理函数。
 */
function attachDom() {
  const schedule = () => {
    if (runtime.timer) return;
    runtime.timer = window.setTimeout(() => {
      runtime.timer = 0;
      scan();
    }, RESCAN_MS);
  };
  runtime.mountedAt = Date.now();
  scan();
  const Observer = window.MutationObserver;
  if (typeof Observer === "function") {
    runtime.observer = new Observer((records) => {
      // 自己重绘控制条也会触发 childList——不忽略就会 150ms 一次无限重绘（表现为悬停闪烁）
      const bar = runtime.bar;
      const own = bar && records.every((record) => {
        const inBar = (node) => !!node && (node === bar || (typeof bar.contains === "function" && bar.contains(node)));
        if (inBar(record.target)) return true;
        const touched = [];
        if (record.addedNodes) for (let i = 0; i < record.addedNodes.length; i += 1) touched.push(record.addedNodes[i]);
        if (record.removedNodes) for (let i = 0; i < record.removedNodes.length; i += 1) touched.push(record.removedNodes[i]);
        return touched.length > 0 && touched.every(inBar);
      });
      if (own) return;
      schedule();
    });
    const target = document.documentElement || document.body;
    if (target) {
      runtime.observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-sidebar-collapsed"]
      });
    }
  }
  const Resize = window.ResizeObserver;
  if (typeof Resize === "function" && runtime.nav) {
    runtime.resize = new Resize(() => schedule());
    runtime.resize.observe(runtime.nav);
  }
  return () => {
    if (runtime.observer) {
      try {
        runtime.observer.disconnect();
      } catch (err) {
        /* 已断开 */
      }
      runtime.observer = null;
    }
    if (runtime.resize) {
      try {
        runtime.resize.disconnect();
      } catch (err) {
        /* 已断开 */
      }
      runtime.resize = null;
    }
    if (runtime.timer) {
      window.clearTimeout(runtime.timer);
      runtime.timer = 0;
    }
    if (runtime.bar && runtime.bar.parentNode) {
      try {
        runtime.bar.parentNode.removeChild(runtime.bar);
      } catch (err) {
        /* 节点已卸载 */
      }
    }
    runtime.bar = null;
    if (runtime.nav) {
      const rows = rowButtons(runtime.nav);
      for (let i = 0; i < rows.length; i += 1) {
        const el = rows[i];
        if (el && typeof el.getAttribute === "function" && el.getAttribute("data-navfold-title") !== null && typeof el.removeAttribute === "function") {
          el.removeAttribute("title");
          el.removeAttribute("data-navfold-title");
        }
      }
    }
    if (runtime.nav && typeof runtime.nav.removeAttribute === "function") {
      try {
        runtime.nav.removeAttribute(NAV_ATTR);
      } catch (err) {
        /* 节点已卸载 */
      }
    }
    runtime.nav = null;
  };
}

/* ───────────────────────── 视图层 ───────────────────────── */

const PANEL_CSS = {
  wrap: { display: "grid", gap: 0, minWidth: 0 },
  summary: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    margin: 0,
    padding: "0 0 10px",
    fontSize: 12,
    color: "var(--dsw-alias-label-secondary,#666)"
  },
  group: {
    display: "grid",
    gap: 6,
    padding: "10px 0",
    borderTop: "1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))",
    minWidth: 0
  },
  row: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary,#111)" },
  desc: { margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--dsw-alias-label-secondary,#777)" },
  seg: {
    display: "inline-flex",
    gap: 2,
    padding: 2,
    borderRadius: 8,
    background: "var(--dsw-alias-bg-layer-2,rgba(0,0,0,.05))"
  },
  segBtn: {
    padding: "3px 10px",
    fontSize: 12,
    lineHeight: 1.5
  },
  microGroup: { display: "inline-flex", alignItems: "center", gap: 4 },
  count: { fontSize: 12, color: "var(--dsw-alias-label-secondary,#777)", fontVariantNumeric: "tabular-nums" },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  foot: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: 10,
    borderTop: "1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))"
  }
};

/**
 * 造一个 React 图标元素。
 * 注意：设置面板是 React 树，必须用 createElement 产出 React 元素；
 * 直接塞 makeIcon 的 DOM 节点会触发 React #31（objects are not valid as a React child）。
 * @param paths - path 的 d 值列表。
 * @param size - 边长。
 * @returns React 元素。
 */
function iconElement(paths, size) {
  const edge = size || 12;
  return react.createElement(
    "svg",
    {
      viewBox: "0 0 16 16",
      width: edge,
      height: edge,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.4,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    paths.map((d, index) => react.createElement("path", { key: index, d }))
  );
}

/** 设置页「nav-fold 导航折叠」分区：行式布局（标题左 / 控件右） */
function NavFoldSettings() {
  const uid = typeof react.useId === "function" ? react.useId() : "nav-fold";
  const model = react.useSyncExternalStore(subscribe, getModel, getModel);
  const mode = react.useSyncExternalStore(subscribe, getMode, getMode);
  const auto = react.useSyncExternalStore(subscribe, getAuto, getAuto);
  // 快照必须含保留清单本身，否则加减保留行时 React 会跳过重渲染（chip 颜色不切换）
  const keepSnapshot = () =>
    runtime.keep.map((entry) => entry.i + ":" + entry.label).join("|") + "#" + runtime.totals.total + "#" + (runtime.confirmReset ? "c" : "");
  react.useSyncExternalStore(subscribe, keepSnapshot, keepSnapshot);

  const rows = collectRows(runtime.nav || null);
  const keepIndices = new Set(resolveKeepIndices(rows).map((item) => item.index));
  const total = runtime.totals.total || rows.length;
  const kept = runtime.totals.kept;
  const el = react.createElement;
  const modelTitleId = uid + "-model";
  const autoTitleId = uid + "-auto";
  const keepTitleId = uid + "-keep";
  const modelOptions = [
    { value: "segmented", title: t("settings.model.segmented.title") },
    { value: "cycle", title: t("settings.model.cycle.title") },
    { value: "header", title: t("settings.model.header.title") }
  ];

  return el(
    "div",
    { style: PANEL_CSS.wrap },
    // 摘要：一眼看到当前配置
    el(
      "p",
      { style: PANEL_CSS.summary },
      iconElement(densityIcon(mode), 14),
      el("span", null, t("mode." + mode) + " · " + t("settings.summary.entries", { n: total }))
    ),
    // 控制条样式
    el(
      "section",
      { style: PANEL_CSS.group, role: "group", "aria-labelledby": modelTitleId },
      el(
        "div",
        { style: PANEL_CSS.row },
        el("span", { id: modelTitleId, style: PANEL_CSS.title, key: "t" }, t("settings.model.title")),
        el(
          "div",
          { style: PANEL_CSS.seg, role: "radiogroup", "aria-labelledby": modelTitleId, key: "g" },
          modelOptions.map((option) =>
            el(
              "button",
              {
                key: option.value,
                type: "button",
                role: "radio",
                "aria-checked": model === option.value ? "true" : "false",
                "data-navfold-model": option.value,
                onClick: () => setModel(option.value),
                style: PANEL_CSS.segBtn
              },
              option.title
            )
          )
        )
      ),
      el("p", { style: PANEL_CSS.desc }, t("settings.model.desc"))
    ),
    // 自动档
    el(
      "section",
      { style: PANEL_CSS.group, role: "group", "aria-labelledby": autoTitleId },
      el(
        "div",
        { style: PANEL_CSS.row },
        el("span", { id: autoTitleId, style: PANEL_CSS.title, key: "t" }, t("settings.auto.title")),
        el(
          "button",
          {
            key: "s",
            type: "button",
            role: "switch",
            "aria-checked": auto ? "true" : "false",
            "aria-labelledby": autoTitleId,
            "data-navfold-auto": auto ? "on" : "off",
            onClick: () => setAuto(!auto)
          },
          el("span", { "aria-hidden": "true" })
        )
      ),
      el("p", { style: PANEL_CSS.desc }, t("settings.auto.desc"))
    ),
    // 收起时保留
    el(
      "section",
      { style: PANEL_CSS.group, role: "group", "aria-labelledby": keepTitleId },
      el(
        "div",
        { style: PANEL_CSS.row },
        el("span", { id: keepTitleId, style: PANEL_CSS.title, key: "t" }, t("settings.keep.title")),
        el(
          "div",
          { style: PANEL_CSS.microGroup, key: "m" },
          el("span", { style: PANEL_CSS.count, "aria-live": "polite" }, t("settings.keptCount", { kept: kept, total: total })),
          el(
            "button",
            { type: "button", "data-navfold-micro": "all", title: t("settings.keep.all"), "aria-label": t("settings.keep.all"), onClick: keepAll },
            iconElement(ALL_ICON, 12)
          ),
          el(
            "button",
            { type: "button", "data-navfold-micro": "none", title: t("settings.keep.none"), "aria-label": t("settings.keep.none"), onClick: clearKeep },
            iconElement(NONE_ICON, 12)
          )
        )
      ),
      rows.length === 0
        ? el("p", { style: PANEL_CSS.desc }, t("settings.keep.empty"))
        : el(
            "div",
            { style: PANEL_CSS.chipRow },
            rows.map((row, index) => {
              const on = keepIndices.has(index);
              return el(
                "button",
                {
                  key: row.label,
                  type: "button",
                  "data-navfold-keep-row": row.label,
                  "aria-pressed": on ? "true" : "false",
                  onClick: () => toggleKeep(row.label)
                },
                on ? el("span", { "aria-hidden": "true" }, "✓") : null,
                el("span", null, row.label)
              );
            })
          ),
      el("p", { style: PANEL_CSS.desc }, t("settings.keep.hint"))
    ),
    el("p", { style: PANEL_CSS.desc }, t("settings.rail.hint")),
    el(
      "div",
      { style: PANEL_CSS.foot },
      el(
        "button",
        {
          type: "button",
          "data-navfold-restore": runtime.confirmReset ? "confirm" : "",
          "aria-live": "polite",
          onClick: requestReset
        },
        runtime.confirmReset ? t("settings.restore.confirm") : t("settings.restore")
      )
    )
  );
}

/* ───────────────────────── 插件入口 ───────────────────────── */

/** 本插件用到的客户端服务（设置分区要 slots，文案要 locale） */
const inject = ["slots", "locale"];

/**
 * 接上 shell 的 locale：注册字典并换成 bound 的 t()；失败就保持 zh 回退，不影响功能。
 * @param ctx - 客户端上下文。
 */
function wireLocale(ctx) {
  const locale = ctx && ctx.locale;
  if (!locale || typeof locale.register !== "function") return;
  try {
    locale.register(NS, DICT);
  } catch (err) {
    warn("locale 字典注册失败，回退中文", err);
  }
  if (typeof locale.bind !== "function") return;
  try {
    const bound = locale.bind(NS);
    t = (key, params) => {
      try {
        const value = bound(key, params);
        // bound 在缺词条时会原样回吐 key，这时用内置中文兜底（防止字典与组件版本错位露 key）
        return typeof value === "string" && value.length > 0 && value !== key ? value : formatText(dictText(DICT.zh, key), params);
      } catch (err) {
        return formatText(dictText(DICT.zh, key), params);
      }
    };
  } catch (err) {
    warn("locale 绑定失败，回退中文", err);
  }
}

/**
 * 注册设置分区（幂等，失败只告警）。
 * @param ctx - 客户端上下文。
 */
function registerSettings(ctx) {
  const slots = ctx && ctx.slots;
  if (!slots || typeof slots.inject !== "function" || typeof slots.register !== "function") {
    warn("slots 服务不可用，设置分区未挂载（控制条本身不受影响）");
    return;
  }
  try {
    slots.inject("settings.section", () => {
      try {
        return slots.register(
          {
            name: "settings.section",
            id: ENTRY_ID,
            order: 70,
            label: () => t("label"),
            inject: () => ({})
          },
          NavFoldSettings
        );
      } catch (err) {
        warn("注册设置分区失败", err);
        return () => {};
      }
    });
  } catch (err) {
    warn("settings.section 注入失败", err);
  }
}

/**
 * 插件装配：读偏好 → 注入样式 → 挂设置分区 → 定位导航并挂控制条。
 * @param ctx - 客户端上下文。
 */
function apply(ctx) {
  if (!ctx || typeof ctx.effect !== "function") {
    warn("ctx.effect 不可用，插件未启动");
    return;
  }
  ctx.effect(() => {
    let injected = null;
    let detach = null;
    let mediaRef = null;
    try {
      if (!hasDom(document)) {
        warn("当前环境没有 DOM，跳过");
        return () => {};
      }
      const media = typeof window.matchMedia === "function" ? window.matchMedia(NARROW_QUERY) : null;
      mediaRef = media;
      runtime.narrow = !!(media && media.matches);
      let storedMode = null;
      let storedModel = null;
      let storedAuto = null;
      let storedKeep = null;
      try {
        storedMode = window.localStorage.getItem(modeKey(runtime.narrow));
        storedModel = window.localStorage.getItem(STORAGE_MODEL);
        storedAuto = window.localStorage.getItem(STORAGE_AUTO);
        storedKeep = window.localStorage.getItem(STORAGE_KEEP);
      } catch (err) {
        storedMode = null;
        storedModel = null;
        storedAuto = null;
        storedKeep = null;
      }
      runtime.keep = resolveKeep(storedKeep);
      runtime.auto = resolveAuto(storedAuto);
      wireLocale(ctx);
      runtime.model = resolveModel(storedModel);
      runtime.mode = pickInitialMode(storedMode, runtime.narrow, window.innerHeight, runtime.auto);
      // 标题行只有「文字行 / 收起」两态：图标网格档在它下面不存在；载入时归一，并把原档位记进暂存
      let storedStash = null;
      try {
        storedStash = window.localStorage.getItem(STORAGE_STASH);
      } catch (err) {
        storedStash = null;
      }
      if (storedStash === "compact" || storedStash === "hidden") runtime.modeStash = storedStash;
      if (runtime.model === "header" && runtime.mode === "compact") {
        runtime.modeStash = "compact";
        runtime.mode = "expanded";
        persistStash();
      }
      followViewport(media);
      injected = ensureStyle(document);
      registerSettings(ctx);
      detach = attachDom();
    } catch (err) {
      warn("初始化失败，保持原生 UI", err);
    }
    return () => {
      if (runtime.viewportHandler) {
        if (typeof window.removeEventListener === "function") window.removeEventListener("resize", runtime.viewportHandler);
        if (mediaRef && typeof mediaRef.removeEventListener === "function") mediaRef.removeEventListener("change", runtime.viewportHandler);
        runtime.viewportHandler = null;
      }
      if (typeof detach === "function") detach();
      if (injected && injected.parentNode) {
        try {
          injected.parentNode.removeChild(injected);
        } catch (err) {
          /* 已被外壳移除 */
        }
      }
    };
  }, "nav-fold: 功能入口三态");
}

exports.name = name;
exports.inject = inject;
exports.apply = apply;
exports.__internals = {
  SETTINGS_LABEL: SETTINGS_LABEL,
  MODES: MODES,
  MODELS: MODELS,
  STORAGE_MODE: STORAGE_MODE,
  STORAGE_MODEL: STORAGE_MODEL,
  NAV_ATTR: NAV_ATTR,
  BAR_ATTR: BAR_ATTR,
  CSS_TEXT: CSS_TEXT,
  nextMode: nextMode,
  modeKey: modeKey,
  pickInitialMode: pickInitialMode,
  autoWantsCompact: autoWantsCompact,
  resolveAuto: resolveAuto,
  setAuto: setAuto,
  getAuto: getAuto,
  toggleKeep: toggleKeep,
  keepAll: keepAll,
  clearKeep: clearKeep,
  resetAll: resetAll,
  collectRows: collectRows,
  resolveKeep: resolveKeep,
  syncKeeps: syncKeeps,
  getKeep: getKeep,
  resolveModel: resolveModel,
  looksLikePanelNav: looksLikePanelNav,
  findNav: findNav,
  renderBar: renderBar,
  setMode: setMode,
  setModel: setModel,
  getMode: getMode,
  getModel: getModel,
  NavFoldSettings: NavFoldSettings,
  runtime: runtime,
  scan: scan
};
		return module.exports;
	}
});
