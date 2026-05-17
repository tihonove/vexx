# Logging & Diagnostics

Подсистема логирования по модели VS Code: `ILogService` + `ILogger` per channel, fan-out по `ILogSink`.
Цель — единое место для диагностики всех подсистем (bootstrap, configuration, extensions, extension host, editor, …) с последующим UI типа Output-вкладки.

См. также: `src/Common/Logging/`, раздел **Common/Logging/** в [ARCHITECTURE.md](../ARCHITECTURE.md).

## План по фазам

- [x] **Phase 1 — Infrastructure**
  `LogLevel`, `ILogger`, `ILogService`, `LogService`, `NullLogService`, `RingBufferSink`, `FileSink` + полное тестовое покрытие.

- [x] **Phase 2 — DI + Bootstrap**
  Токен `ILogServiceDIToken`, модули `loggingModule` / `loggingModuleDefault`. В `main.ts`:
  поднять `LogService`, всегда добавить `RingBufferSink`, добавить `FileSink(./vexx.log, truncate)` только при `!isSeaBinary()`,
  пробросить `logService` в Production-профиль; Test-профиль использует `NULL_LOG_SERVICE`.

- [x] **Phase 3 — console.* migration (runtime)**
  Заменить `console.warn/error` в `mergeExtensions`, `ConfigurationService`, `ExtensionScanner`, `ExtensionTokenizationContributor`, активация расширений в `main.ts` на каналы
  `extensions` / `configuration`. CLI-ветка до bootstrap (parse args / usage) намеренно оставлена на `console`.

- [x] **Phase 3.5 — Extension host RPC tracing**
  `RpcEndpoint` принимает опциональный `ILogger` и трейсит каждое отправленное/полученное сообщение (`-> req#N`, `<- res#N`, `-> notif`, `<- notif`).
  `ExtensionHost` берёт из DI каналы `extensions.host` (lifecycle), `extensions.host.rpc`, `extensions.host.stdout`, `extensions.host.stderr`.
  При наличии stdout/stderr-логгеров stdio subprocess'а переключается с `"inherit"` на `"pipe"` и форвардится в каналы построчно — `console.log` внутри расширения больше не ломает альтернативный экран.

- [ ] **Phase 4 — Output UI**
  TUI-виджет (вкладка/панель) поверх `RingBufferSink`: список каналов, live-tail через `onDidAppend`, фильтры по уровню/каналу,
  clear/scroll. Контроллер — `OutputController` (Controllers/), читает sink через DI.

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
