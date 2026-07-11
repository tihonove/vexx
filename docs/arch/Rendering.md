# Rendering/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

Вывод на экран: двойная буферизация, diff, минимальные ANSI-последовательности. Модель ячейки, 2D-матрица с diff-алгоритмом, высокоуровневое API рисования (`drawText`/`fill`/`clip`) и генератор ANSI escape-последовательностей для flush в stdout.

`GridSnapshot.ts` — plain-data сериализация кадра (`snapshotGrid → { cols, rows, cursor, cells[] }`): нужна, чтобы перерисовать экран вне терминала (растеризатор картинки, diff-вьюер) и передать кадр по инспектор-протоколу без графических зависимостей в редакторе.

`gridToSvg.ts` — чистая (pure-TS, без шрифтов/библиотек) сборка `GridSnapshot` → самодостаточный SVG: прогоны bg как `<rect>`, глифы как `<text>` с `textLength`/`lengthAdjust`, чтобы сетка не «плыла» под любым шрифтом. **Растеризация SVG→PNG живёт только в тулинге** (`e2e/helpers/renderScreenshot.ts`, resvg + системный шрифт), не в редакторе.
