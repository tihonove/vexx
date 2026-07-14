import * as fs from "node:fs";
import * as path from "node:path";

import { applyEdits, modify, parse as parseJsonc, type ParseError, printParseErrorCode } from "jsonc-parser";

import { Disposable, type IDisposable } from "../../../base/common/lifecycle.ts";
import type { ILogger } from "../../log/common/logger.ts";
import type { IUserDataPaths } from "../../environment/node/userDataPath.ts";

import { ConfigurationModel } from "../common/configurationModels.ts";
import { getDefaultConfiguration } from "../common/defaults.ts";
import type {
    IConfigurationChangeEvent,
    IConfigurationInspectResult,
    IConfigurationService,
} from "../common/configuration.ts";

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
 * Битые JSONC-файлы логируются через переданный `ILogger` и трактуются как
 * пустой слой — bootstrap не должен падать из-за невалидного settings.json.
 */
export class ConfigurationService extends Disposable implements IConfigurationService {
    private readonly defaultsLayer: ConfigurationModel;
    private userLayer: ConfigurationModel;
    private profileLayer: ConfigurationModel;
    private merged: ConfigurationModel;
    /**
     * settings.json активного профиля — цель для {@link updateUserValue}. Для
     * default-профиля это `User/settings.json` (совпадает с user-слоем); для
     * именованного — файл профиля (profile-слой).
     */
    private readonly writeTargetPath: string | undefined;
    private readonly writesToProfileLayer: boolean;

    public constructor(input: {
        readonly defaultsLayer: ConfigurationModel;
        readonly userLayer: ConfigurationModel;
        readonly profileLayer: ConfigurationModel;
        /** Путь к settings.json активного профиля; без него запись недоступна. */
        readonly writeTargetPath?: string;
        /** true → правка ложится в profile-слой (именованный профиль). */
        readonly writesToProfileLayer?: boolean;
    }) {
        super();
        this.defaultsLayer = input.defaultsLayer;
        this.userLayer = input.userLayer;
        this.profileLayer = input.profileLayer;
        this.writeTargetPath = input.writeTargetPath;
        this.writesToProfileLayer = input.writesToProfileLayer ?? false;
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

    public async updateUserValue(key: string, value: unknown): Promise<void> {
        if (this.writeTargetPath === undefined) return;

        let content = "";
        try {
            content = await fs.promises.readFile(this.writeTargetPath, "utf-8");
        } catch (err) {
            if (!isFileNotFound(err)) throw err;
            // Файла ещё нет — стартуем с пустого объекта, каталог создаём ниже.
        }

        // Пишем плоский dotted-ключ (`"workbench.colorTheme": …`) — так же, как это
        // делает VS Code и как выглядят фикстуры/дефолты. `ConfigurationModel`
        // при чтении сам разворачивает точечные ключи во вложенное дерево. Поэтому
        // ключ идёт ОДНИМ сегментом JSONPath, а не `key.split(".")`.
        const edits = modify(content, [key], value, {
            formattingOptions: { insertSpaces: true, tabSize: 4 },
        });
        const next = applyEdits(content, edits);

        await fs.promises.mkdir(path.dirname(this.writeTargetPath), { recursive: true });
        await fs.promises.writeFile(this.writeTargetPath, next, "utf-8");

        // Обновляем in-memory слой, чтобы get/inspect сразу видели новое значение.
        const parsed: unknown = parseJsonc(next, [], { allowTrailingComma: true });
        const model = ConfigurationModel.fromRaw(parsed);
        if (this.writesToProfileLayer) {
            this.profileLayer = model;
        } else {
            this.userLayer = model;
        }
        this.merged = ConfigurationModel.merge(this.defaultsLayer, this.userLayer, this.profileLayer);
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
export async function loadConfiguration(paths: IUserDataPaths, logger?: ILogger): Promise<ConfigurationService> {
    const defaultsRaw = getDefaultConfiguration();
    const defaultsLayer = ConfigurationModel.fromRaw(defaultsRaw);

    const userSettingsPath = path.join(paths.userDir, "settings.json");
    const userLayer = await loadSettingsLayer(userSettingsPath, logger);

    let profileLayer = ConfigurationModel.EMPTY;
    if (!paths.isDefaultProfile) {
        profileLayer = await loadSettingsLayer(paths.settingsFile, logger);
    }

    return new ConfigurationService({
        defaultsLayer,
        userLayer,
        profileLayer,
        // Запись идёт в settings.json активного профиля (default → User/settings.json).
        writeTargetPath: paths.settingsFile,
        writesToProfileLayer: !paths.isDefaultProfile,
    });
}

async function loadSettingsLayer(filePath: string, logger: ILogger | undefined): Promise<ConfigurationModel> {
    let content: string;
    try {
        content = await fs.promises.readFile(filePath, "utf-8");
    } catch (err) {
        if (isFileNotFound(err)) return ConfigurationModel.EMPTY;
        logger?.error(`Failed to read settings file ${filePath}`, err);
        return ConfigurationModel.EMPTY;
    }

    const errors: ParseError[] = [];
    const parsed: unknown = parseJsonc(content, errors, { allowTrailingComma: true });
    if (errors.length > 0) {
        for (const err of errors) {
            logger?.error(
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
