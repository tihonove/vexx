import { describe, it, expect } from "vitest";

import {
    DEFAULT_PROFILE_NAME,
    DEFAULT_USER_DATA_ROOT_NAME,
    resolveUserDataPaths,
} from "./UserDataPaths.ts";

describe("resolveUserDataPaths", () => {
    const home = "/home/alice";

    it("uses ~/.vexx by default", () => {
        const paths = resolveUserDataPaths({ homedir: home });
        expect(paths.root).toBe(`/home/alice/${DEFAULT_USER_DATA_ROOT_NAME}`);
        expect(paths.extensionsDir).toBe("/home/alice/.vexx/extensions");
        expect(paths.userDir).toBe("/home/alice/.vexx/user-data/User");
        expect(paths.settingsFile).toBe("/home/alice/.vexx/user-data/User/settings.json");
        expect(paths.keybindingsFile).toBe("/home/alice/.vexx/user-data/User/keybindings.json");
    });

    it("activates default profile when none specified", () => {
        const paths = resolveUserDataPaths({ homedir: home });
        expect(paths.profileName).toBe(DEFAULT_PROFILE_NAME);
        expect(paths.isDefaultProfile).toBe(true);
        expect(paths.profileDir).toBe(paths.userDir);
    });

    it("honors --user-data-dir override", () => {
        const paths = resolveUserDataPaths({ homedir: home, userDataDir: "/tmp/vexx" });
        expect(paths.root).toBe("/tmp/vexx");
        expect(paths.extensionsDir).toBe("/tmp/vexx/extensions");
        expect(paths.settingsFile).toBe("/tmp/vexx/user-data/User/settings.json");
    });

    it("resolves relative --user-data-dir to absolute", () => {
        const paths = resolveUserDataPaths({ homedir: home, userDataDir: "./local-vexx" });
        expect(paths.root.startsWith("/")).toBe(true);
        expect(paths.root.endsWith("/local-vexx")).toBe(true);
    });

    it("places named profile under User/profiles/<name>", () => {
        const paths = resolveUserDataPaths({ homedir: home, profile: "compact" });
        expect(paths.profileName).toBe("compact");
        expect(paths.isDefaultProfile).toBe(false);
        expect(paths.profileDir).toBe("/home/alice/.vexx/user-data/User/profiles/compact");
        expect(paths.settingsFile).toBe(
            "/home/alice/.vexx/user-data/User/profiles/compact/settings.json",
        );
    });

    it("treats explicit `default` profile as default", () => {
        const paths = resolveUserDataPaths({ homedir: home, profile: "default" });
        expect(paths.isDefaultProfile).toBe(true);
        expect(paths.profileDir).toBe(paths.userDir);
    });

    it("treats blank profile as default", () => {
        const paths = resolveUserDataPaths({ homedir: home, profile: "   " });
        expect(paths.isDefaultProfile).toBe(true);
    });

    it("rejects invalid profile name characters", () => {
        expect(() => resolveUserDataPaths({ homedir: home, profile: "with space" })).toThrow(
            /Invalid profile name/,
        );
        expect(() => resolveUserDataPaths({ homedir: home, profile: "with/slash" })).toThrow();
        expect(() => resolveUserDataPaths({ homedir: home, profile: "../up" })).toThrow();
    });
});
