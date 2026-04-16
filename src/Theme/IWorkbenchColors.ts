/**
 * All VS Code workbench color keys.
 * Values are packed 24-bit RGB integers (via `packRgb()`).
 *
 * Most properties are commented out — uncomment as you implement support for them.
 * Key names use dot-notation, matching VS Code exactly.
 *
 * @see https://code.visualstudio.com/api/references/theme-color
 */
export interface IWorkbenchColors {
    // ── Contrast colors ─────────────────────────────────────
    // /** An extra border around active elements to separate them from others for greater contrast. */
    // "contrastActiveBorder"?: number;
    // /** An extra border around elements to separate them from others for greater contrast. */
    // "contrastBorder"?: number;

    // ── Base colors ─────────────────────────────────────────
    /** Overall border color for focused elements. This color is only used if not overridden by a component. */
    focusBorder?: number;
    /** Overall foreground color. This color is only used if not overridden by a component. */
    foreground?: number;
    // /** Overall foreground for disabled elements. This color is only used if not overridden by a component. */
    // "disabledForeground"?: number;
    // /** Border color of widgets such as Find/Replace inside the editor. */
    // "widget.border"?: number;
    // /** Shadow color of widgets such as Find/Replace inside the editor. */
    // "widget.shadow"?: number;
    // /** Background color of text selections in the workbench (for input fields or text areas, does not apply to selections within the editor and the terminal). */
    // "selection.background"?: number;
    // /** Foreground color for description text providing additional information, for example for a label. */
    // "descriptionForeground"?: number;
    // /** Overall foreground color for error messages (this color is only used if not overridden by a component). */
    // "errorForeground"?: number;
    // /** The default color for icons in the workbench. */
    // "icon.foreground"?: number;
    // /** The hover border color for draggable sashes. */
    // "sash.hoverBorder"?: number;

    // ── Window border ───────────────────────────────────────
    // /** Border color for the active (focused) window. */
    // "window.activeBorder"?: number;
    // /** Border color for the inactive (unfocused) windows. */
    // "window.inactiveBorder"?: number;

    // ── Text colors ─────────────────────────────────────────
    // /** Background color for block quotes in text. */
    // "textBlockQuote.background"?: number;
    // /** Border color for block quotes in text. */
    // "textBlockQuote.border"?: number;
    // /** Background color for code blocks in text. */
    // "textCodeBlock.background"?: number;
    // /** Foreground color for links in text when clicked on and on mouse hover. */
    // "textLink.activeForeground"?: number;
    // /** Foreground color for links in text. */
    // "textLink.foreground"?: number;
    // /** Foreground color for preformatted text segments. */
    // "textPreformat.foreground"?: number;
    // /** Background color for preformatted text segments. */
    // "textPreformat.background"?: number;
    // /** Border color for preformatted text segments. */
    // "textPreformat.border"?: number;
    // /** Color for text separators. */
    // "textSeparator.foreground"?: number;

    // ── Action colors ───────────────────────────────────────
    // /** Toolbar background when hovering over actions using the mouse. */
    // "toolbar.hoverBackground"?: number;
    // /** Toolbar outline when hovering over actions using the mouse. */
    // "toolbar.hoverOutline"?: number;
    // /** Toolbar background when holding the mouse over actions. */
    // "toolbar.activeBackground"?: number;

    // ── Button control ──────────────────────────────────────
    // /** Button background color. */
    // "button.background"?: number;
    // /** Button foreground color. */
    // "button.foreground"?: number;
    // /** Button border color. */
    // "button.border"?: number;
    // /** Button separator color. */
    // "button.separator"?: number;
    // /** Button background color when hovering. */
    // "button.hoverBackground"?: number;
    // /** Secondary button foreground color. */
    // "button.secondaryForeground"?: number;
    // /** Secondary button background color. */
    // "button.secondaryBackground"?: number;
    // /** Secondary button background color when hovering. */
    // "button.secondaryHoverBackground"?: number;
    // /** Secondary button border color. */
    // "button.secondaryBorder"?: number;

    // ── Dropdown control ────────────────────────────────────
    // /** Dropdown background. */
    // "dropdown.background"?: number;
    // /** Dropdown list background. */
    // "dropdown.listBackground"?: number;
    // /** Dropdown border. */
    // "dropdown.border"?: number;
    // /** Dropdown foreground. */
    // "dropdown.foreground"?: number;

    // ── Input control ───────────────────────────────────────
    // /** Input box background. */
    // "input.background"?: number;
    // /** Input box border. */
    // "input.border"?: number;
    // /** Input box foreground. */
    // "input.foreground"?: number;
    // /** Input box foreground color for placeholder text. */
    // "input.placeholderForeground"?: number;

    // ── Scrollbar control ───────────────────────────────────
    // /** Scrollbar track background color. */
    // "scrollbar.background"?: number;
    // /** Scrollbar slider shadow to indicate that the view is scrolled. */
    // "scrollbar.shadow"?: number;
    // /** Scrollbar slider background color when clicked on. */
    // "scrollbarSlider.activeBackground"?: number;
    // /** Scrollbar slider background color. */
    // "scrollbarSlider.background"?: number;
    // /** Scrollbar slider background color when hovering. */
    // "scrollbarSlider.hoverBackground"?: number;

    // ── Badge ───────────────────────────────────────────────
    // /** Badge foreground color. */
    // "badge.foreground"?: number;
    // /** Badge background color. */
    // "badge.background"?: number;

    // ── Progress bar ────────────────────────────────────────
    // /** Background color of the progress bar shown for long running operations. */
    // "progressBar.background"?: number;

    // ── Lists and trees ─────────────────────────────────────
    /** List/Tree background color for the selected item when the list/tree is active. */
    "list.activeSelectionBackground"?: number;
    /** List/Tree foreground color for the selected item when the list/tree is active. */
    "list.activeSelectionForeground"?: number;
    // /** List/Tree icon foreground color for the selected item when the list/tree is active. */
    // "list.activeSelectionIconForeground"?: number;
    // /** List/Tree drag and drop background when moving items around using the mouse. */
    // "list.dropBackground"?: number;
    // /** List/Tree background color for the focused item when the list/tree is active. */
    // "list.focusBackground"?: number;
    // /** List/Tree foreground color for the focused item when the list/tree is active. */
    // "list.focusForeground"?: number;
    // /** List/Tree foreground color of the match highlights on actively focused items when searching inside the list/tree. */
    // "list.focusHighlightForeground"?: number;
    // /** List/Tree outline color for the focused item when the list/tree is active. */
    // "list.focusOutline"?: number;
    // /** List/Tree outline color for the focused item when the list/tree is active and selected. */
    // "list.focusAndSelectionOutline"?: number;
    // /** List/Tree foreground color of the match highlights when searching inside the list/tree. */
    // "list.highlightForeground"?: number;
    /** List/Tree background when hovering over items using the mouse. */
    "list.hoverBackground"?: number;
    /** List/Tree foreground when hovering over items using the mouse. */
    "list.hoverForeground"?: number;
    /** List/Tree background color for the selected item when the list/tree is inactive. */
    "list.inactiveSelectionBackground"?: number;
    /** List/Tree foreground color for the selected item when the list/tree is inactive. */
    "list.inactiveSelectionForeground"?: number;
    // /** List/Tree icon foreground color for the selected item when the list/tree is inactive. */
    // "list.inactiveSelectionIconForeground"?: number;
    // /** List background color for the focused item when the list is inactive. */
    // "list.inactiveFocusBackground"?: number;
    // /** List/Tree outline color for the focused item when the list/tree is inactive. */
    // "list.inactiveFocusOutline"?: number;
    // /** List/Tree foreground color for invalid items, for example an unresolved root in explorer. */
    // "list.invalidItemForeground"?: number;
    // /** Foreground color of list items containing errors. */
    // "list.errorForeground"?: number;
    // /** Foreground color of list items containing warnings. */
    // "list.warningForeground"?: number;
    // /** List/Tree Filter background color of typed text when searching inside the list/tree. */
    // "listFilterWidget.background"?: number;
    // /** List/Tree Filter Widget's outline color of typed text when searching inside the list/tree. */
    // "listFilterWidget.outline"?: number;
    // /** List/Tree Filter Widget's outline color when no match is found. */
    // "listFilterWidget.noMatchesOutline"?: number;
    // /** Shadow color of the type filter widget in lists and tree. */
    // "listFilterWidget.shadow"?: number;
    // /** Background color of the filtered matches in lists and trees. */
    // "list.filterMatchBackground"?: number;
    // /** Border color of the filtered matches in lists and trees. */
    // "list.filterMatchBorder"?: number;
    // /** List/Tree foreground color for items that are deemphasized. */
    // "list.deemphasizedForeground"?: number;
    // /** Tree Widget's stroke color for indent guides. */
    // "tree.indentGuidesStroke"?: number;
    // /** Tree stroke color for the indentation guides that are not active. */
    // "tree.inactiveIndentGuidesStroke"?: number;
    // /** Tree stroke color for the indentation guides. */
    // "tree.tableColumnsBorder"?: number;
    // /** Background color for odd table rows. */
    // "tree.tableOddRowsBackground"?: number;

    // ── Activity Bar ────────────────────────────────────────
    /** Activity Bar background color. */
    "activityBar.background"?: number;
    /** Activity Bar foreground color (for example used for the icons). */
    "activityBar.foreground"?: number;
    // /** Activity Bar item foreground color when it is inactive. */
    // "activityBar.inactiveForeground"?: number;
    // /** Activity Bar border color with the Side Bar. */
    // "activityBar.border"?: number;
    // /** Activity notification badge background color. */
    // "activityBarBadge.background"?: number;
    // /** Activity notification badge foreground color. */
    // "activityBarBadge.foreground"?: number;
    // /** Activity Bar active indicator border color. */
    // "activityBar.activeBorder"?: number;
    // /** Activity Bar optional background color for the active element. */
    // "activityBar.activeBackground"?: number;
    // /** Drag and drop feedback color for the activity bar items. */
    // "activityBar.dropBorder"?: number;
    // /** Activity bar focus border color for the active item. */
    // "activityBar.activeFocusBorder"?: number;

    // ── Profiles ────────────────────────────────────────────
    // /** Profile badge background color. */
    // "profileBadge.background"?: number;
    // /** Profile badge foreground color. */
    // "profileBadge.foreground"?: number;

    // ── Side Bar ────────────────────────────────────────────
    /** Side Bar background color. */
    "sideBar.background"?: number;
    /** Side Bar foreground color. */
    "sideBar.foreground"?: number;
    // /** Side Bar border color on the side separating the editor. */
    // "sideBar.border"?: number;
    // /** Drag and drop feedback color for the side bar sections. */
    // "sideBar.dropBackground"?: number;
    // /** Side Bar title foreground color. */
    // "sideBarTitle.foreground"?: number;
    // /** Side Bar section header background color. */
    // "sideBarSectionHeader.background"?: number;
    // /** Side Bar section header foreground color. */
    // "sideBarSectionHeader.foreground"?: number;
    // /** Side bar section header border color. */
    // "sideBarSectionHeader.border"?: number;

    // ── Minimap ─────────────────────────────────────────────
    // /** Highlight color for matches from search within files. */
    // "minimap.findMatchHighlight"?: number;
    // /** Highlight color for the editor selection. */
    // "minimap.selectionHighlight"?: number;
    // /** Highlight color for errors within the editor. */
    // "minimap.errorHighlight"?: number;
    // /** Highlight color for warnings within the editor. */
    // "minimap.warningHighlight"?: number;
    // /** Minimap background color. */
    // "minimap.background"?: number;

    // ── Editor Groups & Tabs ────────────────────────────────
    // /** Color to separate multiple editor groups from each other. */
    // "editorGroup.border"?: number;
    // /** Background color when dragging editors around. */
    // "editorGroup.dropBackground"?: number;
    /** Background color of the Tabs container. */
    "editorGroupHeader.tabsBackground"?: number;
    // /** Border color below the editor tabs control when tabs are enabled. */
    // "editorGroupHeader.tabsBorder"?: number;
    // /** Border color between editor group header and editor (below breadcrumbs if enabled). */
    // "editorGroupHeader.border"?: number;
    // /** Background color of an empty editor group. */
    // "editorGroup.emptyBackground"?: number;
    /** Active Tab background color in an active group. */
    "tab.activeBackground"?: number;
    // /** Active Tab background color in an inactive editor group. */
    // "tab.unfocusedActiveBackground"?: number;
    /** Active Tab foreground color in an active group. */
    "tab.activeForeground"?: number;
    // /** Border to separate Tabs from each other. */
    // "tab.border"?: number;
    // /** Bottom border for the active tab. */
    // "tab.activeBorder"?: number;
    // /** Top border for the active tab. */
    // "tab.activeBorderTop"?: number;
    // /** Border on the right of the last pinned editor to separate from unpinned editors. */
    // "tab.lastPinnedBorder"?: number;
    /** Inactive Tab background color. */
    "tab.inactiveBackground"?: number;
    /** Inactive Tab foreground color in an active group. */
    "tab.inactiveForeground"?: number;
    // /** Active tab foreground color in an inactive editor group. */
    // "tab.unfocusedActiveForeground"?: number;
    // /** Inactive tab foreground color in an inactive editor group. */
    // "tab.unfocusedInactiveForeground"?: number;
    // /** Tab background color when hovering. */
    // "tab.hoverBackground"?: number;
    // /** Tab foreground color when hovering. */
    // "tab.hoverForeground"?: number;

    // ── Editor colors ───────────────────────────────────────
    /** Editor background color. */
    "editor.background"?: number;
    /** Editor default foreground color. */
    "editor.foreground"?: number;
    /** Color of editor line numbers. */
    "editorLineNumber.foreground"?: number;
    /** Color of the active editor line number. */
    "editorLineNumber.activeForeground"?: number;
    /** Color of the editor cursor. */
    "editorCursor.foreground"?: number;
    // /** The background color of the editor cursor. Allows customizing the color of a character overlapped by a block cursor. */
    // "editorCursor.background"?: number;
    /** Color of the editor selection. */
    "editor.selectionBackground"?: number;
    // /** Color of the selected text for high contrast. */
    // "editor.selectionForeground"?: number;
    // /** Color of the selection in an inactive editor. */
    // "editor.inactiveSelectionBackground"?: number;
    // /** Color for regions with the same content as the selection. */
    // "editor.selectionHighlightBackground"?: number;
    // /** Border color for regions with the same content as the selection. */
    // "editor.selectionHighlightBorder"?: number;
    /** Background color for the highlight of line at the cursor position. */
    "editor.lineHighlightBackground"?: number;
    // /** Background color for the border around the line at the cursor position. */
    // "editor.lineHighlightBorder"?: number;
    // /** Background color of a symbol during read-access, for example when reading a variable. */
    // "editor.wordHighlightBackground"?: number;
    // /** Border color of a symbol during read-access. */
    // "editor.wordHighlightBorder"?: number;
    // /** Background color of a symbol during write-access. */
    // "editor.wordHighlightStrongBackground"?: number;
    // /** Border color of a symbol during write-access. */
    // "editor.wordHighlightStrongBorder"?: number;
    // /** Color of the current search match. */
    // "editor.findMatchBackground"?: number;
    // /** Color of the other search matches. */
    // "editor.findMatchHighlightBackground"?: number;
    // /** Color the range limiting the search. */
    // "editor.findRangeHighlightBackground"?: number;
    // /** Highlight below the word for which a hover is shown. */
    // "editor.hoverHighlightBackground"?: number;
    // /** Color of active links. */
    // "editorLink.activeForeground"?: number;
    // /** Background color of highlighted ranges, used by Quick Open, Symbol in File and Find features. */
    // "editor.rangeHighlightBackground"?: number;
    // /** Color of whitespace characters in the editor. */
    // "editorWhitespace.foreground"?: number;
    // /** Color of the editor indentation guides. */
    // "editorIndentGuide.background"?: number;
    // /** Color of the active editor indentation guide. */
    // "editorIndentGuide.activeBackground"?: number;
    // /** Background color of inline hints. */
    // "editorInlayHint.background"?: number;
    // /** Foreground color of inline hints. */
    // "editorInlayHint.foreground"?: number;
    // /** Color of the editor rulers. */
    // "editorRuler.foreground"?: number;

    // ── Editor — Bracket match ──────────────────────────────
    // /** Background color behind matching brackets. */
    // "editorBracketMatch.background"?: number;
    // /** Color for matching brackets boxes. */
    // "editorBracketMatch.border"?: number;

    // ── Editor — Bracket pair colorization ──────────────────
    // /** Foreground color of brackets (1). */
    // "editorBracketHighlight.foreground1"?: number;
    // /** Foreground color of brackets (2). */
    // "editorBracketHighlight.foreground2"?: number;
    // /** Foreground color of brackets (3). */
    // "editorBracketHighlight.foreground3"?: number;
    // /** Foreground color of brackets (4). */
    // "editorBracketHighlight.foreground4"?: number;
    // /** Foreground color of brackets (5). */
    // "editorBracketHighlight.foreground5"?: number;
    // /** Foreground color of brackets (6). */
    // "editorBracketHighlight.foreground6"?: number;
    // /** Foreground color of unexpected brackets. */
    // "editorBracketHighlight.unexpectedBracket.foreground"?: number;

    // ── Editor — Folding ────────────────────────────────────
    // /** Background color for folded ranges. */
    // "editor.foldBackground"?: number;

    // ── Editor — Overview ruler ─────────────────────────────
    // /** Background color of the editor overview ruler. */
    // "editorOverviewRuler.background"?: number;
    // /** Color of the overview ruler border. */
    // "editorOverviewRuler.border"?: number;
    // /** Overview ruler marker color for find matches. */
    // "editorOverviewRuler.findMatchForeground"?: number;
    // /** Overview ruler marker color for modified content. */
    // "editorOverviewRuler.modifiedForeground"?: number;
    // /** Overview ruler marker color for added content. */
    // "editorOverviewRuler.addedForeground"?: number;
    // /** Overview ruler marker color for deleted content. */
    // "editorOverviewRuler.deletedForeground"?: number;
    // /** Overview ruler marker color for errors. */
    // "editorOverviewRuler.errorForeground"?: number;
    // /** Overview ruler marker color for warnings. */
    // "editorOverviewRuler.warningForeground"?: number;
    // /** Overview ruler marker color for infos. */
    // "editorOverviewRuler.infoForeground"?: number;
    // /** Overview ruler marker color for matching brackets. */
    // "editorOverviewRuler.bracketMatchForeground"?: number;

    // ── Editor — Errors and warnings ────────────────────────
    // /** Foreground color of error squiggles in the editor. */
    // "editorError.foreground"?: number;
    // /** Border color of error boxes in the editor. */
    // "editorError.border"?: number;
    // /** Background color of error text in the editor. */
    // "editorError.background"?: number;
    // /** Foreground color of warning squiggles in the editor. */
    // "editorWarning.foreground"?: number;
    // /** Border color of warning boxes in the editor. */
    // "editorWarning.border"?: number;
    // /** Background color of warning text in the editor. */
    // "editorWarning.background"?: number;
    // /** Foreground color of info squiggles in the editor. */
    // "editorInfo.foreground"?: number;
    // /** Border color of info boxes in the editor. */
    // "editorInfo.border"?: number;
    // /** Foreground color of hints in the editor. */
    // "editorHint.foreground"?: number;

    // ── Editor — Gutter ─────────────────────────────────────
    /** Background color of the editor gutter. */
    "editorGutter.background"?: number;
    // /** Editor gutter background color for lines that are modified. */
    // "editorGutter.modifiedBackground"?: number;
    // /** Editor gutter background color for lines that are added. */
    // "editorGutter.addedBackground"?: number;
    // /** Editor gutter background color for lines that are deleted. */
    // "editorGutter.deletedBackground"?: number;
    // /** Color of the folding control in the editor gutter. */
    // "editorGutter.foldingControlForeground"?: number;

    // ── Editor — Unnecessary code ───────────────────────────
    // /** Border color of unnecessary (unused) source code in the editor. */
    // "editorUnnecessaryCode.border"?: number;
    // /** Opacity of unnecessary (unused) source code in the editor. */
    // "editorUnnecessaryCode.opacity"?: number;

    // ── Diff editor colors ──────────────────────────────────
    // /** Background color for text that got inserted. */
    // "diffEditor.insertedTextBackground"?: number;
    // /** Outline color for the text that got inserted. */
    // "diffEditor.insertedTextBorder"?: number;
    // /** Background color for text that got removed. */
    // "diffEditor.removedTextBackground"?: number;
    // /** Outline color for text that got removed. */
    // "diffEditor.removedTextBorder"?: number;
    // /** Border color between the two text editors. */
    // "diffEditor.border"?: number;

    // ── Editor widget colors ────────────────────────────────
    // /** Foreground color of editor widgets, such as find/replace. */
    // "editorWidget.foreground"?: number;
    // /** Background color of editor widgets, such as Find/Replace. */
    // "editorWidget.background"?: number;
    // /** Border color of the editor widget. */
    // "editorWidget.border"?: number;
    // /** Background color of the suggestion widget. */
    // "editorSuggestWidget.background"?: number;
    // /** Border color of the suggestion widget. */
    // "editorSuggestWidget.border"?: number;
    // /** Foreground color of the suggestion widget. */
    // "editorSuggestWidget.foreground"?: number;
    // /** Color of the match highlights in the suggestion widget. */
    // "editorSuggestWidget.highlightForeground"?: number;
    // /** Background color of the selected entry in the suggestion widget. */
    // "editorSuggestWidget.selectedBackground"?: number;
    // /** Foreground color of the editor hover. */
    // "editorHoverWidget.foreground"?: number;
    // /** Background color of the editor hover. */
    // "editorHoverWidget.background"?: number;
    // /** Border color of the editor hover. */
    // "editorHoverWidget.border"?: number;
    // /** Foreground color of the ghost text shown by inline completion providers. */
    // "editorGhostText.foreground"?: number;
    // /** Editor sticky scroll background color. */
    // "editorStickyScroll.background"?: number;
    // /** Border color of sticky scroll in the editor. */
    // "editorStickyScroll.border"?: number;

    // ── Peek view colors ────────────────────────────────────
    // /** Color of the peek view borders and arrow. */
    // "peekView.border"?: number;
    // /** Background color of the peek view editor. */
    // "peekViewEditor.background"?: number;
    // /** Background color of the gutter in the peek view editor. */
    // "peekViewEditorGutter.background"?: number;
    // /** Match highlight color in the peek view editor. */
    // "peekViewEditor.matchHighlightBackground"?: number;
    // /** Background color of the peek view result list. */
    // "peekViewResult.background"?: number;
    // /** Foreground color for file nodes in the peek view result list. */
    // "peekViewResult.fileForeground"?: number;
    // /** Foreground color for line nodes in the peek view result list. */
    // "peekViewResult.lineForeground"?: number;
    // /** Match highlight color in the peek view result list. */
    // "peekViewResult.matchHighlightBackground"?: number;
    // /** Background color of the selected entry in the peek view result list. */
    // "peekViewResult.selectionBackground"?: number;
    // /** Foreground color of the selected entry in the peek view result list. */
    // "peekViewResult.selectionForeground"?: number;
    // /** Background color of the peek view title area. */
    // "peekViewTitle.background"?: number;
    // /** Color of the peek view title info. */
    // "peekViewTitleDescription.foreground"?: number;
    // /** Color of the peek view title. */
    // "peekViewTitleLabel.foreground"?: number;

    // ── Merge conflicts ─────────────────────────────────────
    // /** Current header background in inline merge conflicts. */
    // "merge.currentHeaderBackground"?: number;
    // /** Current content background in inline merge conflicts. */
    // "merge.currentContentBackground"?: number;
    // /** Incoming header background in inline merge conflicts. */
    // "merge.incomingHeaderBackground"?: number;
    // /** Incoming content background in inline merge conflicts. */
    // "merge.incomingContentBackground"?: number;
    // /** Border color on headers and the splitter in inline merge conflicts. */
    // "merge.border"?: number;

    // ── Panel colors ────────────────────────────────────────
    // /** Panel background color. */
    // "panel.background"?: number;
    // /** Panel border color to separate the panel from the editor. */
    // "panel.border"?: number;
    // /** Border color for the active panel title. */
    // "panelTitle.activeBorder"?: number;
    // /** Title color for the active panel. */
    // "panelTitle.activeForeground"?: number;
    // /** Title color for the inactive panel. */
    // "panelTitle.inactiveForeground"?: number;
    // /** Input box border for inputs in the panel. */
    // "panelInput.border"?: number;

    // ── Status Bar colors ───────────────────────────────────
    /** Standard Status Bar background color. */
    "statusBar.background"?: number;
    /** Status Bar foreground color. */
    "statusBar.foreground"?: number;
    // /** Status Bar border color separating the Status Bar and editor. */
    // "statusBar.border"?: number;
    // /** Status Bar background color when a program is being debugged. */
    // "statusBar.debuggingBackground"?: number;
    // /** Status Bar foreground color when a program is being debugged. */
    // "statusBar.debuggingForeground"?: number;
    // /** Status Bar background color when no folder is opened. */
    // "statusBar.noFolderBackground"?: number;
    // /** Status Bar foreground color when no folder is opened. */
    // "statusBar.noFolderForeground"?: number;
    // /** Status Bar item background color when clicking. */
    // "statusBarItem.activeBackground"?: number;
    // /** Status Bar item background color when hovering. */
    // "statusBarItem.hoverBackground"?: number;
    // /** Status Bar prominent items foreground color. */
    // "statusBarItem.prominentForeground"?: number;
    // /** Status Bar prominent items background color. */
    // "statusBarItem.prominentBackground"?: number;
    // /** Background color for the remote indicator on the status bar. */
    // "statusBarItem.remoteBackground"?: number;
    // /** Foreground color for the remote indicator on the status bar. */
    // "statusBarItem.remoteForeground"?: number;

    // ── Title Bar colors ────────────────────────────────────
    /** Title Bar background when the window is active. */
    "titleBar.activeBackground"?: number;
    /** Title Bar foreground when the window is active. */
    "titleBar.activeForeground"?: number;
    // /** Title Bar background when the window is inactive. */
    // "titleBar.inactiveBackground"?: number;
    // /** Title Bar foreground when the window is inactive. */
    // "titleBar.inactiveForeground"?: number;
    // /** Title bar border color. */
    // "titleBar.border"?: number;

    // ── Menu Bar colors ─────────────────────────────────────
    // /** Foreground color of the selected menu item in the menubar. */
    // "menubar.selectionForeground"?: number;
    // /** Background color of the selected menu item in the menubar. */
    // "menubar.selectionBackground"?: number;
    // /** Border color of the selected menu item in the menubar. */
    // "menubar.selectionBorder"?: number;
    // /** Foreground color of menu items. */
    // "menu.foreground"?: number;
    // /** Background color of menu items. */
    // "menu.background"?: number;
    // /** Foreground color of the selected menu item in menus. */
    // "menu.selectionForeground"?: number;
    // /** Background color of the selected menu item in menus. */
    // "menu.selectionBackground"?: number;
    // /** Border color of the selected menu item in menus. */
    // "menu.selectionBorder"?: number;
    // /** Color of a separator menu item in menus. */
    // "menu.separatorBackground"?: number;
    // /** Border color of menus. */
    // "menu.border"?: number;

    // ── Command Center colors ───────────────────────────────
    // /** Foreground color of the Command Center. */
    // "commandCenter.foreground"?: number;
    // /** Background color of the Command Center. */
    // "commandCenter.background"?: number;
    // /** Border color of the Command Center. */
    // "commandCenter.border"?: number;
    // /** Active foreground color of the Command Center. */
    // "commandCenter.activeForeground"?: number;
    // /** Active background color of the Command Center. */
    // "commandCenter.activeBackground"?: number;

    // ── Notification colors ─────────────────────────────────
    // /** Notification Center border color. */
    // "notificationCenter.border"?: number;
    // /** Notification Center header foreground color. */
    // "notificationCenterHeader.foreground"?: number;
    // /** Notification Center header background color. */
    // "notificationCenterHeader.background"?: number;
    // /** Notification toast border color. */
    // "notificationToast.border"?: number;
    // /** Notification foreground color. */
    // "notifications.foreground"?: number;
    // /** Notification background color. */
    // "notifications.background"?: number;
    // /** Notification links foreground color. */
    // "notificationLink.foreground"?: number;

    // ── Banner colors ───────────────────────────────────────
    // /** Banner background color. */
    // "banner.background"?: number;
    // /** Banner foreground color. */
    // "banner.foreground"?: number;

    // ── Extensions colors ───────────────────────────────────
    // /** Extension view button foreground color (for example Install button). */
    // "extensionButton.prominentForeground"?: number;
    // /** Extension view button background color. */
    // "extensionButton.prominentBackground"?: number;
    // /** Extension view button background hover color. */
    // "extensionButton.prominentHoverBackground"?: number;

    // ── Quick picker colors ─────────────────────────────────
    // /** Quick picker (Quick Open) color for grouping borders. */
    // "pickerGroup.border"?: number;
    // /** Quick picker (Quick Open) color for grouping labels. */
    // "pickerGroup.foreground"?: number;
    // /** Quick input background color. */
    // "quickInput.background"?: number;
    // /** Quick input foreground color. */
    // "quickInput.foreground"?: number;
    // /** Quick picker background color for the focused item. */
    // "quickInputList.focusBackground"?: number;

    // ── Integrated Terminal colors ──────────────────────────
    // /** The background of the Integrated Terminal's viewport. */
    // "terminal.background"?: number;
    // /** The color of the border that separates split panes within the terminal. */
    // "terminal.border"?: number;
    // /** The default foreground color of the Integrated Terminal. */
    // "terminal.foreground"?: number;
    // /** 'Black' ANSI color in the terminal. */
    // "terminal.ansiBlack"?: number;
    // /** 'Blue' ANSI color in the terminal. */
    // "terminal.ansiBlue"?: number;
    // /** 'BrightBlack' ANSI color in the terminal. */
    // "terminal.ansiBrightBlack"?: number;
    // /** 'BrightBlue' ANSI color in the terminal. */
    // "terminal.ansiBrightBlue"?: number;
    // /** 'BrightCyan' ANSI color in the terminal. */
    // "terminal.ansiBrightCyan"?: number;
    // /** 'BrightGreen' ANSI color in the terminal. */
    // "terminal.ansiBrightGreen"?: number;
    // /** 'BrightMagenta' ANSI color in the terminal. */
    // "terminal.ansiBrightMagenta"?: number;
    // /** 'BrightRed' ANSI color in the terminal. */
    // "terminal.ansiBrightRed"?: number;
    // /** 'BrightWhite' ANSI color in the terminal. */
    // "terminal.ansiBrightWhite"?: number;
    // /** 'BrightYellow' ANSI color in the terminal. */
    // "terminal.ansiBrightYellow"?: number;
    // /** 'Cyan' ANSI color in the terminal. */
    // "terminal.ansiCyan"?: number;
    // /** 'Green' ANSI color in the terminal. */
    // "terminal.ansiGreen"?: number;
    // /** 'Magenta' ANSI color in the terminal. */
    // "terminal.ansiMagenta"?: number;
    // /** 'Red' ANSI color in the terminal. */
    // "terminal.ansiRed"?: number;
    // /** 'White' ANSI color in the terminal. */
    // "terminal.ansiWhite"?: number;
    // /** 'Yellow' ANSI color in the terminal. */
    // "terminal.ansiYellow"?: number;
    // /** The selection background color of the terminal. */
    // "terminal.selectionBackground"?: number;
    // /** The foreground color of the terminal cursor. */
    // "terminalCursor.foreground"?: number;
    // /** The background color of the terminal cursor. */
    // "terminalCursor.background"?: number;

    // ── Debug colors ────────────────────────────────────────
    // /** Debug toolbar background color. */
    // "debugToolBar.background"?: number;
    // /** Debug toolbar border color. */
    // "debugToolBar.border"?: number;
    // /** Background color of the top stack frame highlight in the editor. */
    // "editor.stackFrameHighlightBackground"?: number;
    // /** Background color of the focused stack frame highlight in the editor. */
    // "editor.focusedStackFrameHighlightBackground"?: number;

    // ── Testing colors ──────────────────────────────────────
    // /** Color for 'run' icons in the editor. */
    // "testing.runAction"?: number;
    // /** Color for the 'Errored' icon in the test explorer. */
    // "testing.iconErrored"?: number;
    // /** Color for the 'failed' icon in the test explorer. */
    // "testing.iconFailed"?: number;
    // /** Color for the 'passed' icon in the test explorer. */
    // "testing.iconPassed"?: number;
    // /** Color for the 'Queued' icon in the test explorer. */
    // "testing.iconQueued"?: number;
    // /** Color for the 'Unset' icon in the test explorer. */
    // "testing.iconUnset"?: number;
    // /** Color for the 'Skipped' icon in the test explorer. */
    // "testing.iconSkipped"?: number;

    // ── Welcome page colors ─────────────────────────────────
    // /** Background color for the Welcome page. */
    // "welcomePage.background"?: number;

    // ── Git colors ──────────────────────────────────────────
    // /** Color for added Git resources. */
    // "gitDecoration.addedResourceForeground"?: number;
    // /** Color for modified Git resources. */
    // "gitDecoration.modifiedResourceForeground"?: number;
    // /** Color for deleted Git resources. */
    // "gitDecoration.deletedResourceForeground"?: number;
    // /** Color for renamed or copied Git resources. */
    // "gitDecoration.renamedResourceForeground"?: number;
    // /** Color for untracked Git resources. */
    // "gitDecoration.untrackedResourceForeground"?: number;
    // /** Color for ignored Git resources. */
    // "gitDecoration.ignoredResourceForeground"?: number;
    // /** Color for conflicting Git resources. */
    // "gitDecoration.conflictingResourceForeground"?: number;
    // /** Color for submodule resources. */
    // "gitDecoration.submoduleResourceForeground"?: number;

    // ── Breadcrumbs colors ──────────────────────────────────
    // /** Color of breadcrumb items. */
    // "breadcrumb.foreground"?: number;
    // /** Background color of breadcrumb items. */
    // "breadcrumb.background"?: number;
    // /** Color of focused breadcrumb items. */
    // "breadcrumb.focusForeground"?: number;
    // /** Color of selected breadcrumb items. */
    // "breadcrumb.activeSelectionForeground"?: number;
    // /** Background color of breadcrumb item picker. */
    // "breadcrumbPicker.background"?: number;

    // ── Snippets colors ─────────────────────────────────────
    // /** Highlight background color of a snippet tabstop. */
    // "editor.snippetTabstopHighlightBackground"?: number;
    // /** Highlight border color of a snippet tabstop. */
    // "editor.snippetTabstopHighlightBorder"?: number;

    // ── Symbol Icons colors ─────────────────────────────────
    // /** The foreground color for array symbols. */
    // "symbolIcon.arrayForeground"?: number;
    // /** The foreground color for boolean symbols. */
    // "symbolIcon.booleanForeground"?: number;
    // /** The foreground color for class symbols. */
    // "symbolIcon.classForeground"?: number;
    // /** The foreground color for constant symbols. */
    // "symbolIcon.constantForeground"?: number;
    // /** The foreground color for constructor symbols. */
    // "symbolIcon.constructorForeground"?: number;
    // /** The foreground color for enumerator symbols. */
    // "symbolIcon.enumeratorForeground"?: number;
    // /** The foreground color for enumerator member symbols. */
    // "symbolIcon.enumeratorMemberForeground"?: number;
    // /** The foreground color for event symbols. */
    // "symbolIcon.eventForeground"?: number;
    // /** The foreground color for field symbols. */
    // "symbolIcon.fieldForeground"?: number;
    // /** The foreground color for file symbols. */
    // "symbolIcon.fileForeground"?: number;
    // /** The foreground color for folder symbols. */
    // "symbolIcon.folderForeground"?: number;
    // /** The foreground color for function symbols. */
    // "symbolIcon.functionForeground"?: number;
    // /** The foreground color for interface symbols. */
    // "symbolIcon.interfaceForeground"?: number;
    // /** The foreground color for key symbols. */
    // "symbolIcon.keyForeground"?: number;
    // /** The foreground color for keyword symbols. */
    // "symbolIcon.keywordForeground"?: number;
    // /** The foreground color for method symbols. */
    // "symbolIcon.methodForeground"?: number;
    // /** The foreground color for module symbols. */
    // "symbolIcon.moduleForeground"?: number;
    // /** The foreground color for namespace symbols. */
    // "symbolIcon.namespaceForeground"?: number;
    // /** The foreground color for null symbols. */
    // "symbolIcon.nullForeground"?: number;
    // /** The foreground color for number symbols. */
    // "symbolIcon.numberForeground"?: number;
    // /** The foreground color for object symbols. */
    // "symbolIcon.objectForeground"?: number;
    // /** The foreground color for operator symbols. */
    // "symbolIcon.operatorForeground"?: number;
    // /** The foreground color for package symbols. */
    // "symbolIcon.packageForeground"?: number;
    // /** The foreground color for property symbols. */
    // "symbolIcon.propertyForeground"?: number;
    // /** The foreground color for reference symbols. */
    // "symbolIcon.referenceForeground"?: number;
    // /** The foreground color for snippet symbols. */
    // "symbolIcon.snippetForeground"?: number;
    // /** The foreground color for string symbols. */
    // "symbolIcon.stringForeground"?: number;
    // /** The foreground color for struct symbols. */
    // "symbolIcon.structForeground"?: number;
    // /** The foreground color for text symbols. */
    // "symbolIcon.textForeground"?: number;
    // /** The foreground color for type parameter symbols. */
    // "symbolIcon.typeParameterForeground"?: number;
    // /** The foreground color for unit symbols. */
    // "symbolIcon.unitForeground"?: number;
    // /** The foreground color for variable symbols. */
    // "symbolIcon.variableForeground"?: number;

    // ── Debug Icons colors ──────────────────────────────────
    // /** Icon color for breakpoints. */
    // "debugIcon.breakpointForeground"?: number;
    // /** Icon color for disabled breakpoints. */
    // "debugIcon.breakpointDisabledForeground"?: number;
    // /** Debug toolbar icon for start debugging. */
    // "debugIcon.startForeground"?: number;

    // ── Notebook colors ─────────────────────────────────────
    // /** Notebook background color. */
    // "notebook.editorBackground"?: number;
    // /** The border color for notebook cells. */
    // "notebook.cellBorderColor"?: number;

    // ── Chart colors ────────────────────────────────────────
    // /** Contrast color for text in charts. */
    // "charts.foreground"?: number;
    // /** Color for lines in charts. */
    // "charts.lines"?: number;
    // /** Color for red elements in charts. */
    // "charts.red"?: number;
    // /** Color for blue elements in charts. */
    // "charts.blue"?: number;
    // /** Color for yellow elements in charts. */
    // "charts.yellow"?: number;
    // /** Color for orange elements in charts. */
    // "charts.orange"?: number;
    // /** Color for green elements in charts. */
    // "charts.green"?: number;
    // /** Color for purple elements in charts. */
    // "charts.purple"?: number;

    // ── Keybinding label colors ─────────────────────────────
    // /** Keybinding label background color. */
    // "keybindingLabel.background"?: number;
    // /** Keybinding label foreground color. */
    // "keybindingLabel.foreground"?: number;
    // /** Keybinding label border color. */
    // "keybindingLabel.border"?: number;
    // /** Keybinding label border bottom color. */
    // "keybindingLabel.bottomBorder"?: number;

    // ── Settings Editor colors ──────────────────────────────
    // /** The foreground color for a section header or active title. */
    // "settings.headerForeground"?: number;
    // /** The line that indicates a modified setting. */
    // "settings.modifiedItemIndicator"?: number;

    // ── Action Bar colors ───────────────────────────────────
    // /** Background color for toggled action items in action bar. */
    // "actionBar.toggledBackground"?: number;
}
