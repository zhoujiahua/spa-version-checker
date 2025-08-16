export type VersionMeta = { version?: string;[k: string]: unknown };
export type FetchMeta = (url: string) => Promise<VersionMeta | null>;

export interface VersionCheckerOptions {
    metaUrl?: string;                     // 默认 /meta.json
    intervalMs?: number;                  // 默认 10 min
    onDifferent?: (newV: string, oldV: string | null) => void;  // 版本变化回调
    onError?: (err: unknown) => void;
    storageKey?: string;                  // 本地记录当前版本
    broadcastKey?: string;                // BroadcastChannel 名称
    immediate?: boolean;                  // 启动时立刻检测
    respectVisibility?: boolean;          // 仅在页面可见时轮询
    useETag?: boolean;                    // 用 ETag/If-None-Match
    fetchMeta?: FetchMeta;                // 自定义获取元信息
    dismissTTLms?: number;                // “稍后再说”重试时间，默认 15 min
}

export interface VersionCheckerController {
    start(): void;
    stop(): void;
    checkNow(): Promise<void>;
    getCurrent(): string | null;
    setCurrent(v: string | null): void;

    /** 进入“稍后再说”冷静期（默认使用配置的 dismissTTLms） */
    dismissFor(ms?: number): void;
}
