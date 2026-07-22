# Diff — дифф-редактор и вкладка Changes

Цель: показывать изменения файлов — сначала diff-редактором, затем списком изменённых
файлов (аналог SCM-вьюхи VS Code, одно репо, без worktree и мультирепо).

## Как соотносятся дифф и Changes

Это не две фичи, а три слоя. «Сравнить два файла» и «дифф из Changes» — **один и тот же
виджет**; отличается только то, откуда берётся левая сторона: при сравнении файлов она с
диска, а в Changes — версия из `HEAD`, которой на диске нет. Вот эта виртуальная левая
сторона и есть настоящая граница между фичами.

Показательно, что в API VS Code нет способа отдать редактору готовый дифф. Есть только
`QuickDiffProvider.provideOriginalResource(uri): Uri` — расширение отдаёт **URI исходной
версии**, то есть контент, а дифф считает workbench своим алгоритмом. Это подтверждается и
реализацией: `contrib/scm/browser/quickDiffModel.ts` резолвит оригинал как текстовую модель
(`createModelReference`) и пересчитывает дифф по каждому `onDidChangeContent`. Разбора
вывода `git diff` там нет нигде.

## Кто считает дифф

Разделяем **change set** (какие строки изменились — алгоритм) и **diff view model**
(выровненные пары строк, filler-строки, вид каждой строки, маппинг view→сторона+doc-строка).
Второе — наше всегда. Первое — порт с двумя поставщиками, по признаку «файл открыт»:

| | Файл открыт в редакторе | Файл не открыт (коммит, превью из Changes) |
|---|---|---|
| Обе стороны | буфер уже в памяти, цена принята при открытии | не материализуем никогда |
| Change set | наш вычислитель, живой при наборе | ханки от `git diff` |
| Большой файл | размер уже принят фактом открытия | ничего не читаем, только ханки |

Почему не парсить `git diff` всегда:

- **Шорткат перестаёт быть шорткатом там, где начинается фича.** Для side-by-side нужны оба
  текста, то есть `git show HEAD:path` зовётся всё равно; а имея два буфера, посчитать дифф
  самим дешевле, чем восстанавливать старую сторону из тел ханков (`\ No newline at end of
  file`, rename detection, бинарники, свои правила EOL/`.gitattributes`).
- **Дифф от диска отстаёт от буфера.** `extensions/git/main.ts` перечитывает ханки по
  `onDidSaveTextDocument` — change-bars в гуттере залипшие, пока идёт набор. В VS Code они
  живые.
- **Git не умеет остальные случаи**: два произвольных файла, буфер против диска,
  untitled-буфер, файл вне репозитория.
- **Нет intra-line.** `--word-diff` — другой формат вывода, склеивать с построчным неудобно.

Что остаётся за git безоговорочно: список изменённых файлов и статусы, контент любой
ревизии, **detection переименований** (`git diff -M` — это парование путей, уровень списка
файлов, своим построчным диффом не получить).

## Форма вью: ханки, а не полный файл

Целевой UI — свёрнутые неизменённые регионы: в современном VS Code
`diffEditor.hideUnchangedRegions` включён **по умолчанию**, а в терминале это тем более
естественно. Отсюда: между ханками хранится не контент, а `{ unchangedLineCount }` —
плейсхолдер «⋯ N строк без изменений», раскрываемый по жесту через ленивый
`IDiffContentSource.getLines(side, from, to)`. Полнофайловый режим тогда — просто настройка
вью. Это же снимает вопрос «не вычитывать 200 МБ ради одной изменённой строки».

Логика свёртки у upstream — `UnchangedRegion.fromDiffs` в
`editor/browser/widget/diffEditor/diffEditorViewModel.ts:458` (параметры `minimumLineCount` +
`contextLineCount`). Класс завязан на `observable`, но функция короткая: случай «прочитать и
написать своё», а не копировать.

## Сделано

- [x] **Вендоринг `vs/editor/common/diff`** — 23 файла дословного переноса из
      `microsoft/vscode@1.127.0` (`DefaultLinesDiffComputer`: Myers + динамическое
      программирование, эвристики выравнивания, посимвольный intra-line дифф, детект
      перемещённого кода) плюс примитивы `editor/common/core` и `base/common/charCode`.
      Управляется `scripts/import-vscode-diff.mjs` (`--check` — сторож дрейфа);
      7 узких шимов в `base/common` вместо upstream-файлов, тянущих `observableInternal`.
      Гейт — фикстурный корпус upstream на 58 кейсов
      (`src/vs/editor/common/diff/diffFixtures.test.ts`).
      Замер на момент переноса: между пином `1.127.0` и main (2887 изменённых файлов)
      в `editor/common/diff` и `editor/common/core` — ноль изменений, код заморожен.

## Осталось

- [ ] **A. Абстракция editor input / pane.** `EditorPane`
      (`src/vs/workbench/browser/parts/editor/editorPane.ts`) — жёстко зашитая пара
      `TextFileModel` + `EditorComponent`; `EditorService.editors: EditorPane[]`;
      `EditorGroupComponent.syncFromService()` берёт `getActiveEditor()?.view`. Против
      `EditorPane` типизировано всё: find, suggest, статус-бар, host-адаптеры, undo,
      save-participants, `collectDirty`. Второй вид редактора требует развязки на
      input + pane. Смотреть: `common/editor/editorInput.ts` (370),
      `common/editor/diffEditorInput.ts` (263), `parts/editor/editorPanes.ts` (550).
      Связано с открытым пунктом про сплит-вью и undo в [Uri.md](Uri.md).
- [ ] **B. Буфер не с диска.** `TextFileModel.openFile` делает `fs.readFileSync` — версия из
      `HEAD` пути на диске не имеет. Либо read-only in-memory модель по RPC от
      git-расширения, либо канонический `IFileSystemProviderRegistry` /
      `TextDocumentContentProvider` — он уже лежит недоделанным в [Uri.md](Uri.md), и дифф
      его первый настоящий потребитель.
- [ ] **C. Форма вью.** Diff view model поверх `LinesDiff` (см. «Форма вью» выше). Начать
      можно с inline (unified) режима: он не требует ни сплит-контейнера, ни синхронного
      скролла двух сторон, ни filler-строк, и в терминале выглядит естественнее. У нас есть
      задел — индирекция view-строка↔doc-строка от folding'а
      (`editorViewState.ts`: `logicalToVisualLine`/`visualToLogicalLine`/`getViewLineCount`).
- [ ] **D. Порт `IDiffProvider`** с двумя реализациями (git-ханки / наш вычислитель) —
      см. таблицу выше. Побочный эффект: гуттер переезжает на живой вычислитель и перестаёт
      залипать до сохранения, а `extensions/git/lib/diff.ts` дорастает до разбора **тел**
      ханков (сейчас только заголовки).
- [ ] **E. Место для вкладки Changes.** Сайдбар захардкожен на Explorer
      (`workbenchComponent.ts:313` — `setLeftPanel(explorerComponent.view)`), ни activity
      bar, ни реестра вьюлетов нет. По возрастанию цены: (i) третья вкладка в нижней Panel
      рядом с PROBLEMS/TERMINAL — стоит ноль, `PanelService.addView` уже есть; (ii) вторая
      секция `TitledPanelElement` под EXPLORER (так VS Code делает с Open Editors/Outline);
      (iii) полноценный `SidebarService` по образцу `PanelService` + activity bar.
- [ ] **F. Неймспейс `scm`.** `scm.createSourceControl`, `SourceControlResourceState`,
      `QuickDiffProvider` (`vscode.d.ts:19814–20068`) и `registerTextDocumentContentProvider`
      (`:17659`) закомментированы. Канонический путь потянет раскомментирование крупного
      блока по лок-степ правилу плюс ext-host-адаптеры; прагматичный (приватные команды —
      двусторонние команды уже работают) быстрее, но будет переписан.
- [ ] **Столкновение геометрий.** После вендоринга в `src/vs/editor/common/core/` живут два
      несовместимых `IRange`: наш `iRange.ts` (`{ start: IPosition; end: IPosition }`) и
      upstream-овский из `range.ts` (`startLineNumber`/`startColumn`, 1-based). Потребителя у
      перенесённого пока нет, поэтому адаптер не писали. Решать при первом вызове: адаптер на
      границе диффа (дёшево, долг) или миграция ядра на upstream-примитивы (дороже, но это и
      есть заявленная в ARCHITECTURE.md парность путей).

## Порядок

Ветки независимы и встречаются только в последнем шаге, поэтому «сначала дифф, потом
Changes» — не обязательство:

1. **Changes без диффа** (E + список от `git status`, который `extensions/git` уже считает):
   клик открывает рабочий файл, гуттер уже красит change-bars. Отгружается само по себе.
2. **Diff-редактор** (A + B + C): проверяется командой `vexx.diff <left> <right>` и
   «сравнить с версией на диске», от Changes не зависит.
3. **Стык**: клик по строке в Changes открывает дифф. Тривиально, когда обе ветки есть.

Начинать стоит с (2): вся архитектурная цена там, и именно она вынуждает сделать абстракцию
input/pane, которая всё равно нужна для сплитов.
