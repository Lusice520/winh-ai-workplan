#!/bin/sh
# Persistent local integration service. No production authentication or S3 policy guarantees.
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
runtime_root=${PROJECT_LOCAL_TOOLS_DIR:-"$project_root/.local-tools"}
s3_jar="$runtime_root/s3mock/s3mock-5.2.2-exec.jar"
mkdir -p "$runtime_root/s3mock" "$project_root/.local-data/s3mock"
if [ ! -f "$s3_jar" ]; then
  curl --fail --location --retry 2 --output "$s3_jar" https://repo.maven.apache.org/maven2/com/adobe/testing/s3mock/5.2.2/s3mock-5.2.2-exec.jar
fi
actual_digest=$(shasum -a 256 "$s3_jar" | cut -d ' ' -f 1)
if [ "$actual_digest" != "a654fb129caa7fbabb9ae8c2b84f0408dfe0fdd69821492c1622a08bbee73553" ]; then
  echo "S3 本地测试服务校验失败，请检查下载文件。" >&2
  exit 1
fi
# S3Mock 5.2.2's additional HTTP Connector only sets its port. The standard
# server.address property applies to the primary connector, so bind the additional
# bean explicitly. Use libraries from the already checksum-verified local JAR.
s3_loopback_lib="$runtime_root/s3mock/loopback-lib"
s3_loopback_classes="$runtime_root/s3mock/loopback-classes"
mkdir -p "$s3_loopback_lib" "$s3_loopback_classes"
unzip -jo "$s3_jar" 'BOOT-INF/lib/spring-context-*.jar' \
  'BOOT-INF/lib/spring-core-*.jar' 'BOOT-INF/lib/spring-beans-*.jar' \
  'BOOT-INF/lib/tomcat-embed-core-*.jar' -d "$s3_loopback_lib" >/dev/null
"$project_root/scripts/development/local-runtime.sh" --java -- javac \
  -classpath "$s3_loopback_lib/*" -d "$s3_loopback_classes" \
  "$project_root/scripts/development/java/LocalS3LoopbackInitializer.java"
mkdir -p "$s3_loopback_classes/META-INF"
cp "$project_root/scripts/development/java/s3mock-spring.factories" "$s3_loopback_classes/META-INF/spring.factories"
echo "启动仅供本地开发的 S3 验证服务，监听 127.0.0.1:9090；退出后保留合成文件。"
exec "$project_root/scripts/development/local-runtime.sh" --java -- java \
  -Dloader.path="$s3_loopback_classes" \
  -classpath "$s3_jar" org.springframework.boot.loader.launch.PropertiesLauncher \
  --server.address=127.0.0.1 --http.port=9090 --server.port=9191 \
  --com.adobe.testing.s3mock.store.root="$project_root/.local-data/s3mock" \
  --com.adobe.testing.s3mock.store.initial-buckets=winh-project-files \
  --com.adobe.testing.s3mock.store.retain-files-on-exit=true \
  --com.adobe.testing.s3mock.max-payload-size=22MB
