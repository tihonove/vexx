import type { StoryContext, StoryMeta } from "../../StoryRunner/StoryTypes.ts";

import { DropdownElement } from "./DropdownElement.ts";

export const meta: StoryMeta = {
    title: "DropdownElement",
};

const CHANNELS = [
    { value: "bootstrap", label: "bootstrap" },
    { value: "configuration", label: "configuration" },
    { value: "extensions.host", label: "extensions.host" },
    { value: "extensions.host.rpc", label: "extensions.host.rpc" },
    { value: "filetree.watcher", label: "filetree.watcher" },
];

/** Select-подобный контрол: Enter/Space/↓ — открыть, ↑↓ — выбрать, Enter — применить, Esc — закрыть. */
export function channels(ctx: StoryContext): void {
    ctx.body.title = "DropdownElement — Enter/Space/↓ открыть, ↑↓ выбрать, Enter применить, Esc закрыть";

    const dropdown = new DropdownElement(CHANNELS);
    dropdown.placeholder = "Select channel";
    dropdown.value = "bootstrap";
    dropdown.setOverlayLayer(ctx.body.overlayLayer);
    dropdown.onChange = (value) => {
        ctx.body.title = `Selected channel: ${value}`;
    };

    ctx.body.setContent(dropdown);

    ctx.afterRun(() => {
        dropdown.focus();
    });
}

/** Пустое состояние: опций нет — показывается placeholder, список не открывается. */
export function empty(ctx: StoryContext): void {
    ctx.body.title = "DropdownElement — empty (placeholder only)";

    const dropdown = new DropdownElement([]);
    dropdown.placeholder = "No channels yet";
    dropdown.setOverlayLayer(ctx.body.overlayLayer);

    ctx.body.setContent(dropdown);

    ctx.afterRun(() => {
        dropdown.focus();
    });
}
