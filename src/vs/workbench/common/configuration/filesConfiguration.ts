import type { IConfigurationNode } from "../../../platform/configuration/common/configurationRegistry.ts";

export const filesConfiguration: IConfigurationNode = {
    id: "files",
    title: "Files",
    properties: {
        "files.enableTrash": {
            type: "boolean",
            default: true,
            description: "Move files to the OS trash when available; when disabled, delete permanently.",
        },
    },
};
