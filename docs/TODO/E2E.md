# E2E и Inspector-протокол

## Phase 1 — [x] E2E против собранного SEA-бинаря

- [x] Сделано: `vitest.e2e.config.ts` + `npm run test:e2e`; helpers (`buildOnce`, `VexxSession` поверх `node-pty`, `AnsiScreen`-парсер); сьюты `sea-startup` / `sea-assets` / `sea-extensions` — см. `e2e/`. Покрыт и Phase 8 self-spawn: грамматика user-расширения, негативный кейс без `--user-data-dir`, subprocess через `exports.activate()` с проставлением `tabSize` по RPC.

**Открыто (Phase 1.x):**
- [ ] CI: документировать build-essential / python3 для нативной сборки `node-pty`. Возможна замена на `@homebridge/node-pty-prebuilt-multiarch` при проблемах.
- [ ] Расширить кейсы: открытие директории как workspace + проверка, что fixture виден в файловом дереве.
- [ ] Снять зависимость от точной фразы из комментария (`fixture used`) — заменить на стабильный маркер в фикстуре.
- [ ] **e2e-cross-platform**: `renders fixture text on screen` и `applies syntax highlighting` пропускаются на Windows и macOS. На Windows ConPTY инжектирует `CSI K` / clearing sequences после resize, стирая строки которые рендерер уже вывел; `stdout.on("resize")` внутри ConPTY-процесса ненадёжен → delta-рендерер не знает что нужен полный redraw. Нужно либо добавить в `NodeTerminalBackend` принудительный механизм полного сброса при потере синхронизации (watchdog по неизменному грид-хешу?), либо перейти на Inspector-протокол (Phase 2) для e2e вместо PTY-парсинга.

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
