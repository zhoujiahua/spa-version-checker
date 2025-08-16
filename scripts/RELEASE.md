# 用法示例

### 常规发布（自动 patch + latest）：

bash scripts/release.sh


### 指定 minor，并打 latest：

bash scripts/release.sh -b minor -t latest


### 预发布 beta（版本如 1.3.0-beta.0），并发布到 beta tag：

bash scripts/release.sh -b prerelease -p beta -t beta


### 试运行（不真正发布）：

bash scripts/release.sh -d


### 开启了 npm 2FA 的账号（推荐带上 --otp）：

bash scripts/release.sh --otp 123456
