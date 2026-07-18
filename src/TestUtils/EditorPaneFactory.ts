import { EditorPane } from "../Controllers/EditorPane.ts";
import type { ILanguageService } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { EditorComponent } from "../Workbench/Components/Editor/EditorComponent.ts";
import { TextFileModel } from "../Workbench/Services/TextFile/TextFileModel.ts";
import { UndoRedoService } from "../Workbench/Services/Workspace/UndoRedoService.ts";

export type { EditorPane } from "../Controllers/EditorPane.ts";

export interface IEditorPaneOverrides {
    readonly registry?: TokenizationRegistry;
    readonly languageService?: ILanguageService;
    readonly themeService?: ThemeService;
    readonly undoRedoService?: UndoRedoService;
}

/**
 * Обвязка юнит-тестов пары `TextFileModel` + `EditorComponent`: собирает пару так
 * же, как `EditorGroupController.createAndWireEditor`, и отдаёт транзитный
 * {@link EditorPane} — сценарии работают с прежней поверхностью растворённого
 * редактора-контроллера. Живёт в TestUtils, чтобы тесты Workbench-слоя не
 * импортировали Controllers напрямую.
 */
export function createEditorPane(overrides: IEditorPaneOverrides = {}): EditorPane {
    const themeService = overrides.themeService ?? new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    const model = new TextFileModel(
        overrides.languageService ?? NULL_LANGUAGE_SERVICE,
        overrides.undoRedoService ?? new UndoRedoService(),
    );
    const component = new EditorComponent(
        themeService,
        overrides.registry ?? new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        model,
    );
    return new EditorPane(model, component);
}
