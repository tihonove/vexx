import { describe, expect, it } from "vitest";

import { FileSystemError, Uri } from "./VscodeTypes.ts";

describe("FileSystemError", () => {
    it("фабрики выставляют соответствующий code", () => {
        expect(FileSystemError.FileNotFound("m").code).toBe("FileNotFound");
        expect(FileSystemError.FileExists("m").code).toBe("FileExists");
        expect(FileSystemError.NoPermissions("m").code).toBe("NoPermissions");
        expect(FileSystemError.Unavailable("m").code).toBe("Unavailable");
    });

    it("это Error с name=FileSystemError", () => {
        const err = FileSystemError.FileNotFound("nope");
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe("FileSystemError");
        expect(err.message).toBe("nope");
    });

    it("принимает Uri (message из toString) и пустой конструктор (code=Unknown)", () => {
        const fromUri = FileSystemError.FileExists(Uri.file("/a/b.txt"));
        expect(fromUri.message).toContain("/a/b.txt");
        const bare = new FileSystemError();
        expect(bare.code).toBe("Unknown");
        expect(bare.message).toBe("");
    });
});
