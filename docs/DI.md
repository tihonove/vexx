# DI-контейнер

Реализация: `src/Common/DiContainer.ts`.

Строго типизированный DI-контейнер на основе токенов. Без декораторов, без reflect-metadata, работает с `--erasableSyntaxOnly` / strip types.

## Основные примитивы

- `Token<T>` — типизированный ключ для сервиса
- `token<T>(id)` — фабрика токенов
- `Injectable<T, Deps>` — тип класса со `static dependencies`
- `Container` — контейнер с lazy singleton resolution

## Именование токенов

Все DI-токены именуются по конвенции `{ServiceName}DIToken`:

- `EditorControllerDIToken` — токен для `EditorController`
- `TuiApplicationDIToken` — токен для `TuiApplication`
- `AppControllerDIToken` — токен для `AppController`

Не используем префикс `I` (как `IEditorCtrl`) — только суффикс `DIToken`.

## Где объявлять токены

DI-токены и зависимости (`static dependencies`) объявляются **только на уровнях Controllers и App**. Слои ниже (Editor, TUIDom, Input, Rendering, Backend) не должны импортировать `Container`, `token()` или `Token` и не должны объявлять DI-токены.

`Common/DiContainer.ts` реализует механизм DI, но конкретные токены в Common/ не объявляются.

## Объявление токенов

Токены объявляются рядом с реализацией сервиса в Controllers/:

```typescript
import { token } from "../Common/DiContainer.ts";

export const EditorControllerDIToken = token<EditorController>("EditorController");
```

## Объявление зависимостей в классе

Класс объявляет `static dependencies` — кортеж токенов, соответствующий параметрам конструктора.
Компилятор проверяет, что типы токенов совпадают с типами параметров:

```typescript
import { TuiApplicationDIToken } from "./CoreTokens.ts";
import { EditorControllerDIToken } from "./EditorController.ts";

export class AppController extends Disposable {
    static dependencies = [TuiApplicationDIToken, EditorControllerDIToken] as const;

    constructor(app: TuiApplication, editorCtrl: EditorController) {
        super();
        // ...
    }
}
```

Если зависимостей нет:

```typescript
export class EditorController extends Disposable {
    static dependencies = [] as const;

    constructor() {
        super();
    }
}
```

## Регистрация в контейнере

Контейнер конфигурируется в точке входа (`main.ts`). Одна строка на сервис:

```typescript
import { Container } from "./Common/DiContainer.ts";

const container = new Container()
    .bind(TuiApplicationDIToken, () => application)          // фабрика для leaf-сервисов
    .bind(EditorControllerDIToken, EditorController)         // класс — deps из static dependencies
    .bind(AppControllerDIToken, AppController);

const appCtrl = container.get(AppControllerDIToken);
```

Два варианта `.bind()`:
- **Класс** — `bind(token, Class)` — контейнер читает `Class.dependencies` и резолвит автоматически
- **Фабрика** — `bind(token, () => value)` — произвольная логика создания

## Что проверяет компилятор

При `bind(token, Class)` TypeScript проверяет:
- Тип `Token<T>` совпадает с типом экземпляра класса
- Массив `static dependencies` соответствует параметрам конструктора: количество, порядок, типы

Ошибка компиляции если:
- Перепутан порядок зависимостей
- Пропущена или лишняя зависимость  
- Тип токена не совпадает с типом параметра
- Токен привязан к классу неправильного типа

## Что проверяется в рантайме

- Отсутствие биндинга → `Error: No binding for "ServiceName"`
- Циклическая зависимость → `Error: Circular dependency detected: A → B → A`

## Singleton-семантика

Все биндинги — lazy singletons. Первый вызов `get(token)` создаёт экземпляр, последующие возвращают кешированный.

## Прямое создание без контейнера

Классы остаются plain — `static dependencies` не влияет на конструктор.
В тестах можно создавать экземпляры напрямую:

```typescript
const ctrl = new AppController(mockApp, mockEditor);
```

## Модули и профили

Чтобы избежать копипасты конфигурации в каждой точке входа (`main.ts`, тесты,
демо), биндинги группируются в **модули** — функции вида
`(container, ctx) => void`. Модули собираются в **профили** — фабрики готовых
контейнеров под конкретный сценарий (production, test).

Файлы: `src/Controllers/Modules/`.

### `ContainerModule<Ctx>`

```typescript
export type ContainerModule<Ctx = void> = (container: Container, ctx: Ctx) => void;
```

Модуль регистрирует группу связанных по смыслу сервисов. Опциональный `Ctx` —
типизированный конфиг (например, `{ theme }` или `{ clipboard }`). Применяется
через `.use()`:

```typescript
const container = new Container()
    .use(coreModule, { app })
    .use(commandsModule)
    .use(themeModule, { theme })
    .use(controllersModule);
```

`.use()` возвращает контейнер — его можно чейнить с обычным `.bind()`.

### Существующие модули

| Модуль | Контекст | Что регистрирует |
|--------|----------|------------------|
| `coreModule` | `{ app }` | `ServiceAccessor`, `TuiApplication` |
| `coreModuleLate` | — | Только `ServiceAccessor`. Для тестов, где `TuiApplication` создаётся позже от view контроллера. |
| `commandsModule` | — | `CommandRegistry`, `KeybindingRegistry`, `ContextKeyService` |
| `themeModule` | `{ theme }` | `ThemeService` |
| `tokenizationModule` | `{ tokenizationRegistry, tokenStyleResolver, languageService }` | Соответствующие токены. Реализации передаются снаружи. |
| `backendModule` | `{ clipboard }` | `Clipboard` |
| `backendModuleDefault` | — | `Clipboard` с `InMemoryClipboard` по умолчанию |
| `controllersModule` | — | `EditorGroupController`, `StatusBarController`, `AppController` |

### Профили

- **`createProductionContainer(ctx)`** — собирает полный production-контейнер
  с реальными tokenization/language. Используется в `main.ts`.
- **`createTestContainer()`** — возвращает `{ container, bindApp }`. Использует
  `darkPlusTheme`, `NULL_TOKEN_STYLE_RESOLVER`, `NULL_LANGUAGE_SERVICE` и пустой
  `TokenizationRegistry`. `bindApp(testApp.app)` вызывается после создания
  `TestApp` от view, чтобы поздно забиндить `TuiApplicationDIToken`.

Шаблон тестовой обёртки:

```typescript
const { container, bindApp } = createTestContainer();
const controller = container.get(AppControllerDIToken);
controller.mount();

const testApp = TestApp.create(controller.view, size);
bindApp(testApp.app);
```

### Когда добавлять новый модуль

- Появляется набор из 2+ связанных сервисов одного домена.
- Новая ось вариативности (например, `Filesystem` с реальной/мок-реализацией) —
  заводим модуль с `Ctx` и подставляем разные значения в профилях.

Не нужно делать модуль для одиночного сервиса без вариативности — достаточно
`.bind()` в профиле.

