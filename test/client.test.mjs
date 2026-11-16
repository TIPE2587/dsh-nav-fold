import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

/** 构造一个假元素：只实现本插件真正用到的形状 */
function makeEl(tagName, doc) {
  const el = {
    tagName,
    children: [],
    attrs: {},
    listeners: {},
    parentNode: null,
    isConnected: true,
    ownerDocument: doc,
    clientWidth: 264,
    _h: 0,
    _top: 0,
    _text: "",
    style: {
      _vars: {},
      setProperty(key, value) { this._vars[key] = value; },
      removeProperty(key) { delete this._vars[key]; }
    },
    getBoundingClientRect() { return { height: el._h, top: el._top, left: 0, width: el.clientWidth, bottom: el._top + el._h, right: el.clientWidth }; },
    setAttribute(key, value) { el.attrs[key] = value; },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(el.attrs, key) ? el.attrs[key] : null; },
    removeAttribute(key) { delete el.attrs[key]; },
    appendChild(child) {
      if (child.parentNode && child.parentNode !== el) child.parentNode.removeChild(child);
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    removeChild(child) {
      el.children = el.children.filter((node) => node !== child);
      child.parentNode = null;
      return child;
    },
    insertBefore(child, ref) {
      if (child.parentNode && child.parentNode !== el) child.parentNode.removeChild(child);
      const at = ref ? el.children.indexOf(ref) : -1;
      if (at === -1) el.children.push(child);
      else el.children.splice(at, 0, child);
      child.parentNode = el;
      return child;
    },
    addEventListener(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire(type, event) {
      for (const fn of el.listeners[type] || []) fn(event || { preventDefault() {}, stopPropagation() {} });
    },
    querySelector() { return null; },
    get textContent() { return el._text; },
    set textContent(value) {
      el._text = value;
      for (const child of el.children) child.parentNode = null;
      el.children = [];
    },
  };
  return el;
}

/** 功能入口导航：n 个「图标 + 文字」行，外加一个更多锚点 span */
function makePanelNav(doc, rows = 9) {
  const nav = makeEl("NAV", doc);
  for (let i = 0; i < rows; i += 1) {
    const row = makeEl("BUTTON", doc);
    row.appendChild(makeEl("SPAN", doc));
    const title = makeEl("SPAN", doc);
    title.textContent = "Panel " + (i + 1);
    row.appendChild(title);
    nav.appendChild(row);
  }
  const more = makeEl("SPAN", doc);
  const moreButton = makeEl("BUTTON", doc);
  moreButton.appendChild(makeEl("SPAN", doc));
  const moreTitle = makeEl("SPAN", doc);
  moreTitle.textContent = "More";
  moreButton.appendChild(moreTitle);
  more.appendChild(moreButton);
  nav.appendChild(more);
  return nav;
}

/** rc.2+ 的结构：每个入口外面多一层 div.panelEntry，按钮上有 aria-label */
function makeWrappedPanelNav(doc, rows = 9, { withTitles = true } = {}) {
  const nav = makeEl("NAV", doc);
  for (let i = 0; i < rows; i += 1) {
    const entry = makeEl("DIV", doc);
    const btn = makeEl("BUTTON", doc);
    btn.setAttribute("aria-label", "Panel " + (i + 1));
    btn.appendChild(makeEl("SPAN", doc));
    if (withTitles) {
      const title = makeEl("SPAN", doc);
      title.textContent = "Panel " + (i + 1);
      btn.appendChild(title);
    }
    entry.appendChild(btn);
    nav.appendChild(entry);
  }
  const more = makeEl("SPAN", doc);
  const moreButton = makeEl("BUTTON", doc);
  moreButton.appendChild(makeEl("SPAN", doc));
  more.appendChild(moreButton);
  nav.appendChild(more);
  return nav;
}

/**
 * 造 rc.3 的「滚动区 > 区域 > 容器(标题 36 / 列表 400)」结构，用来验证顶部固定区。
 * @returns { area, region, stack, head, list }
 */
function attachLayout(nav, doc) {
  const area = makeEl("DIV", doc);
  const region = makeEl("DIV", doc);
  const wrap = makeEl("DIV", doc);
  const stack = makeEl("DIV", doc);
  const head = makeEl("DIV", doc);
  const list = makeEl("DIV", doc);
  head._h = 36;
  list._h = 400;
  stack.appendChild(head);
  stack.appendChild(list);
  wrap.appendChild(stack);
  region.appendChild(wrap);
  area._h = 524;
  area._top = 0;
  nav._h = 92;
  nav._top = 8;
  head._top = 110;
  area.appendChild(nav);
  area.appendChild(region);
  return { area, region, wrap, stack, head, list };
}

/** 假 document：只支持本插件用到的查询与注入 */
function makeDoc() {
  const doc = {
    head: null,
    documentElement: null,
    createElement(tag) { return makeEl(tag, doc); },
    createElementNS(_ns, tag) { return makeEl(tag, doc); },
    querySelector(selector) {
      const hit = /^style\[data-plugin-css="(.+)"\]$/.exec(selector);
      if (!hit) return null;
      return doc.head.children.find((el) => el.attrs["data-plugin-css"] === hit[1]) || null;
    },
    querySelectorAll(selector) { return selector === "nav" ? [] : []; },
  };
  doc.head = makeEl("HEAD", doc);
  doc.documentElement = makeEl("HTML", doc);
  doc.body = makeEl("BODY", doc);
  return doc;
}

/** 假 React：只要三件事——读快照、跑回调、造元素 */
const fakeReact = {
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  useCallback: (fn) => fn,
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
};

/** 装载真实产物（lib/client.js 就是上线文件，不额外打包） */
function loadArtifact({ rows = 9, withNav = true, narrow = false, height = 900, storedMode = null, storedModel = null, storedAuto = null, narrowStoredMode = null, wrapped = false, withTitles = true } = {}) {
  const doc = makeDoc();
  const nav = withNav ? (wrapped ? makeWrappedPanelNav(doc, rows, { withTitles }) : makePanelNav(doc, rows)) : null;
  if (nav) doc.querySelectorAll = (selector) => (selector === "nav" ? [nav] : []);
  const store = new Map();
  if (storedMode !== null) store.set("dsh-nav-fold/v1/mode", storedMode);
  if (narrowStoredMode !== null) store.set("dsh-nav-fold/v1/mode-narrow", narrowStoredMode);
  if (storedModel !== null) store.set("dsh-nav-fold/v1/model", storedModel);
  if (storedAuto !== null) store.set("dsh-nav-fold/v1/auto", storedAuto);
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, value); },
    removeItem: (key) => { store.delete(key); },
  };
  let captured = null;
  const required = [];
  const listeners = { keydown: [] };
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    window: {
      localStorage,
      innerHeight: height,
      matchMedia: () => ({ matches: narrow, addEventListener() {}, removeEventListener() {} }),
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((item) => item !== fn); },
      __ModuleLoader__: { load: (entry) => { captured = entry; } },
    },
    document: doc,
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "lib/client.js" });
  assert.ok(captured, "产物必须以 window.__ModuleLoader__.load 注册");
  const mod = captured.factory((specifier) => {
    required.push(specifier);
    if (specifier === "react") return fakeReact;
    throw new Error("unexpected require: " + specifier);
  });
  const calls = { injected: [], registered: [], shortcut: null };
  const ctx = {
    effects: 0,
    effect(fn) { ctx.effects += 1; ctx.dispose = fn(); },
    slots: {
      inject(slotName, cb) { calls.injected.push(slotName); return cb(); },
      register(opts, component) { calls.registered.push({ opts, component }); return () => { calls.disposed = true; }; },
    },
    get(name) { return name === "shortcuts" ? ctx.shortcuts : undefined; },
    shortcuts: {
      register(command) { calls.shortcut = command; return () => { calls.shortcutDisposed = true; }; },
    },
  };
  return { mod, ctx, doc, nav, store, calls, required, listeners, internals: mod.__internals };
}

const findBar = (nav) => nav.children.find((child) => child.attrs && child.attrs["data-navfold-bar"] !== undefined);
const actions = (bar) => bar.children.map((child) => child.attrs["data-navfold-action"]).filter(Boolean);
const byAction = (bar, action) => bar.children.find((child) => child.attrs && child.attrs["data-navfold-action"] === action);
const pressed = (bar) => bar.children.filter((child) => child.attrs["aria-pressed"] === "true").map((child) => child.attrs["data-navfold-action"]);

test("产物导出：注入 slots，按需加载 react", () => {
  const { mod, required } = loadArtifact();
  assert.equal(mod.name, "nav-fold");
  assert.equal(mod.inject.join(","), "slots,locale");
  assert.equal(typeof mod.apply, "function");
  assert.ok(required.includes("react"), "设置分区需要 React");
});

test("三态循环与启动档位", () => {
  const { mod } = loadArtifact();
  assert.equal(mod.__internals.nextMode("expanded"), "compact");
  assert.equal(mod.__internals.nextMode("compact"), "hidden");
  assert.equal(mod.__internals.nextMode("hidden"), "expanded");
  const { pickInitialMode, resolveModel, autoWantsCompact, resolveAuto } = mod.__internals;
  assert.equal(pickInitialMode("hidden", false, 900, true), "hidden", "存档永远优先");
  assert.equal(pickInitialMode(null, true, 900, true), "compact", "手机默认图标档");
  assert.equal(pickInitialMode(null, false, 900, true), "expanded", "桌面高窗口默认文字行");
  assert.equal(pickInitialMode(null, false, 700, true), "compact", "自动档：窗口够矮进图标档");
  assert.equal(pickInitialMode(null, false, 700, false), "expanded", "自动档关掉就不管高度");
  assert.equal(autoWantsCompact(false, 700), true);
  assert.equal(autoWantsCompact(false, 900), false);
  assert.equal(autoWantsCompact(true, 900), true);
  assert.equal(resolveAuto(null), true, "自动档默认开");
  assert.equal(resolveAuto("off"), false);
  assert.equal(resolveModel(null), "segmented", "默认三档选择器");
  assert.equal(resolveModel("cycle"), "cycle");
  assert.equal(resolveModel("bogus"), "segmented");
});

test("模型一：三档选择器——三个恒定语义按钮 + 当前档高亮", () => {
  const { mod, ctx, nav } = loadArtifact();
  mod.apply(ctx);
  const bar = findBar(nav);
  assert.deepEqual(actions(bar), ["expanded", "compact", "hidden"]);
  assert.deepEqual(pressed(bar), ["expanded"], "当前档必须高亮回显");
  byAction(bar, "hidden").fire("click");
  assert.equal(nav.attrs["data-navfold"], "hidden");
  assert.deepEqual(pressed(bar), ["hidden"]);
  byAction(bar, "compact").fire("click");
  assert.equal(nav.attrs["data-navfold"], "compact", "收起态可直接跳回图标档");
  assert.deepEqual(pressed(bar), ["compact"]);
});

const cycleGlyph = (button) => button.attrs["data-navfold-glyph"];

test("模型二：单按钮循环——一次只显示一个图标，点了换下一个", () => {
  const { mod, ctx, nav } = loadArtifact({ storedModel: "cycle" });
  mod.apply(ctx);
  const bar = findBar(nav);
  assert.deepEqual(actions(bar), ["cycle"], "循环模型只有一个点击目标");
  const current = () => byAction(findBar(nav), "cycle");
  assert.equal(cycleGlyph(current()), "expanded", "展开态显示文字行图标");
  assert.equal(current().children.length, 1, "只有一个图标，不是三枚并排");
  current().fire("click");
  assert.equal(nav.attrs["data-navfold"], "compact");
  assert.equal(cycleGlyph(current()), "compact", "点了就换成下一档图标");
  current().fire("click");
  assert.equal(nav.attrs["data-navfold"], "hidden");
  assert.equal(cycleGlyph(current()), "hidden");
  current().fire("click");
  assert.equal(nav.attrs["data-navfold"], "expanded");
  assert.equal(cycleGlyph(current()), "expanded");
});

test("切换模型立即重绘并存档", () => {
  const { mod, ctx, nav, store } = loadArtifact();
  mod.apply(ctx);
  assert.deepEqual(actions(findBar(nav)), ["expanded", "compact", "hidden"]);
  mod.__internals.setModel("cycle");
  assert.equal(store.get("dsh-nav-fold/v1/model"), "cycle");
  assert.deepEqual(actions(findBar(nav)), ["cycle"], "改成循环后控制条必须立刻跟着变");
  mod.__internals.setModel("segmented");
  assert.deepEqual(actions(findBar(nav)), ["expanded", "compact", "hidden"]);
});

test("档位落盘 + 桌面/手机各自记忆", () => {
  // 窄屏桶里有存档 → 用它；桌面桶的存档不影响手机
  const run = loadArtifact({ narrow: true, storedMode: "hidden", narrowStoredMode: "expanded" });
  run.mod.apply(run.ctx);
  assert.equal(run.nav.attrs["data-navfold"], "expanded", "手机桶存档优先，且不受桌面桶干扰");

  // 手机桶没存档 → 手机默认图标档，即使桌面桶存着 hhidden
  const mobileDefault = loadArtifact({ narrow: true, storedMode: "hidden" });
  mobileDefault.mod.apply(mobileDefault.ctx);
  assert.equal(mobileDefault.nav.attrs["data-navfold"], "compact", "手机默认图标档");

  const fresh = loadArtifact({ narrow: true });
  fresh.mod.apply(fresh.ctx);
  assert.equal(fresh.nav.attrs["data-navfold"], "compact", "无存档时窄屏进图标档");

  const click = loadArtifact();
  click.mod.apply(click.ctx);
  byAction(findBar(click.nav), "hidden").fire("click");
  assert.equal(click.store.get("dsh-nav-fold/v1/mode"), "hidden", "桌面桶落盘");
  assert.equal(click.store.get("dsh-nav-fold/v1/mode-narrow"), undefined, "不能写进手机桶");
});

test("设置树里不能混入 DOM 节点（React #31 回归）", () => {
  const { mod, ctx } = loadArtifact();
  mod.apply(ctx);
  const tree = mod.__internals.NavFoldSettings();
  const bad = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const isReactEl = typeof node.type === "string" || typeof node.type === "function";
    const isDomEl = typeof node.tagName === "string" && typeof node.getAttribute === "function";
    if (isDomEl && !isReactEl) { bad.push(node.tagName); return; }
    (node.children || []).forEach(walk);
  };
  walk(tree);
  assert.equal(bad.length, 0, "设置面板是 React 树，图标必须是 React 元素（原始 DOM 节点会触发 React #31）");
});

test("设置分区：注册到 settings.section，模型单选可切换", () => {
  const { mod, ctx, calls } = loadArtifact();
  mod.apply(ctx);
  assert.ok(calls.injected.includes("settings.section"), "必须往设置面板挂分区");
  const section = calls.registered.find((entry) => entry.opts.name === "settings.section");
  assert.ok(section, "settings.section 必须注册成功");
  assert.equal(section.opts.id, "nav-fold");
  assert.equal(section.component, mod.__internals.NavFoldSettings);

  const tree = mod.__internals.NavFoldSettings();
  const walkAll = (node, out = []) => {
    if (!node || typeof node !== "object") return out;
    out.push(node);
    for (const child of node.children || []) walkAll(child, out);
    return out;
  };
  const group = walkAll(tree).find((node) => node.props && node.props.role === "radiogroup");
  const radios = group.children;
  assert.equal(radios.length, 3);
  assert.deepEqual(radios.map((r) => r.props["data-navfold-model"]), ["segmented", "cycle", "header"]);
  assert.equal(radios[0].props["aria-checked"], "true", "默认选中三档选择器");
  radios[1].props.onClick();
  assert.equal(mod.__internals.getModel(), "cycle");
});

test("图标轨里两种模型都退化成单按钮循环", () => {
  const { mod, ctx, nav } = loadArtifact();
  nav.clientWidth = 56;
  mod.apply(ctx);
  const bar = findBar(nav);
  assert.deepEqual(actions(bar), ["cycle"]);
  assert.equal(bar.children[0].children.length, 1, "图标轨里同样只有一个图标");
  mod.__internals.setModel("segmented");
  nav.clientWidth = 56;
  mod.__internals.scan();
  assert.deepEqual(actions(findBar(nav)), ["cycle"], "轨道宽度下选择器也放不下");
});

test("卸载：控制条、样式、属性全部摘掉", () => {
  const { mod, ctx, doc, nav } = loadArtifact();
  mod.apply(ctx);
  assert.ok(findBar(nav));
  ctx.dispose();
  assert.equal(findBar(nav), undefined);
  assert.equal(nav.attrs["data-navfold"], undefined);
  assert.equal(doc.head.children.length, 0);
});

test("首屏宽限内找不到不告警；宽限期后才告警一次", () => {
  const run = loadArtifact({ withNav: false });
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    run.mod.apply(run.ctx);
    run.mod.__internals.scan();
    assert.equal(warnings.length, 0, "首屏那一下不能喊“结构变了”");
    run.mod.__internals.runtime.mountedAt = Date.now() - 10_000;
    run.mod.__internals.scan();
    run.mod.__internals.scan();
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.filter((line) => line.includes("未找到")).length, 1, "只告警一次，不刷屏");
});
test("收起态：默认保留第一行，并标出藏了多少", () => {
  const { mod, ctx, nav } = loadArtifact();
  mod.apply(ctx);
  const rows = nav.children.filter((child) => child.tagName === "BUTTON");
  assert.equal(rows[0].attrs["data-navfold-keep"], "", "默认保留第一行，避免面板入口变死路");
  assert.equal(rows[1].attrs["data-navfold-keep"], undefined);
  byAction(findBar(nav), "hidden").fire("click");
  const badge = findBar(nav).children.find((child) => child.attrs["data-navfold-count"] !== undefined);
  assert.ok(badge, "收起态必须有计数徽标");
  assert.equal(badge.textContent, "已收起 8", "9 行留 1 行 → 藏了 8 个");
});

test("保留行可在设置里增减，并记住", () => {
  const { mod, ctx, nav, store, calls } = loadArtifact();
  mod.apply(ctx);
  const rows = nav.children.filter((child) => child.tagName === "BUTTON");
  mod.__internals.toggleKeep("Panel 3");
  // 假行没有文本标签时 rowLabel 为空串，这里直接按运行时清单校验行为
  const keep = mod.__internals.getKeep();
  assert.ok(Array.isArray(keep));
  assert.ok(store.has("dsh-nav-fold/v1/keep"), "保留清单必须落盘");

  const section = calls.registered.find((entry) => entry.opts.name === "settings.section");
  const tree = section.component();
  const walk = (node, out = []) => {
    if (!node || typeof node !== "object") return out;
    out.push(node);
    for (const child of node.children || []) walk(child, out);
    return out;
  };
  const groupLabels = walk(tree).filter((node) => node.props && node.props["data-navfold-keep-row"] !== undefined);
  assert.equal(groupLabels.length, rows.length, "设置里要能逐行加减");
  assert.equal(groupLabels[0].props["aria-pressed"], "false", "默认只保留第一行（未显式选择）");

  // 点一下该行 → 运行时清单变化 → 重新渲染时 aria-pressed 必须跟着变
  const panel4 = groupLabels.find((node) => node.props["data-navfold-keep-row"] === "Panel 4");
  assert.equal(panel4.props["aria-pressed"], "false");
  panel4.props.onClick();
  const after = walk(section.component()).filter((node) => node.props && node.props["data-navfold-keep-row"] !== undefined);
  assert.equal(after.find((node) => node.props["data-navfold-keep-row"] === "Panel 4").props["aria-pressed"], "true", "点过之后 chip 必须变成选中态");
});

test("计数变化会通知订阅者（设置面板据此重渲染）", () => {
  const { mod, ctx } = loadArtifact();
  mod.apply(ctx);
  let hits = 0;
  mod.__internals.runtime.listeners.add(() => { hits += 1; });
  mod.__internals.runtime.totals = { kept: 99, total: 99 };
  mod.__internals.syncKeeps(mod.__internals.runtime.nav);
  assert.ok(hits > 0, "行数/保留数变化必须通知");
});


test("循环按钮比三档按钮大一点（图标 14）", () => {
  const { mod, ctx, nav } = loadArtifact({ storedModel: "cycle" });
  mod.apply(ctx);
  const button = byAction(findBar(nav), "cycle");
  assert.equal(button.attrs["data-navfold-size"], "large");
  assert.equal(button.children[0].attrs.width, "14");
});
test("收起态的「全部」浮层：列出所有入口，点条目即触发该行", () => {
  const { mod, ctx, doc, nav } = loadArtifact();
  mod.apply(ctx);
  const bar = findBar(nav);
  byAction(bar, "hidden").fire("click");
  const allBtn = byAction(findBar(nav), "all");
  assert.ok(allBtn, "收起态必须有「全部」按钮");
  allBtn.fire("click");
  const pop = doc.body.children.find((child) => child.attrs["data-navfold-popover"] !== undefined);
  assert.ok(pop, "浮层必须挂到 body 上");
  const rows = nav.children.filter((child) => child.tagName === "BUTTON");
  assert.equal(pop.children.length, rows.length, "浮层要列出全部入口");
  let clicked = 0;
  rows[2].click = () => { clicked += 1; };
  pop.children[2].fire("click");
  assert.equal(clicked, 1, "点浮层条目要转发到真实行");
  assert.equal(doc.body.children.filter((child) => child.attrs["data-navfold-popover"] !== undefined).length, 0, "点完要关掉浮层");
});
test("模型三：标题行——整组收成一行，点标题展开/收起", () => {
  const { mod, ctx, nav } = loadArtifact({ storedModel: "header" });
  mod.apply(ctx);
  const bar = findBar(nav);
  assert.equal(nav.children[0], bar, "标题行必须是 nav 的第一个子节点");
  assert.ok(bar.attrs["data-navfold-header"] !== undefined, "标题行要打标");
  const button = byAction(bar, "header-toggle");
  assert.ok(button, "标题行按钮");
  assert.equal(button.attrs["aria-expanded"], "true");
  button.fire("click");
  assert.equal(nav.attrs["data-navfold"], "hidden");
  assert.equal(byAction(findBar(nav), "header-toggle").attrs["aria-expanded"], "false");
  byAction(findBar(nav), "header-toggle").fire("click");
  assert.equal(nav.attrs["data-navfold"], "expanded");
});

test("标题行：载入时若落到图标档，自动归一为文字行", () => {
  const run = loadArtifact({ storedModel: "header", narrow: true });
  run.mod.apply(run.ctx);
  assert.equal(run.nav.attrs["data-navfold"], "expanded", "标题行没有图标网格档");
  assert.equal(run.nav.children[0], findBar(run.nav), "标题行在首位");
});

test("标题行：切过去时把图标档归一为文字行，漂移会被拉回", () => {
  const run = loadArtifact({ storedMode: "compact" });
  run.mod.apply(run.ctx);
  assert.equal(run.nav.attrs["data-navfold"], "compact");
  run.mod.__internals.setModel("header");
  assert.equal(run.nav.attrs["data-navfold"], "expanded", "标题行没有图标网格档");
  assert.equal(run.nav.children[0], findBar(run.nav), "切到标题行要挪到首位");

  // 模拟外壳把标题行挪到末尾
  const bar = findBar(run.nav);
  run.nav.removeChild(bar);
  run.nav.appendChild(bar);
  assert.notEqual(run.nav.children[0], bar);
  run.mod.__internals.scan();
  assert.equal(run.nav.children[0], findBar(run.nav), "重扫后必须拉回首位");
});
test("图标档：每行补原生 title，悬停可见名称；文字档摘掉", () => {
  const { mod, ctx, nav } = loadArtifact();
  mod.apply(ctx);
  const rows = nav.children.filter((child) => child.tagName === "BUTTON");
  rows.forEach((row) => assert.equal(row.getAttribute("title"), null, "文字档不该加 title"));

  byAction(findBar(nav), "compact").fire("click");
  rows.forEach((row, index) => {
    assert.equal(row.getAttribute("title"), "Panel " + (index + 1), "图标档每行要有名字");
    assert.ok(row.getAttribute("data-navfold-title") !== null, "要打标记，便于卸载清理");
  });
  const moreButton = nav.children.find((child) => child.tagName === "SPAN").children[0];
  assert.equal(moreButton.getAttribute("title"), "More", "更多按钮同样要有名字");

  byAction(findBar(nav), "expanded").fire("click");
  rows.forEach((row) => assert.equal(row.getAttribute("title"), null, "回到文字档要摘掉"));
});

test("卸载后不残留我们自己加的 title", () => {
  const { mod, ctx, nav } = loadArtifact();
  mod.apply(ctx);
  byAction(findBar(nav), "compact").fire("click");
  const rows = nav.children.filter((child) => child.tagName === "BUTTON");
  assert.ok(rows[0].getAttribute("title"));
  ctx.dispose();
  rows.forEach((row) => assert.equal(row.getAttribute("title"), null, "卸载必须摘干净"));
});
test("D1 保留行：切语言（行名变了）后按索引兜住，并自愈名字", () => {
  const { mod, ctx, nav, store } = loadArtifact();
  mod.apply(ctx);
  mod.__internals.toggleKeep("Panel 3");
  assert.ok(String(store.get("dsh-nav-fold/v1/keep")).includes("Panel 3"), "存档里带名字");

  const rows = nav.children.filter((child) => child.tagName === "BUTTON");
  rows.forEach((row, index) => { row.children[1].textContent = "项目 " + (index + 1); });
  mod.__internals.syncKeeps(nav);

  const keep = mod.__internals.getKeep();
  assert.equal(keep.length, 1, "仍然只保留一行");
  assert.equal(keep[0].label, "项目 3", "名字自愈成当前语言");
  assert.equal(keep[0].i, 2, "索引没跑偏");
});

test("D2 标题行归一可逆：切回来还你原来的图标档", () => {
  const run = loadArtifact({ storedMode: "compact" });
  run.mod.apply(run.ctx);
  assert.equal(run.nav.attrs["data-navfold"], "compact");

  run.mod.__internals.setModel("header");
  assert.equal(run.nav.attrs["data-navfold"], "expanded", "进标题行先归一");
  assert.equal(run.store.get("dsh-nav-fold/v1/mode-stash"), "compact", "原档位要暂存");

  run.mod.__internals.setModel("segmented");
  assert.equal(run.nav.attrs["data-navfold"], "compact", "离开标题行要还原图标档");
  assert.equal(run.store.get("dsh-nav-fold/v1/mode-stash"), undefined, "还原后清掉暂存");
});

test("D3 恢复默认要二次确认", () => {
  const run = loadArtifact({ storedModel: "cycle" });
  run.mod.apply(run.ctx);
  const section = run.calls.registered.find((entry) => entry.opts.name === "settings.section");
  const walk = (node, out = []) => {
    if (!node || typeof node !== "object") return out;
    if (Array.isArray(node)) { node.forEach((child) => walk(child, out)); return out; }
    out.push(node);
    (node.children || []).forEach((child) => walk(child, out));
    return out;
  };
  const findReset = () => walk(section.component()).find((node) => node.props && node.props["data-navfold-restore"] !== undefined);

  assert.equal(findReset().props["data-navfold-restore"], "", "初始不是确认态");
  findReset().props.onClick();
  assert.equal(findReset().props["data-navfold-restore"], "confirm", "第一次点进确认态");
  assert.equal(run.mod.__internals.getModel(), "cycle", "第一次点不执行重置");
  findReset().props.onClick();
  assert.equal(findReset().props["data-navfold-restore"], "", "确认后回到普通态");
  assert.equal(run.mod.__internals.getModel(), "segmented", "第二次点才真重置");
});
test("元数据一致性：package.json 版本 == client.js 的 PLUGIN_VERSION，且 icon 进发布清单", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const src = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  const hit = /const PLUGIN_VERSION = "([^"]+)"/.exec(src);
  assert.ok(hit, "client.js 里必须有 PLUGIN_VERSION 常量");
  assert.equal(hit[1], pkg.version, "版本号必须与 package.json 一致");
  assert.ok(pkg.files.includes("icon.svg"), "icon.svg 必须在 files 白名单里");
  assert.equal(pkg.exports["./icon"], "./icon.svg", "必须导出 ./icon");
});
test("rc.2+ 包裹行（div.panelEntry > button）：能定位、挂控制条、标出保留行", () => {
  const { mod, ctx, nav } = loadArtifact({ wrapped: true });
  mod.apply(ctx);
  assert.equal(nav.attrs["data-navfold"], "expanded", "包裹结构下也要打上档位");
  const bar = nav.children.find((c) => c.attrs["data-navfold-bar"] !== undefined);
  assert.ok(bar, "控制条要挂上");

  const entries = nav.children.filter((c) => c.tagName === "DIV");
  assert.equal(entries.length, 9, "9 个包裹层");
  assert.equal(mod.__internals.runtime.totals.total, 9, "9 行都被收集");
  // 默认保留第一行：包裹层与按钮都要打标记（隐藏用包裹层）
  assert.ok(entries[0].attrs["data-navfold-keep"] !== undefined, "包裹层要打保留标记");
  assert.ok(entries[0].children[0].attrs["data-navfold-keep"] !== undefined, "按钮也要打保留标记");
  assert.ok(entries[1].attrs["data-navfold-keep"] === undefined, "没选中的行不打");
});

test("rc.2+ 窄屏时外壳不渲染标题 span，也要能定位", () => {
  const { mod, ctx, nav } = loadArtifact({ wrapped: true, withTitles: false });
  mod.apply(ctx);
  assert.equal(nav.attrs["data-navfold"], "expanded", "只有图标 + aria-label 也要认得出来");
});

test("rc.2+ 不叠原生 title（外壳自带 Tooltip）", () => {
  const { mod, ctx, nav } = loadArtifact({ wrapped: true, storedMode: "compact" });
  mod.apply(ctx);
  assert.equal(nav.attrs["data-navfold"], "compact");
  const titled = [];
  for (const entry of nav.children) {
    for (const child of entry.children || []) {
      if (child.attrs && child.attrs["data-navfold-title"] !== undefined) titled.push(child);
    }
  }
  assert.equal(titled.length, 0, "有包裹层时不加原生 title，交给外壳 Tooltip");
});

test("rc.2 的紧凑/收起样式覆盖包裹层", () => {
  const { mod, ctx, doc } = loadArtifact({ wrapped: true });
  mod.apply(ctx);
  const css = doc.head.children.map((el) => el.textContent).join("");
  assert.match(css, /nav\[data-navfold="compact"\]>div:not\(\[data-navfold-bar\]\)/, "紧凑态要按包裹层生效");
  assert.match(css, /nav\[data-navfold="hidden"\]>div:not\(\[data-navfold-keep\]\)/, "收起态要隐藏包裹层");
  assert.doesNotMatch(
    css,
    /nav\[data-navfold="compact"\]>div>button/,
    "紧凑态的行按钮规则必须排除控制条，否则控制条按钮会被一起隐藏"
  );
});
const walkTree = (node, out = []) => {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) { node.forEach((child) => walkTree(child, out)); return out; }
  out.push(node);
  for (const child of node.children || []) walkTree(child, out);
  return out;
};

test("F 列数：默认自适应，可切 8/7/6/5/4，并写进 CSS 与档位属性", () => {
  const { mod, ctx, nav, doc } = loadArtifact({ wrapped: true });
  mod.apply(ctx);
  assert.equal(mod.__internals.getCols(), "auto", "默认自适应");
  assert.equal(nav.attrs["data-navfold-cols"], "auto");

  mod.__internals.setCols("8");
  assert.equal(nav.attrs["data-navfold-cols"], "8");
  const css = doc.head.children.map((el) => el.textContent).join("");
  for (const n of [8, 7, 6, 5, 4]) {
    assert.match(css, new RegExp('repeat\\(' + n + ',minmax\\(0,1fr\\)\\)'), n + " 列规则要在样式里");
  }
  assert.match(css, /@media \(max-width:767px\)/, "手机宽度要有单独规则");
  assert.match(css, /repeat\(6,minmax\(0,1fr\)\)/, "手机自适应上限 6 列");
});

test("F 挤压提示：8 列在 264px 侧栏下给出警告和「切回自适应」", () => {
  const { mod, ctx } = loadArtifact({ wrapped: true });
  mod.apply(ctx);
  mod.__internals.setCols("8");
  const tree = mod.__internals.NavFoldSettings();
  const warn = walkTree(tree).find((node) => node.props && node.props["data-navfold-warn"] !== undefined);
  assert.ok(warn, "264px / 8 列 = 31px < 32px，必须出警告");
  mod.__internals.setCols("auto");
  const tree2 = mod.__internals.NavFoldSettings();
  assert.equal(walkTree(tree2).find((node) => node.props && node.props["data-navfold-warn"] !== undefined), undefined, "自适应不出警告");
});

test("G 顶部固定区：图标档默认开、收起档默认关、文字档永不固定", () => {
  const run = loadArtifact({ storedMode: "compact" });
  const lay = attachLayout(run.nav, run.doc);
  run.mod.apply(run.ctx);

  assert.equal(run.nav.attrs["data-navfold-pinned"], "on", "图标档默认固定");
  assert.notEqual(lay.head.attrs["data-navfold-pin-head"], undefined, "工作区标题行要打标");
  assert.equal(lay.area.attrs["data-navfold-pin-head"], undefined, "不再重排滚动区（0.3.1 布局已废弃）");
  assert.equal(lay.area.style._vars["--navfold-nav-h"], "92px", "nav 高度要写进变量，供标题行 sticky 用");
  assert.equal(lay.area.style._vars["--navfold-pin-bg"], "transparent", "取不到底色时保持透明，不制造色块");

  run.mod.__internals.setMode("hidden");
  assert.equal(run.nav.attrs["data-navfold-pinned"], "off", "收起档默认不固定");
  run.mod.__internals.setStickHidden(true);
  assert.equal(run.nav.attrs["data-navfold-pinned"], "on", "开启后收起档也固定");

  run.mod.__internals.setMode("expanded");
  assert.equal(run.nav.attrs["data-navfold-pinned"], "off", "文字档永不固定");
  assert.equal(lay.head.attrs["data-navfold-pin-head"], undefined, "切回文字档要摘掉标题行标记");
});

test("G 侧栏不可见时挂起，不误报异常", () => {
  const run = loadArtifact({ storedMode: "compact" });
  run.mod.apply(run.ctx); // 没有布局高度 → pending
  assert.equal(run.nav.attrs["data-navfold-pinned"], "off", "不可见时不启用");
  assert.equal(run.mod.__internals.runtime.pinState, "pending");
  const text = run.mod.__internals.diagnosticsText();
  assert.match(text, /状态 无异常/, "挂起不算异常");
  assert.match(text, /待定（侧栏当前不可见/);
});

test("G 找不到工作区标题行时只固定导航，并记一条异常", () => {
  const run = loadArtifact({ storedMode: "compact" });
  // 有高度但子节点不满足「短头 + 高列表」→ 回退
  const area = run.doc.createElement("DIV");
  area._h = 524;
  const region = run.doc.createElement("DIV");
  const a = run.doc.createElement("DIV");
  const b = run.doc.createElement("DIV");
  a._h = 100;
  b._h = 100;
  region.appendChild(a);
  region.appendChild(b);
  area.appendChild(run.nav);
  area.appendChild(region);
  run.mod.apply(run.ctx);
  assert.equal(run.nav.attrs["data-navfold-pinned"], "nav-only", "找不到标题行时只固定导航");
  const text = run.mod.__internals.diagnosticsText();
  assert.match(text, /状态 异常/);
  assert.match(text, /仅固定导航/);
});

test("G 关闭固定开关后完全还原", () => {
  const run = loadArtifact({ storedMode: "compact" });
  const lay = attachLayout(run.nav, run.doc);
  run.mod.apply(run.ctx);
  assert.equal(run.nav.attrs["data-navfold-pinned"], "on");
  run.mod.__internals.setStickCompact(false);
  assert.equal(run.nav.attrs["data-navfold-pinned"], "off");
  assert.equal(lay.head.attrs["data-navfold-pin-head"], undefined, "关闭后标题行标记要摘");
});

test("B 外壳已有「更多」时收起态不再渲染我的「全部」", () => {
  const run = loadArtifact({ wrapped: true, storedMode: "hidden" });
  const nav = run.nav;
  const firstBtn = nav.children[0].children[0];
  firstBtn.setAttribute("class", "panelRow");
  const unpin = run.doc.createElement("BUTTON");
  unpin.setAttribute("class", "panelUnpin");
  nav.children[0].appendChild(unpin);
  run.mod.apply(run.ctx);
  assert.equal(run.mod.__internals.runtime.shellHasMore, true, "要识别出外壳自带入口管理");
  const bar = findBar(nav);
  assert.ok(bar, "控制条要挂上");
  assert.equal(bar.children.some((c) => c.attrs["data-navfold-action"] === "all"), false, "默认不显示我的全部");

  run.mod.__internals.setHideAllWhenShellMore(false);
  assert.equal(run.mod.__internals.getHideAllWhenShellMore(), false);
});

test("E 结构判定：包裹行记 wrapped，扁平行记 flat", () => {
  const wrapped = loadArtifact({ wrapped: true });
  wrapped.mod.apply(wrapped.ctx);
  assert.equal(wrapped.mod.__internals.runtime.structure, "wrapped");
  const flat = loadArtifact();
  flat.mod.apply(flat.ctx);
  assert.equal(flat.mod.__internals.runtime.structure, "flat");
});

test("D 诊断串包含版本、结构、行数、告警状态", () => {
  const { mod, ctx } = loadArtifact({ wrapped: true });
  mod.apply(ctx);
  const text = mod.__internals.diagnosticsText();
  assert.match(text, /dsh-nav-fold 0\.3\.3/);
  assert.match(text, /状态 无异常/);
  assert.match(text, /最近告警 —/);
  assert.match(text, /固定状态 未启用/);
  assert.match(text, /rc\.2\+（包裹行/);
  assert.match(text, /入口行数 9/);
});

test("只重置控件样式：模型回三档，档位与保留行不受影响", () => {
  const { mod, ctx, store } = loadArtifact({ storedModel: "cycle", storedMode: "hidden" });
  mod.apply(ctx);
  assert.equal(mod.__internals.getModel(), "cycle");
  mod.__internals.resetModelOnly();
  assert.equal(mod.__internals.getModel(), "segmented");
  assert.equal(mod.__internals.getMode(), "hidden", "档位不能被一起重置");
  assert.equal(mod.__internals.getKeep().length, 0, "保留行不能被一起重置");
});

test("C 中英词条一一对应（不缺键）", () => {
  const src = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  const zhBlock = src.slice(src.indexOf("  zh: {"), src.indexOf("  en: {"));
  const enBlock = src.slice(src.indexOf("  en: {"), src.indexOf("};", src.indexOf("  en: {")));
  const keys = (block) => (block.match(/^\s{4}"([^"]+)":/gm) || []).map((line) => line.trim().replace(/:$/, "").replace(/"/g, ""));
  const zh = keys(zhBlock);
  const en = keys(enBlock);
  const missingEn = zh.filter((key) => en.indexOf(key) === -1);
  const missingZh = en.filter((key) => zh.indexOf(key) === -1);
  assert.deepEqual(missingEn, [], "英文缺词条");
  assert.deepEqual(missingZh, [], "中文缺词条");
});

test("K1 分隔线用绝对定位满宽（grid / flex 两种 nav 都适用）", () => {
  const run = loadArtifact({ storedMode: "compact" });
  attachLayout(run.nav, run.doc);
  run.mod.apply(run.ctx);
  const css = run.doc.head.children.map((el) => el.textContent).join("");
  assert.ok(css.includes("[data-navfold-pin-head]{position:sticky"), "标题行要 sticky");
  assert.ok(css.includes('::after{content:"";position:absolute;left:0;right:0'), "分隔线绝对定位满宽");
  assert.ok(
    css.includes('nav[data-navfold-pinned="on"],nav[data-navfold-pinned="nav-only"]{position:sticky'),
    "导航用 sticky 贴顶"
  );
});

test("0.3.3 固定偏移：按实测内容偏移写 CSS 变量（滚动位置无关）", () => {
  const run = loadArtifact({ storedMode: "compact" });
  const lay = attachLayout(run.nav, run.doc);
  run.mod.apply(run.ctx);
  assert.equal(lay.area.style._vars["--navfold-pin-top"], "8px", "nav 偏移应取自实测");
  assert.equal(lay.area.style._vars["--navfold-pin-head-top"], "110px", "标题行偏移应取自实测");
  assert.equal(run.mod.__internals.runtime.pinTop, 8);
  assert.equal(run.mod.__internals.runtime.pinHeadTop, 110);

  // 模拟已滚动：内容偏移不应变化
  lay.area.scrollTop = 40;
  run.mod.__internals.paintForTest ? run.mod.__internals.paintForTest() : null;
});

test("0.3.3 样式用变量而不是写死 top", () => {
  const run = loadArtifact({ storedMode: "compact" });
  attachLayout(run.nav, run.doc);
  run.mod.apply(run.ctx);
  const css = run.doc.head.children.map((el) => el.textContent).join("");
  assert.ok(css.includes("top:var(--navfold-pin-top"), "nav 用偏移变量");
  assert.ok(css.includes("top:var(--navfold-pin-head-top"), "标题行用偏移变量");
});
test("0.3.3 设置页：分组标题区分图标档 / 收起档，行标签仍是「固定顶部区域」", () => {
  const { mod, ctx } = loadArtifact({ wrapped: true });
  mod.apply(ctx);
  const json = JSON.stringify(mod.__internals.NavFoldSettings());
  assert.ok(json.includes("图标档"), "要有「图标档」分组标题");
  assert.ok(json.includes("收起档"), "要有「收起档」分组标题");
  assert.equal((json.match(/固定顶部区域/g) || []).length, 2, "两行都叫「固定顶部区域」，靠分组标题区分");
});
