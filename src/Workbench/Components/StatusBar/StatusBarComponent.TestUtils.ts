import { MockTerminalBackend } from "../../../Backend/MockTerminalBackend.ts";
import type { IDisposable } from "../../../Common/Disposable.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../../Configuration/NullConfigurationService.ts";
import { EditorViewState } from "../../../Editor/EditorViewState.ts";
import type { EndOfLine } from "../../../Editor/EndOfLine.ts";
import { TextDocument } from "../../../Editor/TextDocument.ts";
import type { ILanguageService } from "../../../Editor/Tokenization/ILanguageService.ts";
import { NULL_LANGUAGE_SERVICE } from "../../../Editor/Tokenization/ILanguageService.ts";
import { darkPlusTheme } from "../../../Theme/themes/darkPlus.ts";
import { ThemeService } from "../../../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../../../Theme/WorkbenchTheme.ts";

import { CommandRegistry } from "../../Services/CommandRegistry.ts";
import type { IActiveEditorStatus, IActiveEditorStatusSource } from "../../Services/EditorStatusContribution.ts";
import { EditorStatusContribution } from "../../Services/EditorStatusContribution.ts";
import { StatusBarService } from "../../Services/StatusBarService.ts";
import { TerminalEnvironmentService } from "../../Services/TerminalEnvironment/TerminalEnvironmentService.ts";
import { TerminalEnvStatusContribution } from "../../Services/TerminalEnvironment/TerminalEnvStatusContribution.ts";
import { StatusBarComponent } from "./StatusBarComponent.ts";

/**
 * Тестовый редактор для сегментов статус-бара: реализует {@link IActiveEditorStatus}
 * поверх настоящих `TextDocument` + `EditorViewState` (курсор/EOL/язык ведут себя
 * как в проде и файрят те же события); только кодировка — собственное поле.
 */
export class FakeStatusEditor implements IActiveEditorStatus {
    public readonly viewState: EditorViewState;
    private readonly doc: TextDocument;
    private encodingValue = "utf8";
    private readonly encodingListeners = new Set<() => void>();

    public constructor(text = "", languageId = "plaintext") {
        this.doc = new TextDocument(text, languageId);
        this.viewState = new EditorViewState(this.doc);
    }

    public get eol(): EndOfLine {
        return this.doc.eol;
    }

    public get languageId(): string {
        return this.doc.languageId;
    }

    public get encoding(): string {
        return this.encodingValue;
    }

    public setEol(eol: EndOfLine): void {
        this.doc.setEol(eol);
    }

    public setLanguage(languageId: string): void {
        this.doc.setLanguage(languageId);
    }

    public setEncoding(encoding: string): void {
        this.encodingValue = encoding;
        for (const listener of [...this.encodingListeners]) listener();
    }

    public onDidChangeCursorPosition(listener: () => void): IDisposable {
        return this.viewState.onDidChangeCursorPosition(listener);
    }

    public onDidChangeLanguage(listener: () => void): IDisposable {
        return this.doc.onDidChangeLanguage(listener);
    }

    public onDidChangeEol(listener: () => void): IDisposable {
        return this.doc.onDidChangeEol(listener);
    }

    public onDidChangeEncoding(listener: () => void): IDisposable {
        this.encodingListeners.add(listener);
        return { dispose: () => this.encodingListeners.delete(listener) };
    }
}

/** Источник активного редактора: аналог EditorService в один экран кода. */
export class FakeActiveEditorSource implements IActiveEditorStatusSource {
    private active: FakeStatusEditor | null = null;
    private readonly listeners = new Set<(editor: IActiveEditorStatus | null) => void>();

    public getActiveEditor(): FakeStatusEditor | null {
        return this.active;
    }

    public onActiveEditorChanged(listener: (editor: IActiveEditorStatus | null) => void): IDisposable {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    }

    public setActiveEditor(editor: FakeStatusEditor | null): void {
        this.active = editor;
        for (const listener of [...this.listeners]) listener(editor);
    }

    /** «Открывает файл»: создаёт редактор и делает его активным. */
    public openEditor(text = "", languageId = "plaintext"): FakeStatusEditor {
        const editor = new FakeStatusEditor(text, languageId);
        this.setActiveEditor(editor);
        return editor;
    }
}

export interface StatusBarHarness {
    component: StatusBarComponent;
    statusBarService: StatusBarService;
    source: FakeActiveEditorSource;
    commands: CommandRegistry;
    terminalEnv: TerminalEnvironmentService;
    editorContribution: EditorStatusContribution;
    terminalContribution: TerminalEnvStatusContribution;
}

/**
 * Собирает полную связку статус-бара без DI-контейнера и слоя Controllers:
 * StatusBarService + оба contribution'а + StatusBarComponent. Терминальное
 * окружение — настоящий `TerminalEnvironmentService` (тесты чистят env-переменные,
 * чтобы сегмент детерминированно резолвился в "legacy").
 */
export function createStatusBarHarness(languageService: ILanguageService = NULL_LANGUAGE_SERVICE): StatusBarHarness {
    const statusBarService = new StatusBarService();
    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    const commands = new CommandRegistry();
    const terminalEnv = new TerminalEnvironmentService(new MockTerminalBackend(), NULL_CONFIGURATION_SERVICE);
    const source = new FakeActiveEditorSource();
    const terminalContribution = new TerminalEnvStatusContribution(statusBarService, terminalEnv);
    const editorContribution = new EditorStatusContribution(statusBarService, source, languageService, commands);
    const component = new StatusBarComponent(statusBarService, themeService);
    return { component, statusBarService, source, commands, terminalEnv, editorContribution, terminalContribution };
}
