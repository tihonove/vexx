import { defineConfig } from "vitest/config";

// Отдельный конфиг для e2e против собранного SEA-бинаря.
// Запускается через `npm run test:e2e`. В обычный `npm test` не попадает,
// поэтому unit-тесты остаются быстрыми.
export default defineConfig({
    test: {
        include: ["e2e/**/*.test.ts"],
        testTimeout: 60_000,
        hookTimeout: 180_000,
        // PTY-сессии используют один и тот же бинарь и могут конкурировать
        // за ресурсы при параллельном запуске. Раннер жертвует параллельностью
        // ради стабильности.
        fileParallelism: false,
        pool: "forks",
        coverage: { enabled: false },
    },
});
