# E2E и Inspector-протокол

## Phase 1 — E2E против собранного SEA-бинаря

**Сделано:**
- `vitest.e2e.config.ts` — отдельный конфиг (testTimeout 60s, hookTimeout 180s, без coverage, `fileParallelism: false`).
- `npm run test:e2e` — запуск e2e отдельно от `npm test`.
- `e2e/helpers/buildOnce.ts` — лениво и единожды собирает SEA-бинарь (`npm run build:sea`).
- `e2e/helpers/runVexx.ts` — `VexxSession` поверх `node-pty` (`waitFor`, `dispose` с Ctrl+C → SIGTERM → SIGKILL).
- `e2e/helpers/AnsiScreen.ts` — минимальный ANSI-парсер ровно под то, что эмитит `TerminalRenderer` + `NodeTerminalBackend.renderFrame` (CUP, SGR truecolor, DEC private modes, 2J).
- `e2e/fixtures/sample.ts` — короткий TS-файл с комментарием, `const`, числом и строкой.
- `e2e/sea-startup.test.ts` — три кейса: boot+чистый выход, текст файла, цвета токенов из Dark+ (KEYWORD_FG, COMMENT_FG, NUMBER_FG).
- `node-pty` добавлен в `devDependencies`.

**Открыто (Phase 1.x):**
- [ ] CI: документировать build-essential / python3 для нативной сборки `node-pty`. Возможна замена на `@homebridge/node-pty-prebuilt-multiarch` при проблемах.
- [ ] Расширить кейсы: открытие директории как workspace + проверка, что fixture виден в файловом дереве.
- [ ] Снять зависимость от точной фразы из комментария (`fixture used`) — заменить на стабильный маркер в фикстуре.

## Phase 2 — Inspector-протокол (draft)

Цель: «как в браузере с дебажным портом» — отдельный сервер на бинаре по флагу `--inspect-tui[=host:port]`, который умеет отдавать дерево `TUIElement`, текущий грид и стримить события.

**План:**
- [ ] Новый слой `src/Inspector/` (зависит от TUIDom + Common; обратной зависимости нет).
- [ ] Парсинг CLI-флага `--inspect-tui` в `src/main.ts` — старт `InspectorServer` до `app.run()`.
- [ ] `InspectorServer`: голый WebSocket поверх `node:http` upgrade (рукописный RFC6455 frame parser, без зависимостей).
- [ ] JSON-RPC 2.0 namespace `TUIDom.*`:
    - `TUIDom.getDocument` → дерево `{ id, type, box, style, focus, text? }`
    - `TUIDom.getGridSnapshot` → плоский `{ width, height, cells: [{char,fg,bg}] }`
    - `TUIDom.subscribe` (events `nodeAdded` / `nodeRemoved` / `attributeChanged` / `renderTick` / `input`)
    - `TUIDom.dispatchInput { keys: "Ctrl+P" }` — удалённое управление
- [ ] Хуки в `TuiApplication`: `onAfterRenderFrame`, `onTreeMutation` — без жёсткой связи с Inspector.
- [ ] CLI-клиент `npm run inspect`: самохост на TUIDom, дерево слева + грид справа, hot-keys для подсветки bbox элемента.
- [ ] Обновить `docs/ARCHITECTURE.md` (раздел `Inspector/`, диаграмма зависимостей).
- [ ] Web-клиент — отдельная фаза 2.2, не сейчас.

## Команды
```bash
npm run build:sea      # собрать dist/vexx
npm run test:e2e       # e2e тесты против бинаря
npm test               # обычные unit-тесты (e2e не запускаются)
```
