# Backend/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

Абстракция терминального I/O. Определяет интерфейс бэкенда (onInput, onResize, flush, setup, teardown) и три реализации: реальную `NodeTerminalBackend` (Node.js stdin/stdout, Kitty protocol, alternate screen), in-memory `MockTerminalBackend` для тестов (sendKey DSL, screenToString) и `HeadlessCaptureBackend` для `--headless`-режима.

`HeadlessCaptureBackend` — реальное приложение без реального терминала: `setup`/`teardown` — no-op, в stdout ничего не пишет, а `renderFrame` захватывает кадр в `GridSnapshot` (`Rendering/GridSnapshot.ts`) вместо ANSI. Ввод инъектируется тем же путём, что и в `MockTerminalBackend` (через `KeyInputParser` + `serializeKey`), поэтому приложение видит байт-в-байт те же `KeyPressEvent`, что и от терминала. Драйвит `--headless`: инспектор экспонирует `sendKey`/`sendText`/`captureFrame` (см. [Inspector.md](Inspector.md)), чтобы клиент скриптовал редактор и читал экран для рендера в картинку.
