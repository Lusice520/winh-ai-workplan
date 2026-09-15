#!/bin/sh

set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
runtime_root=${PROJECT_LOCAL_TOOLS_DIR:-"$project_root/.local-tools"}
data_root=${PROJECT_LOCAL_DATA_DIR:-"$project_root/.local-data/postgresql-18"}
postgres_app="$runtime_root/postgresapp-2.9.6/Postgres.app"
postgres_bin="$postgres_app/Contents/Versions/18/bin"
port=${DATABASE_PORT:-54329}
database_name=${DATABASE_NAME:-winh_workplan}
database_user=${DATABASE_USERNAME:-winh}
command=${1:-status}

case "$port" in
  *[!0-9]* | '')
    echo "DATABASE_PORT 必须是数字。" >&2
    exit 1
    ;;
esac

case "$database_name" in
  *[!A-Za-z0-9_]* | '')
    echo "DATABASE_NAME 只能包含字母、数字和下划线。" >&2
    exit 1
    ;;
esac

case "$database_user" in
  *[!A-Za-z0-9_]* | '')
    echo "DATABASE_USERNAME 只能包含字母、数字和下划线。" >&2
    exit 1
    ;;
esac

if [ ! -x "$postgres_bin/pg_ctl" ]; then
  echo "未找到项目本地 PostgreSQL。请先执行 ./scripts/development/bootstrap-local-postgresql.sh。" >&2
  exit 1
fi

postgres_is_running() {
  "$postgres_bin/pg_ctl" status -D "$data_root" >/dev/null 2>&1
}

ensure_database() {
  current_user=$(id -un)
  if ! "$postgres_bin/psql" -h 127.0.0.1 -p "$port" -d postgres -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname = '$database_user'" | grep -q 1; then
    "$postgres_bin/createuser" -h 127.0.0.1 -p "$port" --no-superuser --no-createdb --no-createrole "$database_user"
  fi

  if ! "$postgres_bin/psql" -h 127.0.0.1 -p "$port" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$database_name'" | grep -q 1; then
    "$postgres_bin/createdb" -h 127.0.0.1 -p "$port" --owner="$database_user" "$database_name"
  fi

  if [ -z "$current_user" ]; then
    echo "无法识别当前本机用户。" >&2
    exit 1
  fi
}

case "$command" in
  start)
    if [ ! -f "$data_root/PG_VERSION" ]; then
      mkdir -p "$(dirname "$data_root")"
      "$postgres_bin/initdb" --pgdata="$data_root" --encoding=UTF8 --locale=C --auth-local=trust --auth-host=trust
    fi

    if ! postgres_is_running; then
      "$postgres_bin/pg_ctl" -D "$data_root" -l "$data_root/server.log" \
        -o "-h 127.0.0.1 -p $port" start
    fi

    "$postgres_bin/pg_isready" -h 127.0.0.1 -p "$port" -t 10
    ensure_database
    echo "本地 PostgreSQL 已就绪：postgresql://$database_user@127.0.0.1:$port/$database_name"
    ;;
  stop)
    if postgres_is_running; then
      "$postgres_bin/pg_ctl" -D "$data_root" stop -m fast
    else
      echo "本地 PostgreSQL 未运行。"
    fi
    ;;
  status)
    if postgres_is_running; then
      "$postgres_bin/pg_isready" -h 127.0.0.1 -p "$port" -t 2
      echo "数据目录：$data_root"
    else
      echo "本地 PostgreSQL 未运行。"
      exit 1
    fi
    ;;
  *)
    echo "用法：./scripts/development/local-postgres.sh {start|stop|status}" >&2
    exit 1
    ;;
esac
