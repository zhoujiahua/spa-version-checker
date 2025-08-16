import { createVersionChecker } from '../checker';
import type { VersionCheckerOptions } from '../types';

// 用间接动态导入，避免 TypeScript dts 解析 import() 语法
const din = new Function('p', 'return import(p)') as (p: string) => Promise<any>;

export function createElementPlusChecker(opts: VersionCheckerOptions = {}) {
  const checker = createVersionChecker({
    ...opts,
    onDifferent: (n, o) => {
      din('element-plus')
        .then((m) =>
          m.ElMessageBox.confirm(
            '检测到系统发布了新版本，是否立即刷新以获取最新功能？',
            '版本更新提醒',
            {
              confirmButtonText: '立即刷新',
              cancelButtonText: '稍后再说',
              type: 'warning',
              closeOnClickModal: false,
              closeOnPressEscape: false
            }
          )
        )
        .then(() => window.location.reload())
        .catch(() => {
          // 用户选择“稍后再说”
          checker.dismissFor(); // 使用默认冷静期
        });
    }
  });

  return checker;
}
