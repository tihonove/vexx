import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import overrides from "./eslint.overrides.ts";

export default tseslint.config(
    // Глобальные игноры
    {
        ignores: ["dist/", "node_modules/", "*.config.*"],
    },

    // Базовые рекомендации ESLint для JS
    eslint.configs.recommended,

    // Самый злой typescript-eslint пресет с type-aware правилами
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,

    // Настройки парсера для type-aware линтинга
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ["eslint.config.ts", "eslint.overrides.ts"],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // Prettier — отключает конфликтующие ESLint-правила и репортит нарушения форматирования
    eslintPluginPrettier,

    // Пользовательские переопределения из eslint.overrides.ts
    ...overrides,
);
