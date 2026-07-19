export interface IClipboard {
    readText(): Promise<string>;
    writeText(text: string): Promise<void>;
}
