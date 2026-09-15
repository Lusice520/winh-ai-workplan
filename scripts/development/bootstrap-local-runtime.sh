#!/bin/sh

set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
runtime_root=${PROJECT_LOCAL_TOOLS_DIR:-"$project_root/.local-tools"}
node_version=v24.19.0

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64)
    node_platform=darwin-arm64
    java_platform=macos-aarch64
    ;;
  Darwin/x86_64)
    node_platform=darwin-x64
    java_platform=macos-x64
    ;;
  *)
    echo "仅支持 macOS Apple Silicon 或 Intel 本地运行时准备。" >&2
    exit 1
    ;;
esac

node_directory="node-${node_version}-${node_platform}"
node_home="$runtime_root/$node_directory"
java_home="$runtime_root/jdk-21"

mkdir -p "$runtime_root"

verify_sha256() {
  expected_sha256=$1
  target_file=$2
  actual_sha256=$(shasum -a 256 "$target_file" | awk '{print $1}')

  if [ "$expected_sha256" != "$actual_sha256" ]; then
    echo "SHA-256 校验失败：$target_file" >&2
    exit 1
  fi
}

if [ ! -x "$node_home/bin/node" ]; then
  task_tmpdir=$(mktemp -d "$runtime_root/bootstrap-node.XXXXXX")
  trap 'rm -rf "$task_tmpdir"' EXIT HUP INT TERM
  node_archive="$task_tmpdir/$node_directory.tar.xz"
  node_checksums="$task_tmpdir/SHASUMS256.txt"

  curl --fail --location --retry 3 --silent --show-error \
    --output "$node_archive" \
    "https://nodejs.org/dist/$node_version/$node_directory.tar.xz"
  curl --fail --location --retry 3 --silent --show-error \
    --output "$node_checksums" \
    "https://nodejs.org/dist/$node_version/SHASUMS256.txt"

  expected_node_sha256=$(awk -v filename="$node_directory.tar.xz" '$2 == filename { print $1 }' "$node_checksums")
  if [ -z "$expected_node_sha256" ]; then
    echo "未在 Node.js 官方校验清单中找到 $node_directory.tar.xz。" >&2
    exit 1
  fi
  verify_sha256 "$expected_node_sha256" "$node_archive"

  tar -xJf "$node_archive" -C "$task_tmpdir"
  mv "$task_tmpdir/$node_directory" "$node_home"
  rm -rf "$task_tmpdir"
  trap - EXIT HUP INT TERM
fi

if [ ! -x "$java_home/Contents/Home/bin/java" ]; then
  java_bundle=
  for candidate in "$runtime_root"/jdk-21*.jdk; do
    if [ -x "$candidate/Contents/Home/bin/java" ]; then
      java_bundle=$candidate
      break
    fi
  done

  if [ -z "$java_bundle" ]; then
    task_tmpdir=$(mktemp -d "$runtime_root/bootstrap-java.XXXXXX")
    trap 'rm -rf "$task_tmpdir"' EXIT HUP INT TERM
    java_archive="$task_tmpdir/jdk-21.tar.gz"
    java_checksum="$task_tmpdir/jdk-21.tar.gz.sha256"

    curl --fail --location --retry 3 --silent --show-error \
      --output "$java_archive" \
      "https://download.oracle.com/java/21/latest/jdk-21_${java_platform}_bin.tar.gz"
    curl --fail --location --retry 3 --silent --show-error \
      --output "$java_checksum" \
      "https://download.oracle.com/java/21/latest/jdk-21_${java_platform}_bin.tar.gz.sha256"

    expected_java_sha256=$(awk '{ print $1 }' "$java_checksum")
    if [ -z "$expected_java_sha256" ]; then
      echo "未读取到 Oracle JDK 官方 SHA-256 校验值。" >&2
      exit 1
    fi
    verify_sha256 "$expected_java_sha256" "$java_archive"

    tar -xzf "$java_archive" -C "$task_tmpdir"
    for candidate in "$task_tmpdir"/*.jdk; do
      if [ -x "$candidate/Contents/Home/bin/java" ]; then
        java_bundle=$candidate
        break
      fi
    done
    if [ -z "$java_bundle" ]; then
      echo "Oracle JDK 压缩包中没有可用的 .jdk 包。" >&2
      exit 1
    fi

    java_bundle_name=$(basename "$java_bundle")
    mv "$java_bundle" "$runtime_root/$java_bundle_name"
    java_bundle="$runtime_root/$java_bundle_name"
    rm -rf "$task_tmpdir"
    trap - EXIT HUP INT TERM
  fi

  if [ -e "$java_home" ] || [ -L "$java_home" ]; then
    echo "发现不可用的项目本地 Java 入口：$java_home。请先手动检查后再重新准备。" >&2
    exit 1
  fi
  ln -s "$(basename "$java_bundle")" "$java_home"
fi

"$node_home/bin/node" --version
"$java_home/Contents/Home/bin/java" --version
