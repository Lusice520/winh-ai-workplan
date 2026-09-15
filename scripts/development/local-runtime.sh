#!/bin/sh

set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
runtime_root=${PROJECT_LOCAL_TOOLS_DIR:-"$project_root/.local-tools"}

load_local_environment() {
  dotenv_file=$1
  dotenv_line_number=0

  [ -f "$dotenv_file" ] || return 0

  while IFS= read -r dotenv_line || [ -n "$dotenv_line" ]; do
    dotenv_line_number=$((dotenv_line_number + 1))

    case "$dotenv_line" in
      '' | \#*)
        continue
        ;;
    esac

    case "$dotenv_line" in
      *=*)
        dotenv_key=${dotenv_line%%=*}
        dotenv_value=${dotenv_line#*=}
        ;;
      *)
        echo ".env 第 $dotenv_line_number 行不是 KEY=VALUE 格式。" >&2
        exit 1
        ;;
    esac

    case "$dotenv_key" in
      '' | [0-9]* | *[!A-Za-z0-9_]*)
        echo ".env 第 $dotenv_line_number 行的变量名无效。" >&2
        exit 1
        ;;
    esac

    # Allow quoted values without evaluating them as shell code. This keeps
    # symbols such as $, ! and = in local passwords literal and private.
    case "$dotenv_value" in
      \"*\")
        dotenv_value=${dotenv_value#\"}
        dotenv_value=${dotenv_value%\"}
        ;;
      \'*\')
        dotenv_value=${dotenv_value#\'}
        dotenv_value=${dotenv_value%\'}
        ;;
    esac

    # Explicit process variables take precedence over local defaults.
    if printenv "$dotenv_key" >/dev/null 2>&1; then
      continue
    fi

    export "$dotenv_key=$dotenv_value"
  done < "$dotenv_file"
}

load_local_environment "$project_root/.env"

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64)
    node_platform=darwin-arm64
    ;;
  Darwin/x86_64)
    node_platform=darwin-x64
    ;;
  *)
    echo "本地运行时包装脚本仅支持 macOS Apple Silicon 或 Intel。" >&2
    exit 1
    ;;
esac

node_home="$runtime_root/node-v24.19.0-$node_platform"
if [ ! -x "$node_home/bin/node" ]; then
  echo "未找到项目本地 Node 24.19.0。请先执行 ./scripts/development/bootstrap-local-runtime.sh。" >&2
  exit 1
fi

export PATH="$node_home/bin:$PATH"

if [ "${1:-}" = "--java" ]; then
  shift
  java_home="$runtime_root/jdk-21/Contents/Home"
  if [ ! -x "$java_home/bin/java" ] || [ ! -x "$java_home/bin/javac" ]; then
    echo "未找到项目本地 Java 21。请先执行 ./scripts/development/bootstrap-local-runtime.sh。" >&2
    exit 1
  fi
  export JAVA_HOME="$java_home"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "$#" -eq 0 ]; then
  echo "用法：./scripts/development/local-runtime.sh [--java] -- <命令>" >&2
  exit 1
fi

cd "$project_root"
exec "$@"
