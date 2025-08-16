#!/usr/bin/env bash
set -euo pipefail

# ========================
# Config (可按需修改默认值)
# ========================
DEFAULT_BUMP="patch"       # patch | minor | major | prerelease
DEFAULT_TAG="latest"       # latest | next | beta | rc
DEFAULT_ACCESS="public"    # public | restricted (大多数开源包用 public)
DEFAULT_REGISTRY="https://registry.npmjs.org/"
RUN_TESTS=true             # 发布前是否跑测试
RUN_BUILD=true             # 发布前是否构建

# ========================
# Helpers
# ========================
log() { echo -e "\033[1;34m[release]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
err() { echo -e "\033[1;31m[error]\033[0m $*" >&2; }
die() { err "$*"; exit 1; }

# 用 node 解析 package.json，避免依赖 jq
pkg_json() { node -e "console.log(require('./package.json')$1)"; }

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  -b, --bump <type>     版本递增：patch|minor|major|prerelease  (默认: ${DEFAULT_BUMP})
  -p, --preid <id>      预发布标识：beta|rc 等（当 bump=prerelease 时生效）
  -t, --tag <dist-tag>  发布 dist-tag：latest|next|beta|rc     (默认: ${DEFAULT_TAG})
  -r, --registry <url>  发布 registry (默认: ${DEFAULT_REGISTRY})
  -a, --access <level>  npm access：public|restricted           (默认: ${DEFAULT_ACCESS})
  -o, --otp <code>      2FA 验证码（开启 2FA 的账号建议传入）
  -n, --no-tests        跳过测试
  --no-build            跳过构建
  -d, --dry-run         试运行（不真正发布）
  -h, --help            查看帮助

示例：
  bash scripts/release.sh -b minor -t latest
  bash scripts/release.sh -b prerelease -p beta -t beta -d
  bash scripts/release.sh --otp 123456
EOF
}

# ========================
# Parse args
# ========================
BUMP="$DEFAULT_BUMP"
PREID=""
TAG="$DEFAULT_TAG"
REGISTRY="$DEFAULT_REGISTRY"
ACCESS="$DEFAULT_ACCESS"
OTP=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--bump) BUMP="${2:-}"; shift 2 ;;
    -p|--preid) PREID="${2:-}"; shift 2 ;;
    -t|--tag) TAG="${2:-}"; shift 2 ;;
    -r|--registry) REGISTRY="${2:-}"; shift 2 ;;
    -a|--access) ACCESS="${2:-}"; shift 2 ;;
    -o|--otp) OTP="${2:-}"; shift 2 ;;
    -n|--no-tests) RUN_TESTS=false; shift ;;
    --no-build) RUN_BUILD=false; shift ;;
    -d|--dry-run) DRY_RUN=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1 (use -h 查看帮助)";;
  esac
done

# ========================
# Preflight checks
# ========================
command -v npm >/dev/null 2>&1 || die "未找到 npm，请安装 Node.js / npm"

NAME=$(pkg_json ".name")
CURRENT_VER=$(pkg_json ".version")
IS_PRIVATE=$(pkg_json ".private || false")

[[ "${IS_PRIVATE}" == "true" ]] && die "package.json: private=true，无法发布到 npm。请改为 false。"

GIT_STATUS=$(git status --porcelain)
[[ -n "${GIT_STATUS}" ]] && die "当前工作区不干净，请提交或暂存变更。"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "${CURRENT_BRANCH}" =~ ^(main|master|release/.+)$ ]] || warn "当前分支 ${CURRENT_BRANCH} 不是 main/master/release 分支，确认这就是你要发布的？"

log "Package: ${NAME}"
log "Current version: ${CURRENT_VER}"
log "Bump: ${BUMP} ${PREID:+(preid=${PREID})}"
log "Dist-tag: ${TAG}"
log "Registry: ${REGISTRY}"
log "Access: ${ACCESS}"
$DRY_RUN && warn "Dry-run 模式：不会真正发布到 npm"

# ========================
# Install / Test / Build
# ========================
log "Installing deps..."
npm ci || npm install

if $RUN_TESTS; then
  if npm run -s test >/dev/null 2>&1; then
    log "Running tests..."
    npm run test
  else
    warn "未检测到 test 脚本，跳过测试。"
  fi
else
  warn "已选择跳过测试。"
fi

if $RUN_BUILD; then
  if npm run -s build >/dev/null 2>&1; then
    log "Building..."
    npm run build
  else
    warn "未检测到 build 脚本，跳过构建。"
  fi
else
  warn "已选择跳过构建。"
fi

[[ -d "dist" ]] || warn "未发现 dist/ 目录（若你的构建不产生 dist 可忽略）。"

# ========================
# Version bump & tag
# ========================
VERSION_ARGS=("$BUMP" "-m" "release: %s")
if [[ "$BUMP" == "prerelease" && -n "$PREID" ]]; then
  VERSION_ARGS+=("--preid" "$PREID")
fi

if $DRY_RUN; then
  # 计算下一个版本（不写入），仅展示
  NEXT_VER=$(node -e "const s=require('semver');console.log(s.inc('${CURRENT_VER}','${BUMP}','${PREID||''}'))")
  log "Will bump version to: ${NEXT_VER} (dry-run)"
else
  log "Bumping version with git tag..."
  npm version "${VERSION_ARGS[@]}"
fi

NEW_VER=$(pkg_json ".version")
log "New version: ${NEW_VER}"

# ========================
# Publish
# ========================
PUBLISH_ARGS=( "--registry" "$REGISTRY" "--tag" "$TAG" "--access" "$ACCESS" )
$DRY_RUN && PUBLISH_ARGS+=("--dry-run")
[[ -n "$OTP" ]] && PUBLISH_ARGS+=("--otp" "$OTP")

log "npm whoami: $(npm whoami || echo '<not logged in>')"
if $DRY_RUN; then
  log "Dry-run npm publish..."
  npm publish "${PUBLISH_ARGS[@]}" || true
else
  log "Publishing to npm..."
  npm publish "${PUBLISH_ARGS[@]}"
  log "Push commit and tags..."
  git push --follow-tags
fi

log "Done. ${NAME}@${NEW_VER}  =>  tag: ${TAG}"
