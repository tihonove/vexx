# DI-контейнер

Реализация: `src/Common/DiContainer.ts`.

Строго типизированный DI-контейнер на основе токенов. Без декораторов, без reflect-metadata, работает с `--erasableSyntaxOnly` / strip types.

## Основные примитивы

- `Token<T>` — типизированный ключ для сервиса
- `token<T>(id)` — фабрика токенов
- `Injectable<T, Deps>` — тип класса со `static dependencies`
- `Container` — контейнер с lazy singleton resolution

## Объявление токенов

Токены объявляются рядом с интерфейсом или реализацией сервиса:

```typescript
import { token } from "../Common/DiContainer.ts";

export const IEditorCtrl = token<EditorController>("EditorCtrl");
```

## Объявление зависимостей в классе

Класс объявляет `static dependencies` — кортеж токенов, соответствующий параметрам конструктора.
Компилятор проверяет, что типы токенов совпадают с типами параметров:

```typescript
import { IApp } from "./tokens.ts";

export class AppController extends Disposable {
    static dependencies = [IApp, IEditorCtrl] as const;

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
    .bind(IBackend,    () => new NodeTerminalBackend()) // фабрика для leaf-сервисов
    .bind(IApp,        TuiApplication)                  // класс — deps из static dependencies
    .bind(IEditorCtrl, EditorController)
    .bind(IAppCtrl,    AppController);

const appCtrl = container.get(IAppCtrl);
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
