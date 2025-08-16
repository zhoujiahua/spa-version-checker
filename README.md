# spa-version-checker

> Framework-agnostic **SPA runtime version update detector**.
> 在不重启应用的前提下，**检测前端新版本**并以 UI 或回调的方式提示刷新。开箱支持版本号/ETag 对比、跨标签页同步、「稍后再说」冷静期、仅在可见时轮询等。

```html

<p align="left">
  <a href="https://www.npmjs.com/package/spa-version-checker">
    <img alt="npm" src="https://img.shields.io/npm/v/spa-version-checker.svg">
  </a>
  <a href="https://www.npmjs.com/package/spa-version-checker">
    <img alt="downloads" src="https://img.shields.io/npm/dm/spa-version-checker.svg">
  </a>
  <img alt="types" src="https://img.shields.io/badge/types-TypeScript-blue">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green">
  <img alt="bundle" src="https://img.shields.io/badge/bundle-tsup-informational">
</p>
```

## ✨ 特性

* 🧠 **框架无关**：核心仅依赖浏览器 `fetch`/`localStorage`/`BroadcastChannel`；
* ⚡ **即时+定时**：启动立即检测，支持可见时轮询（节能）；
* 🏷️ **版本识别**：对比 `/meta.json` 的 `version` 字段；可结合 **ETag/304** 降流量；
* 🧩 **适配器**：默认无 UI（回调），内置 Element Plus 适配器（懒加载，不污染类型与打包）；
* 🪟 **跨标签页同步**：一个标签页发现新版本，其他页同时收到通知；
* 🕒 **冷静期**：用户点「稍后再说」后可进入 TTL 冷静期；
* 🛡️ **可扩展**：自定义 `fetchMeta()` 对接鉴权接口、`asset-manifest.json` 或 `version.txt`。

## 📦 安装

```bash
# 只用核心（无 UI）
npm i spa-version-checker
# 或
pnpm add spa-version-checker
```

> 如果使用 Element Plus 适配器：

```bash
npm i element-plus
```

> 本包将 `element-plus` 声明为 **可选** peer 依赖（只在使用该适配器时才需要）。

## 🚀 快速上手

### 1) 无 UI（回调）—— 任何框架/原生可用

```ts
import { createHeadlessChecker } from 'spa-version-checker';

const checker = createHeadlessChecker({
  metaUrl: '/meta.json',        // 后端产出：{ "version": "2025.08.16-001", ... }
  intervalMs: 5 * 60 * 1000,    // 5 分钟
  onRefreshRequest(newV, oldV) {
    // 用你自己的弹窗/通知框
    if (confirm(`检测到新版本 ${newV}，是否刷新？`)) {
      location.reload();
    } else {
      checker.dismissFor(30 * 60 * 1000); // 30 分钟冷静期
    }
  },
});
checker.start();
```

### 2) Vue 3 + Element Plus

```ts
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import { createElementPlusChecker } from 'spa-version-checker';

const app = createApp(App);
app.mount('#app');

const checker = createElementPlusChecker({
  metaUrl: '/meta.json',
  intervalMs: 10 * 60 * 1000,
});
checker.start();
```

### 3) React + Ant Design（示例用回调）

```tsx
import { App as AntApp, Modal } from 'antd';
import { useEffect } from 'react';
import { createHeadlessChecker } from 'spa-version-checker';

export default function Root() {
  const antd = AntApp.useApp();
  useEffect(() => {
    const checker = createHeadlessChecker({
      metaUrl: '/meta.json',
      onRefreshRequest(newV) {
        antd.modal.confirm({
          title: '版本更新',
          content: `检测到新版本 ${newV}，是否刷新？`,
          onOk: () => location.reload(),
          onCancel: () => checker.dismissFor(), // 默认冷静期
        });
      },
    });
    checker.start();
    return () => checker.stop();
  }, []);
  return <YourApp />;
}
```

## 🧱 服务端与构建建议

**CI/CD** 每次构建写出 `/meta.json`（或 `/version.txt`）：

```json
{
  "version": "2025.08.16-001",
  "commit": "abcdef1",
  "buildTime": "2025-08-16T11:22:33Z"
}
```

**Nginx/网关**：

* 为 `/meta.json` 加 `ETag`；
* `Cache-Control: no-store`（避免被 CDN 长缓存）；
* 若走 CDN，确保能回源拿到新 ETag/文件。

## 🧪 API

### `createVersionChecker(options): VersionCheckerController`

核心创建器，**无 UI**，但你可以通过回调实现任意 UI/逻辑。

#### Options（TypeScript）

```ts
export type VersionMeta = { version?: string; [k: string]: unknown };
export type FetchMeta = (url: string) => Promise<VersionMeta | null>;

export interface VersionCheckerOptions {
  metaUrl?: string;                    // 默认 '/meta.json'
  intervalMs?: number;                 // 轮询间隔，默认 10 分钟
  onDifferent?: (newV: string, oldV: string | null) => void;
  onError?: (err: unknown) => void;
  storageKey?: string;                 // 当前版本号存储 key
  broadcastKey?: string;               // BroadcastChannel 名称
  immediate?: boolean;                 // 启动时立即检测（默认 true）
  respectVisibility?: boolean;         // 仅在可见时轮询（默认 true）
  useETag?: boolean;                   // 使用 If-None-Match / 304（默认 true）
  fetchMeta?: FetchMeta;               // 自定义拉取逻辑（鉴权等）
  dismissTTLms?: number;               // 「稍后再说」冷静期（默认 15 min）
}
```

#### Controller

```ts
interface VersionCheckerController {
  start(): void;
  stop(): void;
  checkNow(): Promise<void>;
  getCurrent(): string | null;
  setCurrent(v: string | null): void;
  dismissFor(ms?: number): void; // 进入冷静期（默认 options.dismissTTLms）
}
```

### `createHeadlessChecker(options)`

在 `onDifferent` 中包装为语义化的 `onRefreshRequest` 回调，便于接入 UI 框架。

### `createElementPlusChecker(options)`

Element Plus 适配器（**运行时懒加载**），自动弹出 `ElMessageBox.confirm`。

> 不会把 Element Plus 打进你的库包；仅在运行时需要它。

## 🔁 跨标签页同步

当某标签页发现新版本，会通过 `BroadcastChannel` 通知其它同源标签页；你的 UI/回调会在每个标签页各自触发，保证提示一致性。

## 🧯 常见最佳实践

* **仅在前台轮询**：`respectVisibility: true` 可避免后台标签页浪费；
* **路由切换/登录后即刻检查**：调用 `checkNow()`；
* **「稍后再说」**：调用 `dismissFor(ms)`，默认用 `dismissTTLms`；
* **与 SW 联动**：见下章节；
* **鉴权环境**：用 `fetchMeta` 自定义拉取逻辑并携带 Token/Headers。

## 🧩 与 Service Worker（Workbox）联动

当 checker 发现新版本，你可以让 SW 直接接管资源更新，再刷新页面：

**页面侧：**

```ts
const checker = createHeadlessChecker({
  onRefreshRequest() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        // 等待 SW 激活后再刷新
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          location.reload();
        });
      });
    } else {
      location.reload();
    }
  },
});
checker.start();
```

**SW 侧（示例）：**

```js
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
```

## ❓ FAQ

**Q1: 为什么不用直接对比 `index.html` 的 hash？**
多数 SPA 会被 SW/浏览器缓存劫持，`index.html` 的更新时间未必可靠。使用独立 `meta.json` + ETag 更可控。

**Q2: 需要后端/运维做什么？**
产出并托管 `/meta.json`，开启 ETag，避免 CDN 长缓存；若走鉴权，开放一个返回版本号的轻量接口。

**Q3: SSR 会怎样？**
本库在 **浏览器** 运行；SSR 端渲染时请确保在 `onMounted/useEffect` 等客户端生命周期调用。

**Q4: 为什么有冷静期？**
避免用户在长会话中被频繁打断。你也可以在确认框中提供「忽略本次」或「稍后再说」。

## 🛠 故障排查

* **TS dts 构建报 `ElMessageBox` 相关错误**：适配器已采用 **运行时懒加载**，不再静态导入 UI 组件，确保 dts 构建通过；
* **TS1323: dynamic import**：适配器使用 `new Function('p','return import(p)')` 间接导入，避免 dts 对语法级 `import()` 的约束；
* **拿不到最新 `meta.json`**：检查 CDN/代理是否缓存；为 `/meta.json` 添加 `Cache-Control: no-store`，或附带时间戳 `?_t=Date.now()`（本库已内置）；
* **ETag 不生效**：确认网关透传 `ETag` 与 `If-None-Match`；某些 CDN 需显式开启；
* **跨域**：若 `metaUrl` 跨域，请确保响应包含正确的 CORS 头（`Access-Control-Allow-Origin` 等）。

## 🧩 生态与扩展

* 适配更多 UI：

  * Ant Design：在 `createHeadlessChecker` 的回调里调 `Modal.confirm`；
  * Naive UI、Vuetify、Element UI（Vue2）同理；
* 版本来源：

  * `/version.txt`（纯文本一行版本号）；
  * 构建产物 `asset-manifest.json`/`manifest.json`；
  * 鉴权 API（`fetchMeta` 自定义实现）。

## 🧰 开发与构建

```bash
pnpm i
pnpm build   # 产出 ESM+CJS+dts 到 dist/
pnpm dev     # watch 模式
```

项目结构：

```
src/
  types.ts
  utils.ts
  checker.ts
  adapters/
    headless.ts
    element-plus.ts
```

## 🤝 贡献

欢迎提 Issue / PR！
建议遵循：

* 提交信息使用 `feat/fix/docs/chore` 前缀；
* 新增特性请附带示例与测试（如果是适配器，优先使用运行时懒加载方式）；
* 变更请在 PR 描述中说明对 API 的影响与迁移指南。

## 📝 版本管理

遵循 **Semantic Versioning**（语义化版本）。Breaking changes 将在 `CHANGELOG.md` 与 Release Notes 中说明。

## 📄 许可证

[MIT](./LICENSE)

---

**致谢**：本项目灵感来自 SPA 在生产环境中常见的「静态资源版本不一致」问题，旨在提供一个最小而稳健的运行时检测方案，帮助团队以可控方式引导用户刷新到最新版本。
