/**
 * Хранилище конфигурации на стороне subprocess.
 *
 * `getConfiguration(...).get(...)` в расширениях синхронный, поэтому конфиг
 * доставляется push-моделью (см. host: `workspace.initialize` /
 * `workspace.configurationChanged`), а не RPC-per-get. Здесь хранится итоговое
 * слитое дерево двух слоёв:
 *
 * - `defaults` — вклад расширений (`contributes.configuration`), ключи которых
 *   уже dotted (`"editorconfig.generateAuto"`). Кладутся до `activate()` через
 *   {@link applyDefaults};
 * - `user` — снапшот пользовательских настроек хоста (`getValue()`), nested-дерево
 *   (`{ editor: { tabSize: 4 } }`), приходит в {@link setSnapshot}.
 *
 * Пользовательский слой перекрывает дефолты. Разрешение ключа — обход nested-дерева
 * по dotted-пути (`"editor.tabSize"` → `merged.editor.tabSize`), что канонично
 * повторяет иерархическую модель настроек VS Code.
 */

/** Результат покомпонентного inspect (подмножество `vscode`). */
export interface IConfigInspectResult {
    readonly key: string;
    readonly defaultValue: unknown;
    readonly globalValue: unknown;
    readonly value: unknown;
}

export class WorkspaceConfigStore {
    private defaultsTree: Record<string, unknown> = {};
    private userTree: Record<string, unknown> = {};
    private mergedCache: Record<string, unknown> | null = null;

    /**
     * Добавляет дефолты расширения. Ключи dotted (полный путь настройки).
     * Несколько расширений складываются в один слой дефолтов.
     */
    public applyDefaults(defaults: Readonly<Record<string, unknown>> | undefined): void {
        if (defaults === undefined) return;
        for (const [dottedKey, value] of Object.entries(defaults)) {
            setDeep(this.defaultsTree, dottedKey, value);
        }
        this.mergedCache = null;
    }

    /** Заменяет пользовательский слой снапшотом настроек хоста (nested-дерево). */
    public setSnapshot(snapshot: unknown): void {
        this.userTree = isPlainObject(snapshot) ? clone(snapshot) : {};
        this.mergedCache = null;
    }

    /** Значение по dotted-ключу; `defaultValue`, если ключ отсутствует. */
    public get(dottedKey: string, defaultValue?: unknown): unknown {
        const found = resolvePath(this.merged(), dottedKey);
        return found === undefined ? defaultValue : found;
    }

    /** Есть ли ключ (в любом слое). */
    public has(dottedKey: string): boolean {
        return resolvePath(this.merged(), dottedKey) !== undefined;
    }

    public inspect(dottedKey: string): IConfigInspectResult {
        return {
            key: dottedKey,
            defaultValue: resolvePath(this.defaultsTree, dottedKey),
            globalValue: resolvePath(this.userTree, dottedKey),
            value: resolvePath(this.merged(), dottedKey),
        };
    }

    /**
     * Собственные ключи поддерева `section` (для зеркалирования на объект
     * `WorkspaceConfiguration` — VS Code выставляет значения секции как поля).
     */
    public sectionKeys(section: string | undefined): string[] {
        const node = section === undefined || section === "" ? this.merged() : resolvePath(this.merged(), section);
        return isPlainObject(node) ? Object.keys(node) : [];
    }

    private merged(): Record<string, unknown> {
        this.mergedCache ??= deepMerge(this.defaultsTree, this.userTree);
        return this.mergedCache;
    }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

/** Записывает `value` по dotted-пути, создавая промежуточные объекты. */
function setDeep(tree: Record<string, unknown>, dottedKey: string, value: unknown): void {
    const segments = dottedKey.split(".");
    let node = tree;
    for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        const next = node[seg];
        if (isPlainObject(next)) {
            node = next;
        } else {
            const created: Record<string, unknown> = {};
            node[seg] = created;
            node = created;
        }
    }
    node[segments[segments.length - 1]] = value;
}

/** Достаёт значение по dotted-пути; `undefined`, если путь не разрешается. */
function resolvePath(tree: Record<string, unknown>, dottedKey: string): unknown {
    const segments = dottedKey.split(".");
    let node: unknown = tree;
    for (const seg of segments) {
        if (!isPlainObject(node)) return undefined;
        node = node[seg];
        if (node === undefined) return undefined;
    }
    return node;
}

/** Рекурсивно сливает два дерева; значения `over` перекрывают `base`. */
function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base };
    for (const [key, overValue] of Object.entries(over)) {
        const baseValue = result[key];
        if (isPlainObject(baseValue) && isPlainObject(overValue)) {
            result[key] = deepMerge(baseValue, overValue);
        } else {
            result[key] = overValue;
        }
    }
    return result;
}
