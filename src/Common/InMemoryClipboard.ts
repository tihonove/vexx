import type { IClipboard } from "./IClipboard.ts";

export class InMemoryClipboard implements IClipboard {
    private text = "";

    public readText(): string {
        return this.text;
    }

    public writeText(text: string): void {
        this.text = text;
    }
}
