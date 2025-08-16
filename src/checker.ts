import { VersionCheckerOptions, VersionCheckerController, VersionMeta } from './types';
import { safeJSON, isVisible } from './utils';

const DEFAULTS: Required<Pick<VersionCheckerOptions,
  'metaUrl' | 'intervalMs' | 'storageKey' | 'broadcastKey' |
  'immediate' | 'respectVisibility' | 'useETag' | 'dismissTTLms'
>> = {
  metaUrl: '/meta.json',
  intervalMs: 10 * 60 * 1000,
  storageKey: '__svc_current_version__',
  broadcastKey: 'svc_version_channel',
  immediate: true,
  respectVisibility: true,
  useETag: true,
  dismissTTLms: 15 * 60 * 1000,
};

function getStored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function setStored(key: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch { }
}

function getDismissUntil(): number {
  const v = localStorage.getItem('__svc_dismiss_until__');
  return v ? Number(v) : 0;
}
function setDismissUntil(ts: number) {
  localStorage.setItem('__svc_dismiss_until__', String(ts));
}

export function createVersionChecker(opts: VersionCheckerOptions = {}): VersionCheckerController {
  const o = { ...DEFAULTS, ...opts };
  let timer: number | null = null;
  let etag: string | null = null;
  let bc: BroadcastChannel | null = null;

  const fetchMetaDefault = async (url: string): Promise<VersionMeta | null> => {
    const headers: HeadersInit = {};
    if (o.useETag && etag) headers['If-None-Match'] = etag;
    const res = await fetch(`${url}?_t=${Date.now()}`, { cache: 'no-store', headers });
    if (res.status === 304) return null;             // 无变化
    const newEtag = res.headers.get('ETag');
    if (newEtag) etag = newEtag;
    return await safeJSON(res);
  };

  const fetchMeta = o.fetchMeta ?? fetchMetaDefault;

  const getCurrent = () => getStored(o.storageKey);
  const setCurrent = (v: string | null) => setStored(o.storageKey, v);

  const notifyDifferent = (newV: string, oldV: string | null) => {
    // 广播给其它标签页
    try {
      bc?.postMessage({ type: 'VERSION_DIFFERENT', newV, oldV });
    } catch { }
    // 回调交给上层（UI 适配器/应用）
    opts.onDifferent?.(newV, oldV);
  };

  const checkNow = async () => {
    // “稍后再说”冷静期
    if (getDismissUntil() > Date.now()) return;

    try {
      const meta = await fetchMeta(o.metaUrl);
      if (!meta) return; // 304 或拿不到
      const newV = typeof meta.version === 'string' ? meta.version : null;
      if (!newV) return;

      const oldV = getCurrent();
      if (oldV && newV !== oldV) {
        notifyDifferent(newV, oldV);
      }
      // 首次或一致时，记录当前版本
      if (!oldV || oldV === newV) setCurrent(newV);
    } catch (err) {
      opts.onError?.(err);
    }
  };

  const loop = async () => {
    if (o.respectVisibility && !isVisible()) return;
    await checkNow();
  };

  const start = () => {
    if (timer !== null) return;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel(o.broadcastKey);
      bc.onmessage = (e: MessageEvent) => {
        if (e.data?.type === 'VERSION_DIFFERENT') {
          // 其它标签页已发现更新，本标签页也走 onDifferent 流程
          opts.onDifferent?.(e.data.newV, e.data.oldV);
        }
      };
    }
    if (o.immediate) { void checkNow(); }
    timer = window.setInterval(loop, o.intervalMs);
    if (o.respectVisibility) {
      document.addEventListener('visibilitychange', () => { if (isVisible()) void checkNow(); });
    }
  };

  const stop = () => {
    if (timer !== null) { clearInterval(timer); timer = null; }
    try { bc?.close(); } catch { }
  };

  // 提供“稍后再说”的统一处理（供适配器调用）
  (start as any).dismissFor = (ms: number = o.dismissTTLms) => {
    setDismissUntil(Date.now() + ms);
  };

  const dismissFor = (ms: number = o.dismissTTLms) => {
    setDismissUntil(Date.now() + ms);
  };

  return { start, stop, checkNow, getCurrent, setCurrent, dismissFor };
}
