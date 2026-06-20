# E2E и Inspector-протокол

## Phase 1 — [x] E2E против собранного SEA-бинаря

- [x] Сделано: `vitest.e2e.config.ts` + `npm run test:e2e`; helpers (`buildOnce`, `VexxSession` поверх `node-pty`, `AnsiScreen`-парсер); сьюты `sea-startup` / `sea-assets` / `sea-extensions` — см. `e2e/`. Покрыт и Phase 8 self-spawn: грамматика user-расширения, негативный кейс без `--user-data-dir`, subprocess через `exports.activate()` с проставлением `tabSize` по RPC.

**Открыто (Phase 1.x):**
- [ ] CI: документировать build-essential / python3 для нативной сборки `node-pty`. Возможна замена на `@homebridge/node-pty-prebuilt-multiarch` при проблемах.
- [ ] Расширить кейсы: открытие директории как workspace + проверка, что fixture виден в файловом дереве.
- [ ] Снять зависимость от точной фразы из комментария (`fixture used`) — заменить на стабильный маркер в фикстуре.
- [ ] **e2e-cross-platform**: `renders fixture text on screen` и `applies syntax highlighting` пропускаются на Windows и macOS. На Windows ConPTY инжектирует `CSI K` / clearing sequences после resize, стирая строки которые рендерер уже вывел; `stdout.on("resize")` внутри ConPTY-процесса ненадёжен → delta-рендерер не знает что нужен полный redraw. Нужно либо добавить в `NodeTerminalBackend` принудительный механизм полного сброса при потере синхронизации (watchdog по неизменному грид-хешу?), либо перейти на Inspector-протокол (Phase 2) для e2e вместо PTY-парсинга.

## Phase 2 — Inspector-протокол

Вынесено в отдельный документ: [Inspector.md](Inspector.md) — там же подготовительный рефакторинг TUIElement-иерархии и выделение основы приложения, на которой поднимается порт инспектора.

## Команды
```bash
npm run build:sea      # собрать dist/vexx
npm run test:e2e       # e2e тесты против бинаря
npm test               # обычные unit-тесты (e2e не запускаются)
```
