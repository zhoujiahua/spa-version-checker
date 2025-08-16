import { createVersionChecker } from '../checker';
import type { VersionCheckerOptions } from '../types';

/** 无界面模式：把“版本变化”交给回调处理 */
export function createHeadlessChecker(
    opts: VersionCheckerOptions & { onRefreshRequest?: (newV: string, oldV: string | null) => void }
) {
    return createVersionChecker({
        ...opts,
        onDifferent: (n, o) => {
            opts.onRefreshRequest?.(n, o);
        }
    });
}
