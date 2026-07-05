# Integrated Terminal

Встроенный терминал (аналог integrated terminal в VS Code): панель, в которой крутится
интерактивный шелл. Статус: **спайк/песочница** (см. `src/demos/terminal/`), не интегрировано
в приложение.

## Архитектура — однопанельный in-process tmux

Настоящий терминал = связка «реальный PTY + VT-эмулятор + рендер». Мы собираем то же, что делает
tmux-сервер, но в одном процессе:

| tmux | Vexx |
|---|---|
| `forkpty()` + master fd — ядро выдаёт настоящий TTY (`isatty`, job control, сигналы) | **node-pty** (`pty.spawn`) |
| per-pane VT-эмулятор (`grid`) — парсит вывод программы в сетку ячеек | **@xterm/headless** (`Terminal`, читаем `terminal.buffer.active`) |
| сервер считает дифф экрана → клиент рисует | `TerminalViewElement` → `RenderContext.setCell` → наш double-buffer `TerminalRenderer` |
| клиент шлёт клавиши в master PTY | key-энкодер → `pty.write` |
| `ioctl(TIOCSWINSZ)` + SIGWINCH при ресайзе | `pty.resize()` в `performLayout` контрола |

В контроле реализовано: ввод (энкодер клавиш), **мышь** (проброс в `coreMouseService`
эмулятора — работает в htop/vim/tmux, когда программа включила mouse-tracking), цвета
(truecolor/palette/default), стили, wide-chars, курсор, ресайз. Важный нюанс: `term.write()`
асинхронный — `emitUpdate` дёргается в его колбэке, иначе картинка отстаёт на одно событие.

Интерактивность берётся из **реального PTY** (ядро), а не из либы. Поэтому нативность node-pty
неизбежна: PTY — объект ядра (`posix_openpt`/`forkpty`), доступен только нативным кодом. Чисто-JS
пути нет (хаки через системный `script`/`socat` непортабельны — отвергнуты). @xterm/headless, наоборот,
чистый JS без нативного кода.

## Решение по упаковке (ADR) — embed + runtime-extract

node-pty на Unix — это `pty.node` (нативный аддон) + бинарь `spawn-helper`. Для single-executable
(`build:sea`) вопрос не «нативный ли», а «как везём нативные файлы».

**Зафиксировано и реализовано в спайке: embed + runtime-extract.** Нативные артефакты вшиваются
в SEA как ассет `node-pty.bundle` (тот же формат, что `vexx.bundle` — magic+header+data, см.
`Common/Assets/` и `scripts/pack-assets.mjs`); на первом запуске распаковываются в
`os.tmpdir()/vexx-embedded-pty-<size>/` и грузятся через `createRequire` (нативный `.node` требует
файл на диске для `process.dlopen`). Сохраняет модель «один файл» ценой записи в tmp на первом
запуске; повторные запуски переиспользуют распакованное (маркер `.vexx-ready`).

Реализация в спайке:
- `src/demos/terminal/loadNodePty.ts` — dev: `require("node-pty")`; SEA: `sea.getAsset` → распаковка → `createRequire`.
- `scripts/build-terminal-sea.mjs` (`npm run build:sea:terminal`) — esbuild бандлит demo (`@xterm/headless`
  внутрь, `node-pty` external), пакует рантайм-раскладку node-pty в ассет, `node --build-sea`.
  Выход — один бинарь `dist-terminal/vexx-terminal`.
- Проверено на linux-x64: `spawn-helper` не нужен (guard `__APPLE__` в `pty.cc`), достаточно
  `build/Release/pty.node` + `lib/**` + `package.json`.

Альтернативы (для протокола):
- **Sidecar** (как VS Code — нативные файлы рядом с бинарём): надёжно, но ломает «один файл».
- Компиляция на install отвергнута в пользу prebuilt: под платформы берём бинарники CI-матрицей
  либо prebuilt-форком `@homebridge/node-pty-prebuilt-multiarch` (уже предложен в `E2E.md`).

## Как запустить / проверить

- **dev** (быстрее итерировать): `npm run demo:terminal` — `tsx`, node-pty/@xterm/headless из node_modules.
- **SEA** (один бинарь): `npm run build:sea:terminal` → `./dist-terminal/vexx-terminal`.
- Управление в демо: кнопки Send ls / Clear / Narrower / Wider / Quit; Ctrl+Q — выйти из демо; Ctrl+C уходит в шелл.
- Проверялось headless PTY-харнессом (спавн через node-pty, парсинг внешнего экрана нашим
  `e2e/helpers/AnsiScreen.ts`): тулбар/панель, интерактивный шелл, цвета/стили, клик мышью по кнопке,
  ресайз окна, распаковка нативного PTY в tmp на первом запуске + переиспользование, чистый выход.

## Кросс-платформенность и тестирование

Спайк проверен **только на linux-x64**. Риск делится на две части:

**Переносимо «бесплатно» (чистый JS, одинаково везде):** @xterm/headless (эмуляция, буфер,
mouse-энкодер), наш рендер/цвета/стили/wide-chars/курсор, `encodeKeyForPty`, проброс мыши,
механизм распаковки (`os.tmpdir()` + `createRequire`; `chmod +x` на Windows — безвредный no-op).

**Требует работы и проверки на целевой ОС — PTY и упаковка:**
- **SEA пер-платформенный по природе** — нативный код вшивается под конкретную ОС/арх; билд гоняется
  на каждой цели (CI-матрица `ubuntu/macos/windows`), кросс-компиляции у Node SEA нет.
- **Упаковщик сейчас linux-only** (`scripts/build-terminal-sea.mjs` берёт только `build/Release/*`).
  Нужный набор нативных файлов различается:
  - **macOS**: `pty.node` **+ `spawn-helper`** (на Mac реально используется — guard `__APPLE__`), лежит в
    `prebuilds/darwin-<arch>/`. Экстрактор уже ставит `+x` на `spawn-helper`, но упаковщик его не берёт.
    Плюс нужен **codesign** (в основном `build-sea.mjs` он есть, в терминальном скрипте — нет).
  - **Windows**: ConPTY — комплект, а не один файл: `pty.node`, `conpty.node`, `conpty.dll`,
    `conpty_console_list.node`, `winpty-agent.exe`, `winpty.dll` + папка `conpty/` (`OpenConsole.exe`,
    `conpty.dll`) — всё в `prebuilds/win32-<arch>/`.
- **Рантайм node-pty отличается:**
  - **дефолтный шелл**: сейчас `SHELL ?? "bash"` — на Windows `SHELL` пуст → упадёт; нужно
    `win32 → COMSPEC/powershell`.
  - **ConPTY-причуды** (уже задокументированы в `e2e/helpers/runVexx.ts`): инъекции очищающих
    последовательностей при resize, `onExit` может не срабатывать, иной kill — проверить resize-путь на Win.
  - мелочи: Backspace `\x7f` vs `\b` на cmd.

**Как тестировать без своего Mac:** вся верификация **headless-драйвится** (PTY-харнесс на `AnsiScreen`,
без GUI), поэтому те же проверки один-в-один переносятся на **GitHub Actions `macos-latest`** (реальное
Apple-железо, лицензионно чисто; Apple Silicon). Локальная Mac-VM на Windows — нельзя (Apple SLA + x86 не
виртуализирует Apple Silicon). Для «пощупать руками» — почасовая аренда реального Mac (AWS EC2 Mac,
Scaleway, MacStadium, MacinCloud). Windows тестируется локально (`prebuilds/win32-x64` подтянется на install).

## Ключевые технические выводы (сводка)

- Настоящий PTY невозможен без нативного кода (объект ядра); tmux — тот же паттерн на C.
  Выбор не «нативный/нет», а «как упаковать нативное».
- xterm truecolor `getFgColor()` = уже `0xRRGGBB` (= наш `packRgb`); default = `-1` (= `DEFAULT_COLOR`);
  palette = индекс → таблица `xtermPalette.ts`. `isBold()` и т.п. возвращают число (по truthiness).
- `@xterm/headless` — CJS: под нативным ESM-загрузчиком (tsx/esm) named-import **не работает** в
  рантайме → default-import значения + `import type` для типов.
- **`term.write()` асинхронный** → `emitUpdate` только в его колбэке (иначе лаг на одно событие).
- Мышь — через приватный `terminal._core.coreMouseService.triggerMouseEvent(...)`: сам решает по
  активному режиму программы и кодирует (X10/SGR) → уходит в PTY через `term.onData`.
- linux-x64: `spawn-helper` не нужен (guard `__APPLE__`); node-addon-api — build-time, в рантайме не тянется.

## Дальнейшие шаги (после спайка)
- Кросс-платформенная упаковка: упаковщик берёт `build/Release/*` **и** `prebuilds/<platform>-<arch>/*`
  (spawn-helper для macOS; ConPTY-набор для Windows) + codesign-шаг для macOS в терминальном скрипте.
- Выбор дефолтного шелла по ОС (`win32 → COMSPEC/powershell`).
- GitHub Actions workflow (матрица `ubuntu/macos/windows`): сборка SEA + прогон headless-харнесса.
- Перенести embed+extract из демо в основной `scripts/build-sea.mjs` при интеграции терминала в приложение.
- Перенести контрол из `src/demos/terminal/` в подходящий слой (виджет TUIDom рендерит из абстрактной
  cell-модели; PTY/эмулятор-glue — уровнем выше), спроектировать `TerminalController` и панель.
- Скролбэк/выделение/копирование, ссылки, bracketed-paste в шелл, реакция на смену темы (палитра).
