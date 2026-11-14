# dsh-nav-fold（nav-fold 导航折叠）

[![npm version](https://img.shields.io/npm/v/dsh-nav-fold)](https://www.npmjs.com/package/dsh-nav-fold)
[![ci](https://github.com/TIPE2587/dsh-nav-fold/actions/workflows/ci.yml/badge.svg)](https://github.com/TIPE2587/dsh-nav-fold/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/dsh-nav-fold)](./LICENSE)

给 DSH 左侧栏顶部的**功能入口**列表加三态折叠——**文字行 → 紧凑图标网格 → 收起**，把被插件挤占的高度还给会话列表，尤其针对手机抽屉。

## 为什么要它

侧栏顶部那串入口（Plugins / 自动化任务 / 上下文洞察 / …）是官方 `sidebar.panellist` 列表，每装一个带主面板的插件就多一行（36px）。实测 264px 宽的一列里 8 行占 **340px**，其下工作区/会话区只剩 **170px**；手机抽屉里更惨，而且这块既不滚动也不折叠。

## 三种形态

| 形态 | 表现 | 实测高度 |
|---|---|---|
| 文字行 `expanded` | 原样，装完零视觉变化 | 340px + 控制条 22px |
| 图标网格 `compact` | 图标网格、隐文字（保留无障碍名）、行高 32px | **92px** |
| 收起 `hidden` | 只留「收起时保留」勾选的行（默认第一行）+「更多」锚点 | **100px** |

## 控制条在哪

挂在**被折叠那一组的末尾**（「更多」下面一行）——它的作用对象就是上面那几行，不是会话列表，也不是设置区：

```
[ Plugins ]
[ Automation tasks ]
   … 8 行 …
[ More ]
[ ✎ 已收起 7   ≡ 文字  ▦ 图标  ⌃ 收起   ☰ 全部 ]   ← 控制条
[ Workspaces  🔍 ⚙ ＋ ]
```

- 收起态左侧显示计数徽标（`已收起 7` / `7 collapsed`）
- 56px 图标轨里退化为单个图标，点一下换下一档
- **图标档 / 图标轨**下每行带原生 `title`（悬停显示插件名；打 `data-navfold-title` 标记，切回文字档或卸载时摘除）；文字档不加，避免与可见文字重复
- 收起态多一个 **`☰ 全部`**：点开浮层列出所有入口，点任意一项即跳转（产品自带的「更多」菜单不列面板，这是收起态下的一键直达）
- 浮层优先开在控制条上方，上方放不下自动翻到下方；点条目 / Esc / 点外部 / 滚动都会关闭

## 三种控件模型（设置里切换）

| 模型 | 样子 |
|---|---|
| `segmented`（默认） | 三个语义恒定的按钮，当前档高亮（`aria-pressed`） |
| `cycle` | 一个按钮，**一次只显示当前档那一个图标**，点了换成下一档 |
| `header` | **标题行**：整组收成一行 `⌃ 功能入口 8`（位于入口列表最上方），点标题展开/收起；只有"文字行 / 收起"两态，图标网格档不可用。被外壳挪位会自动拉回，连续 3 次失败退回 `segmented` |

## 设置面板（设置 → nav-fold 导航折叠）

行式布局，与 shell 自己的设置项一致：

| 分组 | 内容 |
|---|---|
| 摘要 | `文字行 · 8 个入口` |
| 控制条样式 | segmented：三档选择器 / 单按钮循环 / 标题行 |
| 自动档 | switch。开着时：窗口宽 <768 或高 <760 首次打开进图标档；手动选过以你为准 |
| 收起时保留 | `1/8 保留` 计数 + `全部`/`清空` + 逐行 chip（选中蓝底 + ✓）；一个不选默认保留第一行 |
| 恢复默认 | **点两次**确认后清掉 `mode / mode-narrow / model / auto / keep / mode-stash` 六个键（第一次只进入确认态，3 秒不点自动取消） |

所有状态样式写在注入的样式表里（属性选择器驱动），组件内联只负责布局。

## 偏好与存储

| 键 | 含义 | 缺省 |
|---|---|---|
| `dsh-nav-fold/v1/mode` | 桌面档位 | `expanded` |
| `dsh-nav-fold/v1/mode-narrow` | 手机档位 | `compact` |
| `dsh-nav-fold/v1/model` | 控件模型 | `segmented` |
| `dsh-nav-fold/v1/auto` | 自动档开关 | `on` |
| `dsh-nav-fold/v1/keep` | 收起时保留的行（按显示名） | `[]` → 保留第一行 |

桌面与手机**各记一份档位**；文案跟随 shell 语言（zh / en），品牌名 `nav-fold 导航折叠` 不翻译。

## 设计边界

- **不读写官方 `panelPins`**（ui-sidebar 闭包私有内存，插件重载即重置），两套机制正交。
- **不改官方行**：只在命中的 nav 上加属性、在行上打 `data-navfold-keep`，并把自己那一个控制条节点追加到该 nav 末尾；卸载即全部摘除。
- 追加节点由 MutationObserver 守护（外壳重渲染把它挤掉时 150ms 内挂回）；观察器**忽略自身变更**，避免 150ms 一次无限重绘。
- 首屏宽限 3s：React 还没渲染出侧栏时不喊"结构变了"；宽限后仍找不到才 warn 一次，UI 保持原样。
- 只依赖 `slots` 与 `locale` 两个客户端服务；折叠本身是纯 DOM。

## 安装

要求：DSH **≥ 0.2.2-rc.1**，Node **≥ 22**。

### 从 npm（推荐）

```bash
dsh plugin --profile web add dsh-nav-fold
sudo systemctl restart dsh-web      # 首次安装需要重启 Host 才会加载浏览器半
```

### 从源码（开发/二次修改）

```bash
git clone git@github.com:TIPE2587/dsh-nav-fold.git
```

把仓库以 `link:` 方式加进 profile 的 `dependencies`，并把包名加入 `dsh.profile.bundles`，重启 Host。
之后**只改浏览器半不需要重启**，刷新页面即可（浏览器会缓存模块，验证改动请 `Ctrl+Shift+R`）。

## 卸载

1. 从 profile `package.json` 删掉 `dependencies["dsh-nav-fold"]` 与 `bundles` 里的 `dsh-nav-fold`
2. 删符号链接 `node_modules/dsh-nav-fold`
3. 重启 Host；localStorage 里五个键可留可删（无引用）

## 开发

```bash
node --test test/*.test.mjs   # 14 项，直接测上线产物 lib/client.js（vm + 假 DOM，零依赖）
```

- `lib/client.js` 就是上线文件，无构建步骤；外层是 DSH 的 `window.__ModuleLoader__.load({ id, factory })` 包裹。
- `lib/index.js` 宿主半是空壳，存在只为让包被 Loader 收录，从而让 `dsh.client` 扫描收进浏览器半。

## 版本契约（升级 DSH 后看这里）

定位器只依赖结构，不依赖 CSS Modules 的 hash 类名：`nav` 的子元素必须是 `button`/`span`（外加我们自己的控制条 `div`），至少一行是"图标 span + 文字 span"两段结构，且不含 `input/textarea/select/a/form`。图标轨判定优先读外壳的 `[data-sidebar-collapsed="true"]`（收起时内容是被平移进轨道的，布局宽度量不出来），读不到再退回宽度判断。

若控制台出现 `未找到「功能入口」导航`，说明外壳结构变了 —— 改 `looksLikePanelNav` 即可。
