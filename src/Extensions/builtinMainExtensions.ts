import * as path from "node:path";

import type { IExtension } from "./IExtension.ts";

/** A builtin extension declaring `manifest.main`, with its resolved on-disk entry path. */
export interface IBuiltinMainSpec {
    readonly ext: IExtension;
    /** Absolute path to the extension's `main` file (requirable by the host subprocess). */
    readonly mainPath: string;
}

/**
 * From scanned builtin extensions, pick those declaring a non-empty `manifest.main`
 * and resolve each entry against the on-disk builtin directory.
 *
 * `location` is the virtual asset prefix (POSIX, trailing slash) — e.g.
 * `"Extensions/builtin/git/"`; stripping `prefix` yields the extension's directory
 * name, which joins with `builtinDir` and `main` to the real file path.
 */
export function collectBuiltinMainSpecs(
    exts: readonly IExtension[],
    builtinDir: string,
    prefix: string,
): IBuiltinMainSpec[] {
    const specs: IBuiltinMainSpec[] = [];
    for (const ext of exts) {
        const main = ext.manifest.main;
        if (typeof main !== "string" || main === "") continue;
        const dirName = ext.location.slice(prefix.length).replace(/\/$/, "");
        specs.push({ ext, mainPath: path.resolve(builtinDir, dirName, main) });
    }
    return specs;
}
