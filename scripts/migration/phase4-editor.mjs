/**
 * Фаза 4: editor — модель редактора → vs/editor/common/{core,model,viewModel,languages,tokens},
 * виджет-мост → vs/editor/tui, фичи → vs/editor/contrib/{folding,find,suggest}.
 *
 * Канон vscode, где 1:1: position.ts, range.ts, selection.ts, textEdit.ts, model.ts
 * (ITextModel≈ITextDocument), languages.ts (provider-интерфейсы≈ICompletionSource),
 * language.ts (ILanguageService), lineTokens.ts, tokenizationRegistry.ts,
 * findController.ts. Файлы, где наш класс называется иначе, получают честные
 * camelCase-имена (textDocument.ts, undoManager.ts, editorViewState.ts).
 */
export const moves = [
    // ── core ─────────────────────────────────────────────────────────────────
    ["src/Editor/IPosition.ts", "src/vs/editor/common/core/position.ts"],
    ["src/Editor/IRange.ts", "src/vs/editor/common/core/range.ts"],
    ["src/Editor/ISelection.ts", "src/vs/editor/common/core/selection.ts"],
    ["src/Editor/ITextEdit.ts", "src/vs/editor/common/core/textEdit.ts"],
    ["src/Editor/EndOfLine.ts", "src/vs/editor/common/core/endOfLine.ts"],
    ["src/Editor/WordClassification.ts", "src/vs/editor/common/core/wordClassification.ts"],
    ["src/Editor/computeWordOccurrences.ts", "src/vs/editor/common/core/computeWordOccurrences.ts"],
    // ── model ────────────────────────────────────────────────────────────────
    ["src/Editor/ITextDocument.ts", "src/vs/editor/common/model.ts"],
    ["src/Editor/TextDocument.ts", "src/vs/editor/common/model/textDocument.ts"],
    ["src/Editor/UndoManager.ts", "src/vs/editor/common/model/undoManager.ts"],
    ["src/Editor/IUndoElement.ts", "src/vs/editor/common/model/undoElement.ts"],
    ["src/Editor/IDocumentContentChange.ts", "src/vs/editor/common/model/documentContentChange.ts"],
    ["src/Editor/IDocumentLanguageChange.ts", "src/vs/editor/common/model/documentLanguageChange.ts"],
    ["src/Editor/IndentationDetector.ts", "src/vs/editor/common/model/indentationDetector.ts"],
    ["src/Editor/IFoldingRegion.ts", "src/vs/editor/common/model/foldingRegion.ts"],
    ["src/Editor/Decorations/IGutterChangeDecoration.ts", "src/vs/editor/common/model/gutterChangeDecoration.ts"],
    // ── viewModel ────────────────────────────────────────────────────────────
    ["src/Editor/EditorViewState.ts", "src/vs/editor/common/viewModel/editorViewState.ts"],
    // ── languages / tokens ───────────────────────────────────────────────────
    ["src/Editor/ICompletionSource.ts", "src/vs/editor/common/languages.ts"],
    ["src/Editor/Tokenization/ILanguageService.ts", "src/vs/editor/common/languages/language.ts"],
    ["src/Editor/Tokenization/IState.ts", "src/vs/editor/common/languages/state.ts"],
    ["src/Editor/Tokenization/ITokenizationSupport.ts", "src/vs/editor/common/languages/tokenizationSupport.ts"],
    ["src/Editor/Tokenization/ITokenStyleResolver.ts", "src/vs/editor/common/languages/tokenStyleResolver.ts"],
    ["src/Editor/AutoIndent.ts", "src/vs/editor/common/languages/autoIndent.ts"],
    ["src/Editor/Tokenization/TokenizationRegistry.ts", "src/vs/editor/common/tokenizationRegistry.ts"],
    ["src/Editor/Tokenization/DocumentTokenStore.ts", "src/vs/editor/common/tokens/documentTokenStore.ts"],
    ["src/Editor/ILineTokens.ts", "src/vs/editor/common/tokens/lineTokens.ts"],
    // ── tui (виджет-мост) ────────────────────────────────────────────────────
    ["src/Editor/EditorElement.ts", "src/vs/editor/tui/editorElement.ts"],
    // ── test-хелперы ─────────────────────────────────────────────────────────
    ["src/Editor/EditorTestUtils/TrackDSL.ts", "src/vs/editor/test/common/trackDSL.ts"],
    // ── contrib/folding ──────────────────────────────────────────────────────
    ["src/Editor/FoldingRangeProvider.ts", "src/vs/editor/contrib/folding/common/foldingRangeProvider.ts"],
    ["src/Controllers/Actions/FoldingActions.ts", "src/vs/editor/contrib/folding/tui/foldingActions.ts"],
    // ── contrib/find ─────────────────────────────────────────────────────────
    ["src/Editor/findMatches.ts", "src/vs/editor/contrib/find/common/findMatches.ts"],
    ["src/Controllers/FindController.ts", "src/vs/editor/contrib/find/tui/findController.ts"],
    ["src/Controllers/Actions/FindActions.ts", "src/vs/editor/contrib/find/tui/findActions.ts"],
    // ── contrib/suggest ──────────────────────────────────────────────────────
    ["src/Controllers/CompletionController.ts", "src/vs/editor/contrib/suggest/tui/completionController.ts"],
    ["src/Controllers/collectWordCompletions.ts", "src/vs/editor/contrib/suggest/common/collectWordCompletions.ts"],
    ["src/Controllers/Actions/SuggestActions.ts", "src/vs/editor/contrib/suggest/tui/suggestActions.ts"],
];

// stringPrefixes не задаём: в src/Editor остаются файлы фазы 5 (textmate,
// ISaveParticipant), blanket-замена префикса переписала бы и их упоминания.
export const stringPrefixes = [];
