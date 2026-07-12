import { describe, expect, it } from "vitest";

import { collectBuiltinMainSpecs } from "./builtinMainExtensions.ts";
import type { IExtension } from "./IExtension.ts";

const PREFIX = "Extensions/builtin/";

function ext(id: string, dir: string, main?: string): IExtension {
    return {
        id,
        location: `${PREFIX}${dir}/`,
        isBuiltin: true,
        manifest: { name: dir, publisher: "vexx", version: "0.1.0", ...(main !== undefined ? { main } : {}) },
    } as IExtension;
}

describe("collectBuiltinMainSpecs", () => {
    it("selects only extensions with a non-empty main and resolves mainPath under builtinDir", () => {
        const specs = collectBuiltinMainSpecs(
            [ext("vexx.git", "git", "./main.ts"), ext("vscode.json", "json"), ext("vexx.blank", "blank", "")],
            "/repo/src/Extensions/builtin",
            PREFIX,
        );
        expect(specs).toHaveLength(1);
        expect(specs[0].ext.id).toBe("vexx.git");
        expect(specs[0].mainPath).toBe("/repo/src/Extensions/builtin/git/main.ts");
    });

    it("strips the trailing slash from location to derive the directory name", () => {
        const specs = collectBuiltinMainSpecs([ext("vexx.git", "git", "./out/extension.js")], "/b", PREFIX);
        expect(specs[0].mainPath).toBe("/b/git/out/extension.js");
    });

    it("returns an empty list when nothing declares main", () => {
        expect(collectBuiltinMainSpecs([ext("vscode.json", "json")], "/b", PREFIX)).toEqual([]);
    });
});
