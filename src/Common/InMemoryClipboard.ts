import type { IClipboard } from "./IClipboard.ts";

export class InMemoryClipboard implements IClipboard {
    private text = "";

    public readText(): Promise<string> {
        return Promise.resolve(this.text);
    }

    public writeText(text: string): Promise<void> {
        this.text = text;
        return Promise.resolve();
    }
}
