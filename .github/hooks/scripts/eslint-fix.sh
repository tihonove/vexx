#!/bin/bash
set -euo pipefail

INPUT="$(cat)"

TOOL_NAME="$(echo "$INPUT" | jq -r '.toolName // empty')"

# Реагируем только на инструменты редактирования файлов
case "$TOOL_NAME" in
  edit_file|create_file|apply_diff|write_file|replace_string_in_file|create_and_apply_diff)
    ;;
  *)
    exit 0
    ;;
esac

TOOL_ARGS_RAW="$(echo "$INPUT" | jq -r '.toolArgs // empty')"

# Пробуем извлечь путь файла из аргументов
FILE_PATH="$(echo "$TOOL_ARGS_RAW" | jq -r '.filePath // .path // .file // empty' 2>/dev/null || true)"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Запускаем eslint --fix только для .ts/.tsx файлов из src/
if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  npx eslint --fix "$FILE_PATH" 2>/dev/null || true
fi
