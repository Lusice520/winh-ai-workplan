#!/bin/sh
# Explicit local synthetic-storage profile. Never used for shared or production deployment.
set -eu
task_project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
exec env FILE_S3_ENDPOINT=http://127.0.0.1:9090 \
  FILE_S3_ACCESS_KEY=local-test-only FILE_S3_SECRET_KEY=local-test-only \
  "$task_project_root/scripts/development/local-runtime.sh" --java -- \
  "$task_project_root/apps/backend/mvnw" -f "$task_project_root/apps/backend/pom.xml" spring-boot:run
