export interface IClipboard {
    readText(): string;
    writeText(text: string): void;
}
