/**
 * Переопределения правил ESLint.
 *
 * Добавляй сюда любые правила, которые хочешь отключить или ослабить.
 * Этот файл импортируется в eslint.config.ts и применяется последним,
 * поэтому всё, что здесь указано, перекрывает базовый конфиг.
 *
 * Пример:
 *
 *   export default [
 *       {
 *           rules: {
 *               "@typescript-eslint/no-unused-vars": "off",
 *               "@typescript-eslint/no-explicit-any": "warn",
 *           },
 *       },
 *   ];
 */

import type { TSESLint } from "@typescript-eslint/utils";

const overrides: TSESLint.FlatConfig.ConfigArray = [
    {
        files: ["**/*.test.ts", "**/*.test.tsx"],
        rules: {
            "@typescript-eslint/no-non-null-assertion": "off",
        },
    },
    {
        files: ["src/TerminalBackend/**"],
        rules: {
            "no-control-regex": "off",
        },
    },
    {
        rules: {
            "@typescript-eslint/no-unused-vars": "off",
            // Запрещаем parameter properties — они не поддерживаются в strip-only режиме Node.js
            "@typescript-eslint/parameter-properties": "error",
            // Форсируем явный спецификатор видимости на всех членах класса
            "@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "explicit" }],
        },
    },
];

export default overrides;
