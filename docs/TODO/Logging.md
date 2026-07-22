# Logging & Diagnostics

Подсистема логирования по модели VS Code: `ILogService` + `ILogger` per channel, fan-out по `ILogSink`.
Цель — единое место для диагностики всех подсистем (bootstrap, configuration, extensions, extension host, editor, …) с последующим UI типа Output-вкладки.

Готовое (инфраструктура, DI/bootstrap, миграция `console.*`, RPC-трейсинг extension host — Phases 1–3.5) описано в разделе **Common/Logging/** в [arch/Common.md](../arch/Common.md). Ниже — открытые фазы.

## Открытые фазы

- [ ] **Phase 4 — Output UI**
  Вкладка OUTPUT в нижней Panel с выбором подсистемы (канала). Сверка с VS Code
  (`contrib/output/`) показала три вещи, которые стоит повторить, а не изобретать:
  контент — **read-only редактор** над моделью с языком `log`, а не свой виджет;
  каналы — реестр дескрипторов `{ id, label }` (аналог `IOutputChannelRegistry`),
  а не сырые имена логгеров; селектор — submenu `MenuId.ViewTitle` с
  `isSelection`, который рендерится как SelectBox.
  Блокер: **detached pane** — редактор вне таб-строки (см.
  [ReadonlyEditor.md](ReadonlyEditor.md), этап 2). Сам флаг read-only уже готов.

- [ ] **Phase 5 — Extension Host inner tracing**
  Внутри subprocess: пробросить `ILogger` в его `RpcEndpoint` (например, через стартовый `host.setLogLevel`-handshake), чтобы видеть исполнение handler'ов с той стороны.
  Патч `console.*` внутри subprocess → IPC сообщение `host.log`, родитель кладёт в канал `extensions.host.<extensionId>`. Сейчас console.* в subprocess летит в pipe stdout/stderr и попадает в каналы `.stdout`/`.stderr` без атрибуции расширению.

- [ ] **Phase 6 — CLI flags**
  `--log-level=<channel>=<level>` (repeatable, `*=info` по умолчанию), `--log-file=<path>`, `--no-log-file`.
  Парсинг в `CliArgs`, применение до создания sinks.

- [ ] **Phase 7 — Public API для расширений**
  `vscode.window.createOutputChannel(name)` → обёртка над `createLogger("extensions.<extId>.<name>")`. `OutputChannel.show()` —
  открывает Output UI и подсвечивает соответствующий канал.

## Принципы

- **Никаких прямых `console.*` в runtime** (после bootstrap-CLI). Тесты/explore — исключение.
- **Sinks не должны бросать**: ошибки логируются в `process.stderr` (если возможно) и проглатываются.
- **DEFAULT_LEVEL = Trace** — пока активная разработка, хочется видеть всё. Перед релизом снизить до Info через `setLevel("*", Info)`.
- **Channel naming**: `<area>` или `<area>.<sub>`; для расширений — `extensions.<id>`.
