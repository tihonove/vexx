import { afterAll, bench, describe } from "vitest";

import { cleanupDir, createTempDir, generateFileTree } from "../TestUtils/perfFixtures.ts";

import { FileSearchService } from "./FileSearchService.ts";

// Бенчмарки построения индекса и поиска по нему.
// Запуск: `npm run test:perf`.
//
// Диагностика: `activate()` синхронно обходит всё дерево (walkSync) и поднимает
// рекурсивный chokidar-watcher на весь воркспейс — это главный блокер старта.
// `search()` — линейный O(N) скан с fuzzy-match на каждое нажатие.
//
// NB: фикстуры строятся на верхнем уровне модуля, а не в beforeAll — в режиме
// `vitest bench` тяжёлая инициализация внутри beforeAll отрабатывает некорректно
// (бенч не набирает сэмплов). Очистка — через afterAll, он работает штатно.

// ─── Фикстуры (строятся один раз при импорте) ────────────────────────────────

const dir1k = createTempDir("vexx-perf-index-1k-");
generateFileTree(dir1k, { files: 1_000 });

const dir10k = createTempDir("vexx-perf-index-10k-");
generateFileTree(dir10k, { files: 10_000 });

// Готовый индекс для бенчей поиска.
const searchService = new FileSearchService();
searchService.activate(dir10k);

afterAll(() => {
    searchService.dispose();
    cleanupDir(dir1k);
    cleanupDir(dir10k);
});

// ─── Индексация: реальный стартовый расход activate() ────────────────────────

describe("FileSearchService.activate (index build)", () => {
    // dispose внутри измеряемого участка: walk + старт watcher'а — это стартовый
    // расход; dispose закрывает watcher, чтобы они не копились между итерациями.
    bench("activate / index 1000 files", () => {
        const service = new FileSearchService();
        service.activate(dir1k);
        service.dispose();
    });

    bench("activate / index 10000 files", () => {
        const service = new FileSearchService();
        service.activate(dir10k);
        service.dispose();
    });
});

// ─── Поиск по готовому индексу ───────────────────────────────────────────────

describe("FileSearchService.search (10k index)", () => {
    bench("search empty query", () => {
        searchService.search("", 50);
    });

    bench("search basename fragment", () => {
        searchService.search("module123", 50);
    });

    bench("search path fragment (no basename match)", () => {
        searchService.search("dir2", 50);
    });

    bench("search non-matching query", () => {
        searchService.search("zzzznomatch", 50);
    });
});
