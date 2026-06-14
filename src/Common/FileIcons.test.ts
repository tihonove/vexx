import { describe, expect, it } from "vitest";

import { getFileIcon } from "./FileIcons.ts";

describe("getFileIcon", () => {
    // Дефолтная иконка — то, что возвращается для неизвестных файлов.
    const defaultIcon = getFileIcon("file.unknownext");

    it("matches by exact filename", () => {
        expect(getFileIcon("Makefile")).not.toEqual(defaultIcon);
        expect(getFileIcon("Dockerfile")).not.toEqual(defaultIcon);
        expect(getFileIcon(".gitignore")).not.toEqual(defaultIcon);
    });

    it("matches by extension, using the last dot", () => {
        expect(getFileIcon("main.ts")).not.toEqual(defaultIcon);
        // Несколько точек — берётся последнее расширение.
        expect(getFileIcon("a.b.json")).toEqual(getFileIcon("c.json"));
    });

    it("falls back to the default icon for unknown extensions", () => {
        expect(getFileIcon("file.unknownext")).toEqual(defaultIcon);
    });

    it("falls back to the default icon for files without an extension", () => {
        expect(getFileIcon("README")).toEqual(defaultIcon);
    });
});
