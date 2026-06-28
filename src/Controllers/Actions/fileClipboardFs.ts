import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Чистые ФС-операции для copy/cut/paste в explorer. Вынесены отдельно от команд,
 * чтобы их можно было тестировать на временных каталогах без UI и DI.
 */

/** True, если `child` — это `parent` или лежит внутри `parent`. */
export function isInside(parent: string, child: string): boolean {
    const rel = path.relative(parent, child);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Подбирает имя в `targetDir`, не конфликтующее с существующими записями.
 * Повторяет поведение VS Code/Finder: `name` → `name copy` → `name copy 2` → …,
 * сохраняя расширение для файлов. Возвращает полный путь назначения.
 */
export function resolveNonConflictingDest(targetDir: string, name: string): string {
    const direct = path.join(targetDir, name);
    if (!fs.existsSync(direct)) return direct;

    const ext = path.extname(name);
    const base = ext ? name.slice(0, -ext.length) : name;

    for (let i = 1; ; i++) {
        const suffix = i === 1 ? " copy" : ` copy ${i}`;
        const candidate = path.join(targetDir, `${base}${suffix}${ext}`);
        if (!fs.existsSync(candidate)) return candidate;
    }
}

/** Бросает, если операция привела бы к копированию/перемещению каталога в самого себя. */
function assertNotIntoSelf(src: string, targetDir: string): void {
    if (isInside(src, targetDir)) {
        throw new Error(`Нельзя поместить "${path.basename(src)}" внутрь самого себя`);
    }
}

/**
 * Перемещает `src` на точный путь `dest` (а не «внутрь каталога»). На cross-device
 * (`EXDEV`) — копирует и удаляет. Используется обратимыми операциями (корзина, откат move),
 * где назначение известно поимённо.
 */
export function moveToPath(src: string, dest: string): void {
    try {
        fs.renameSync(src, dest);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EXDEV") {
            fs.cpSync(src, dest, { recursive: true });
            fs.rmSync(src, { recursive: true, force: true });
        } else {
            throw error;
        }
    }
}

/** Копирует `src` внутрь `targetDir`, авто-переименовывая при конфликте. Возвращает путь назначения. */
export function copyInto(src: string, targetDir: string): string {
    assertNotIntoSelf(src, targetDir);
    const dest = resolveNonConflictingDest(targetDir, path.basename(src));
    fs.cpSync(src, dest, { recursive: true });
    return dest;
}

/**
 * Перемещает `src` внутрь `targetDir`. Если `src` уже лежит в `targetDir` — no-op.
 * При конфликте имён авто-переименовывает. На cross-device (`EXDEV`) — копирует и удаляет.
 * Возвращает путь назначения (или исходный путь при no-op).
 */
export function moveInto(src: string, targetDir: string): string {
    assertNotIntoSelf(src, targetDir);
    if (path.dirname(src) === targetDir) return src;

    const dest = resolveNonConflictingDest(targetDir, path.basename(src));
    moveToPath(src, dest);
    return dest;
}
