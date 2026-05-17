import * as fs from "node:fs";
import * as path from "node:path";

import { parse as parseJsonc, type ParseError, printParseErrorCode } from "jsonc-parser";

import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import type { IUserDataPaths } from "../Common/UserDataPaths.ts";

import { ConfigurationModel } from "./ConfigurationModel.ts";
import { getDefaultConfiguration } from "./defaults.ts";
import type {
    IConfigurationChangeEvent,
    IConfigurationInspectResult,
    IConfigurationService,
} from "./IConfigurationService.ts";

/**
 * Реализация {@link IConfigurationService}.
 *
 * Слои (в порядке возрастания приоритета):
 *   1. defaults — хардкод приложения (`getDefaultConfiguration()`);
 *   2. user — `User/settings.json` (default-профиль);
 *   3. profile — `User/profiles/<name>/settings.json` (только если активный
 *      профиль не default, иначе пусто).
 *
 * В этой итерации watcher отсутствует — изменения подхватываются после
 * перезапуска. API события `onDidChangeConfiguration` стабилен, чтобы
 * не ломать потребителей при добавлении watch.
 *
 * Битые JSONC-файлы логируются в `console.error` и трактуются как пустой
 * слой — bootstrap не должен падать из-за невалидного settings.json.
 */
export class ConfigurationService extends Disposable implements IConfigurationService {
    private readonly defaultsLayer: ConfigurationModel;
    private readonly userLayer: ConfigurationModel;
    private readonly profileLayer: ConfigurationModel;
    private readonly merged: ConfigurationModel;

    public constructor(input: {
        readonly defaultsLayer: ConfigurationModel;
        readonly userLayer: ConfigurationModel;
        readonly profileLayer: ConfigurationModel;
    }) {
        super();
        this.defaultsLayer = input.defaultsLayer;
        this.userLayer = input.userLayer;
        this.profileLayer = input.profileLayer;
        this.merged = ConfigurationModel.merge(this.defaultsLayer, this.userLayer, this.profileLayer);
    }

    public get<T>(key: string, defaultValue?: T): T | undefined {
        const v = this.merged.get<T>(key);
        return v ?? defaultValue;
    }

    public getValue(section?: string): unknown {
        return this.merged.getValue(section);
    }

    public inspect<T>(key: string): IConfigurationInspectResult<T> {
        return {
            default: this.defaultsLayer.get<T>(key),
            user: this.userLayer.get<T>(key),
            profile: this.profileLayer.get<T>(key),
            value: this.merged.get<T>(key),
        };
    }

    public onDidChangeConfiguration(_listener: (event: IConfigurationChangeEvent) => void): IDisposable {
        // Пока без watch — событие никогда не эмитится. Возвращаем no-op
        // Disposable, чтобы потребители могли подписываться безопасно.
        return {
            dispose: () => {
                /* no-op: watcher not implemented */
            },
        };
    }
}

/**
 * Асинхронный bootstrap: читает settings.json (user + profile, если есть),
 * парсит как JSONC, собирает все слои в `ConfigurationService`.
 *
 * `paths.settingsFile` указывает на settings.json активного профиля. Для
 * default-профиля это `User/settings.json` и совпадает с user-слоем —
 * мы загружаем тот же файл дважды, но второй слой даёт пустой результат,
 * чтобы не дублировать значения (см. ниже).
 */
export async function loadConfiguration(paths: IUserDataPaths): Promise<ConfigurationService> {
    const defaultsRaw = getDefaultConfiguration();
    const defaultsLayer = ConfigurationModel.fromRaw(defaultsRaw);

    const userSettingsPath = path.join(paths.userDir, "settings.json");
    const userLayer = await loadSettingsLayer(userSettingsPath);

    let profileLayer = ConfigurationModel.EMPTY;
    if (!paths.isDefaultProfile) {
        profileLayer = await loadSettingsLayer(paths.settingsFile);
    }

    return new ConfigurationService({ defaultsLayer, userLayer, profileLayer });
}

async function loadSettingsLayer(filePath: string): Promise<ConfigurationModel> {
    let content: string;
    try {
        content = await fs.promises.readFile(filePath, "utf-8");
    } catch (err) {
        if (isFileNotFound(err)) return ConfigurationModel.EMPTY;
        console.error(`Failed to read settings file ${filePath}:`, err);
        return ConfigurationModel.EMPTY;
    }

    const errors: ParseError[] = [];
    const parsed: unknown = parseJsonc(content, errors, { allowTrailingComma: true });
    if (errors.length > 0) {
        for (const err of errors) {
            console.error(
                `JSONC parse error in ${filePath} at offset ${String(err.offset)}: ${printParseErrorCode(err.error)}`,
            );
        }
        // Если ничего распарсить не удалось — пусто. Если parser вернул
        // частичный объект, используем его (поведение jsonc-parser совместимо
        // с VS Code: best-effort).
    }
    return ConfigurationModel.fromRaw(parsed);
}

function isFileNotFound(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "ENOENT";
}
