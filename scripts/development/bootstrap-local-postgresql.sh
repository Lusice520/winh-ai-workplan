#!/bin/sh

set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
runtime_root=${PROJECT_LOCAL_TOOLS_DIR:-"$project_root/.local-tools"}
postgres_app_version=2.9.6
postgres_major=18
install_root="$runtime_root/postgresapp-$postgres_app_version"
app_path="$install_root/Postgres.app"
postgres_binary="$app_path/Contents/Versions/$postgres_major/bin/postgres"
download_url="https://github.com/PostgresApp/PostgresApp/releases/download/v$postgres_app_version/Postgres-$postgres_app_version-$postgres_major.dmg"
dmg_path="$runtime_root/Postgres-$postgres_app_version-$postgres_major.dmg"

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64 | Darwin/x86_64)
    ;;
  *)
    echo "本地 PostgreSQL 准备脚本仅支持 macOS Apple Silicon 或 Intel。" >&2
    exit 1
    ;;
esac

if [ -x "$postgres_binary" ]; then
  "$postgres_binary" --version
  exit 0
fi

if [ -e "$install_root" ]; then
  echo "发现不完整的本地 PostgreSQL 目录：$install_root。请先手动检查后再准备。" >&2
  exit 1
fi

mkdir -p "$runtime_root"
task_tmpdir=$(mktemp -d "$runtime_root/bootstrap-postgresql.XXXXXX")
mount_point=

cleanup() {
  if [ -n "$mount_point" ]; then
    hdiutil detach "$mount_point" -quiet || true
  fi
  rm -rf "$task_tmpdir"
}

trap cleanup EXIT HUP INT TERM

if [ ! -f "$dmg_path" ]; then
  curl --fail --location --retry 3 --silent --show-error \
    --output "$dmg_path" \
    "$download_url"
fi

hdiutil verify "$dmg_path" >/dev/null
mount_output=$(hdiutil attach -nobrowse -readonly "$dmg_path")
mount_point=$(printf '%s\n' "$mount_output" | awk -F '\t' '/\/Volumes\// { print $NF }' | tail -n 1)

if [ -z "$mount_point" ] || [ ! -d "$mount_point/Postgres.app" ]; then
  echo "无法从 PostgreSQL 安装镜像中定位 Postgres.app。" >&2
  exit 1
fi

staging_root="$task_tmpdir/postgresapp"
mkdir -p "$staging_root"
ditto "$mount_point/Postgres.app" "$staging_root/Postgres.app"
codesign --verify --deep --strict --verbose=2 "$staging_root/Postgres.app"

if [ ! -x "$staging_root/Postgres.app/Contents/Versions/$postgres_major/bin/postgres" ]; then
  echo "下载的 Postgres.app 未包含 PostgreSQL $postgres_major。" >&2
  exit 1
fi

mv "$staging_root" "$install_root"
mount_point=
hdiutil detach "$(printf '%s\n' "$mount_output" | awk -F '\t' '/\/Volumes\// { print $NF }' | tail -n 1)" -quiet

"$postgres_binary" --version
