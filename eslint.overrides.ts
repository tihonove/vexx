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
        rules: {
            "@typescript-eslint/no-unused-vars": "off",
            // Сюда добавляй переопределения
        },
    },
];

export default overrides;
