Vexx — терминальный текстовый редактор (клон VS Code) на TypeScript/Node.js. Цели и неизменяемые ограничения — в GOAL.md, не забывай его читать.

# Карта документации
- GOAL.md — цели проекта и non-negotiable constraints
- docs/ARCHITECTURE.md — слои, каталоги src/, правила зависимостей (единственный источник правды)
- docs/DI.md — справочник по DI-контейнеру (токены, модули, профили)
- docs/LAYOUT.md — система layout и позиционирования в TUIDom
- docs/TESTING.md — как тестировать каждый слой; скриншот-демо для визуальных фич
- docs/TODO/ — трекер задач (индекс — README.md)

# Трекер задач
Текущие задачи и планы ведём в docs/TODO/. Индекс — docs/TODO/README.md, крупные задачи — в отдельных файлах.
Когда берёшь задачу в работу, поменяй статус на `[~]`. Когда закончил — на `[x]`.

# Worktree
Любую задачу, которую мы начинаем с этапа планирования, ведём в отдельном git worktree — заходи в него через инструмент EnterWorktree до начала работы. Исключение одно: если пользователь явно сказал не использовать worktree для этой задачи.

# Архитектура
Перед началом работы прочитай docs/ARCHITECTURE.md — там описана структура каталогов, слои и правила зависимостей.
Если ты перемещаешь файлы, добавляешь новые каталоги или меняешь зависимости между слоями — обнови docs/ARCHITECTURE.md.

# Style
Не запускай и не исправляй ошибки линтера. Просто не забывай использовать расширения в имени файла при импорте
Приватные переменные давай не будем писать с подчеркиванием. Используй просто название и модификатор

# Коммиты
Используем Conventional Commits: `type(scope): subject`. Это напрямую влияет на релизный changelog — он собирается из истории через git-cliff (конфиг — `cliff.toml`).

Тип коммита решает, попадёт ли он в changelog. Главное правило: `feat`/`fix`/`perf` — **только** для поведения редактора, видимого пользователю. Любая инфраструктура (изменения в `.github/`, `.vscode/`, workflow-ах, конфигах, билд-скриптах, тестах) идёт под инфраструктурные типы и в changelog не попадает.

**Попадает в changelog (пользовательское):**
- `feat` — новая функциональность редактора
- `fix` — исправление поведения редактора
- `perf` — заметное ускорение
- ломающее изменение — суффикс `!` (`feat!:`, `refactor!:`) или футер `BREAKING CHANGE:` → секция Breaking Changes
- фикс безопасности — упомяни «security» в теле коммита → секция Security

**Скрыто из changelog (инфраструктура/внутреннее):** `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `style`, `revert`. Значимый рефакторинг в changelog не показывается — кроме случая, когда он ломающий (`refactor!:`).

`fix` — это исправление **бага в поведении редактора, который замечает пользователь**. Это НЕ:
- правки линта, форматирования, порядка импортов, опечаток в коде → `style`
- починка тестов, конфигов, CI, сборки → `test` / `chore` / `ci` / `build`
- переименования и внутренняя реорганизация без изменения поведения → `refactor`

Формат subject: императив, нижний регистр, без точки в конце. Для `feat`/`fix` subject описывает пользовательский эффект, а не внутреннюю реализацию.

Примеры «было → стало»:
- `feat: enhance test coverage reporting` → `test: enhance coverage reporting` (это про тесты, не про редактор)
- `fix: correct Bash command syntax in settings.json` → `chore: correct Bash command syntax in settings.json` (это конфиг)
- `fix: update nightly release process` → `ci: update nightly release process` (это workflow)
- `fix: correct import order and syntax in various files` → `style: fix import order and lint issues` (это линт/форматирование, а не баг)

# Скриншот-демо для визуальных фич

Любая фича с видимой/внешней составляющей (новый виджет, оверлей, изменение layout, темизации, статус-бара, дерева файлов и т.п.) обязана принести **сценарий-демо и скриншот в PR**:

1. Добавь или обнови сценарий в `e2e/scenarios/` (`*.scenario.ts`) — код, который поднимает настоящий редактор headless, шлёт нужные команды и снимает кадр(ы). Формат — `defineScenario({ name, open, run })`; за образец возьми `e2e/scenarios/quickOpen.scenario.ts`.
2. Прогони `npm run screenshots` — сгенерит PNG в `screenshots/` (каталог в `.gitignore`) + `screenshots/INDEX.md`.
3. Приложи получившиеся PNG к телу PR (способ — ниже).

## Как приложить PNG к PR (агенту, без раздувания репо)

GitHub показывает картинки в теле PR только по URL, а из CLI нельзя залить их в user-content CDN (это только drag-drop в вебе). Поэтому кладём PNG в **эфемерную orphan-ветку** `pr-assets/<имя-фича-ветки>` (без общей истории — только блобы картинок) и ссылаемся по commit-SHA. Пламбинг ниже **не трогает рабочее дерево**:

```bash
# из корня репо, после `npm run screenshots`; репо должен быть публичным (иначе camo не отрендерит raw)
E=$(git hash-object -w screenshots/<shot1>.png)
O=$(git hash-object -w screenshots/<shot2>.png)
R=$(printf 'Ephemeral screenshot assets for the <branch> PR. Safe to delete after merge.\n' | git hash-object -w --stdin)
T=$(printf '100644 blob %s\t<shot1>.png\n100644 blob %s\t<shot2>.png\n100644 blob %s\tREADME.md\n' "$E" "$O" "$R" | git mktree)
C=$(git commit-tree "$T" -m "chore: ephemeral screenshot assets for <branch> PR")   # orphan: без -p
git push origin "$C:refs/heads/pr-assets/<branch>"
# в теле PR ссылайся по SHA (однозначно, без проблем со слэшем в имени ветки):
#   ![editor](https://raw.githubusercontent.com/<owner>/<repo>/$C/<shot1>.png)
```

После мерджа/закрытия PR ветку чистим: `git push origin --delete pr-assets/<branch>`.

Подробности и как это гоняется в CI — docs/TESTING.md (раздел «E2E → Скриншот-демо»).

# Файловая структура
Файлы с тестам не должны быть слишком большими -- у нас может быть много кейсов поэтому надо писать тесты не в одном 
файле и называть их можно так:

Если файл один то структруа такая:

TUIElement.ts
TUIElement.test.ts

А если больше, то можно делать поразделы

TUIElement.ts
TUIElement.Events.test.ts
