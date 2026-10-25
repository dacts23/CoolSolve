import { useCallback, useRef, useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import { X, Plus, FileCode, ChevronLeft, ChevronRight, Play, Bug, Square, Zap } from 'lucide-react';
import type * as Monaco from 'monaco-editor';
import Editor, { OnMount } from '@monaco-editor/react';
import { registerEESLanguage, EES_LANGUAGE_ID } from '../languages/ees';
import { defineEditorThemes, resolveEditorTheme, getActiveEditorBg } from '../languages/editorThemes';
import { useModelStore, tabHasResults } from '../stores/modelStore';
import { useUIStore } from '../stores/uiStore';
import { fontCss, DEFAULT_EDITOR_FONT_SIZE } from '../utils/appearance';
import { api } from '../api/client';
import { setEditorInstance, toggleBraceComment, toggleQuoteComment } from './editorUtils';
import { useSolveRunner } from '../utils/useSolveRunner';
import { useParametricStore } from '../stores/parametricStore';

let languageRegistered = false;

export default function CodeEditor() {
  const eescode = useModelStore((s) => s.eescode);
  const setEescode = useModelStore((s) => s.setEescode);
  const setParseResult = useModelStore((s) => s.setParseResult);
  const theme = useUIStore((s) => s.theme);
  const palette = useUIStore((s) => s.palette);
  const editorTheme = useUIStore((s) => s.editorTheme);
  const editorFont = useUIStore((s) => s.editorFont);
  const editorFontSize = useUIStore((s) => s.editorFontSize);
  const setEditorFontSize = useUIStore((s) => s.setEditorFontSize);
  const stepEditorFontSize = useUIStore((s) => s.stepEditorFontSize);
  const forceAppBg = useUIStore((s) => s.forceAppBg);
  const minimap = useUIStore((s) => s.minimap);
  const wordWrap = useUIStore((s) => s.wordWrap);
  const stickyScroll = useUIStore((s) => s.stickyScroll);
  const showUnderlines = useUIStore((s) => s.showUnderlines);
  const editorBodyRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [selLen, setSelLen] = useState(0);
  const parseErrors = useModelStore((s) => s.parseErrors);
  const equationCount = useModelStore((s) => s.equationCount);
  const variableCount = useModelStore((s) => s.variableCount);
  const isSquare = useModelStore((s) => s.isSquare);
  const openTabs = useModelStore((s) => s.openTabs);
  const activeTabId = useModelStore((s) => s.activeTabId);
  const switchTab = useModelStore((s) => s.switchTab);
  const closeTab = useModelStore((s) => s.closeTab);
  const closeOtherTabs = useModelStore((s) => s.closeOtherTabs);
  const renameTab = useModelStore((s) => s.renameTab);
  const reorderTabs = useModelStore((s) => s.reorderTabs);
  const newTab = useModelStore((s) => s.newTab);
  const { handleSolve, handleStopSolve, solving, tryHarderAvailable, deepSearchRunning } = useSolveRunner();
  const parametricRunning = useParametricStore((s) => s.running);

  const [tabToClose, setTabToClose] = useState<{ id: string; name: string } | null>(null);
  const [othersToClose, setOthersToClose] = useState<string | null>(null);
  const [tabToSwitchTo, setTabToSwitchTo] = useState<string | null>(null);

  // Switching files keeps each file's results, but the table grid's unsaved
  // cell edits live only on screen: warn before dropping them.
  const requestSwitchTab = useCallback((id: string) => {
    if (id === activeTabId) return;
    if (useModelStore.getState().lookupTableDirty) {
      setTabToSwitchTo(id);
    } else {
      switchTab(id);
    }
  }, [activeTabId, switchTab]);

  const requestCloseTab = useCallback((id: string) => {
    const tab = openTabs.find((t) => t.id === id);
    if (tab && (tab.dirty || tabHasResults(tab))) {
      setTabToClose({ id: tab.id, name: tab.name });
    } else {
      closeTab(id);
    }
  }, [openTabs, closeTab]);

  const requestCloseOtherTabs = useCallback((id: string) => {
    const othersAtRisk = openTabs.some((t) => t.id !== id && (t.dirty || tabHasResults(t)));
    if (othersAtRisk) {
      setOthersToClose(id);
    } else {
      closeOtherTabs(id);
    }
  }, [openTabs, closeOtherTabs]);

  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);

  const checkScroll = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = tabsRef.current;
    if (!el) return;
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [openTabs, checkScroll]);

  const stepScroll = (dir: -1 | 1) => {
    tabsRef.current?.scrollBy({ left: dir * 140, behavior: 'smooth' });
  };

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const parseTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const parseSeqRef = useRef(0);

  const activeEditorBg = getActiveEditorBg(editorTheme, theme, forceAppBg, palette);
  const activeMonacoTheme = resolveEditorTheme(editorTheme, theme, forceAppBg, palette);

  // Apply resolved Monaco theme whenever palette, theme, editorTheme, or forceAppBg changes
  useEffect(() => {
    const monaco = monacoRef.current || (window as unknown as { monaco?: typeof Monaco }).monaco;
    if (monaco) {
      defineEditorThemes(monaco);
      monaco.editor.setTheme(activeMonacoTheme);
    }
  }, [activeMonacoTheme]);

  // Dismiss context menu on click outside or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const onDown = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  // Controlled pinch-to-zoom / Ctrl+Wheel scaling across standard font sizes
  useEffect(() => {
    const el = editorBodyRef.current;
    if (!el) return;

    let accumulatedDelta = 0;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    const THRESHOLD = 55; // Calibrated deliberate pinch threshold to avoid hyper-sensitivity

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();
      e.stopPropagation();

      accumulatedDelta += e.deltaY;

      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        accumulatedDelta = 0;
      }, 250);

      if (accumulatedDelta <= -THRESHOLD) {
        stepEditorFontSize(1);
        accumulatedDelta = 0;
      } else if (accumulatedDelta >= THRESHOLD) {
        stepEditorFontSize(-1);
        accumulatedDelta = 0;
      }
    };

    el.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true });
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [stepEditorFontSize]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorInstance(editor);
    editor.onDidChangeCursorPosition((e) => setCursor({ line: e.position.lineNumber, col: e.position.column }));
    editor.onDidChangeCursorSelection((e) => {
      const m = editor.getModel();
      setSelLen(m ? m.getValueInRange(e.selection).length : 0);
    });

    if (!languageRegistered) {
      registerEESLanguage(monaco);
      languageRegistered = true;
    }

    // Set model language & enforce active theme on mount
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, EES_LANGUAGE_ID);
    }
    defineEditorThemes(monaco);
    monaco.editor.setTheme(resolveEditorTheme(editorTheme, theme, forceAppBg, palette));

    // Register comment toggle actions
    editor.addAction({
      id: 'coolsolve.toggleBraceComment',
      label: 'Toggle { } Comment',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
      run: () => toggleBraceComment(editor),
    });
    editor.addAction({
      id: 'coolsolve.toggleQuoteComment',
      label: 'Toggle " " Comment',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Slash],
      run: () => toggleQuoteComment(editor),
    });

    // Zoom keybindings stepping across standard font sizes
    editor.addAction({
      id: 'coolsolve.zoomIn',
      label: 'Zoom In (Increase Font Size)',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal, monaco.KeyMod.CtrlCmd | monaco.KeyCode.NumpadAdd],
      run: () => stepEditorFontSize(1),
    });
    editor.addAction({
      id: 'coolsolve.zoomOut',
      label: 'Zoom Out (Decrease Font Size)',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus, monaco.KeyMod.CtrlCmd | monaco.KeyCode.NumpadSubtract],
      run: () => stepEditorFontSize(-1),
    });
    editor.addAction({
      id: 'coolsolve.zoomReset',
      label: 'Reset Zoom (Default Font Size)',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0, monaco.KeyMod.CtrlCmd | monaco.KeyCode.Numpad0],
      run: () => setEditorFontSize(DEFAULT_EDITOR_FONT_SIZE),
    });

    // Focus editor
    editor.focus();
  };

  // Debounced parse (does not call setEescode — call separately when needed)
  const doParse = useCallback(
    (code: string) => {
      if (parseTimeoutRef.current) clearTimeout(parseTimeoutRef.current);
      parseTimeoutRef.current = setTimeout(async () => {
        if (!code.trim()) {
          setParseResult([], 0, 0, true);
          useModelStore.getState().setParsedVariables([]);
          return;
        }
        try {
          const seq = ++parseSeqRef.current;
          const result = await api.parse(code);
          // Ignore answers that arrive after a newer parse was requested.
          if (seq !== parseSeqRef.current) return;
          setParseResult(
            result.errors,
            result.equationCount,
            result.variableCount || 0,
            result.isSquare ?? true,
            result.diagnostics || []
          );

          // Store parsed variable info (units, imposed flags) for the VariableTable
          if (result.variables) {
            useModelStore.getState().setParsedVariables(result.variables);
          }

          // Set Monaco markers for errors and diagnostics
          if (editorRef.current) {
            const monaco = monacoRef.current || window.monaco;
            if (monaco) {
              const model = editorRef.current.getModel();
              if (model) {
                const markers = result.errors.map((err) => ({
                  severity: monaco.MarkerSeverity.Error,
                  startLineNumber: err.line,
                  startColumn: err.column || 1,
                  endLineNumber: err.line,
                  endColumn: (err.column || 1) + 10,
                  message: err.message,
                }));
                // Add diagnostic markers (warnings/info from P002, P003, etc.)
                if (result.diagnostics) {
                  for (const d of result.diagnostics) {
                    const sev = d.severity === 'Error' ? monaco.MarkerSeverity.Error
                              : d.severity === 'Warning' ? monaco.MarkerSeverity.Warning
                              : monaco.MarkerSeverity.Info;
                    markers.push({
                      severity: sev,
                      startLineNumber: d.line || 1,
                      startColumn: d.column || 1,
                      endLineNumber: d.line || 1,
                      endColumn: (d.column || 1) + 10,
                      message: `[${d.code}] ${d.message}`,
                    });
                  }
                }
                monaco.editor.setModelMarkers(model, 'coolsolve', useUIStore.getState().showUnderlines ? markers : []);
              }
            }
          }
        } catch {
          // Parse endpoint unavailable, no big deal
        }
      }, 500);
    },
    [setParseResult]
  );

  // Clear or re-apply markers when showUnderlines changes
  useEffect(() => {
    const monaco = monacoRef.current || window.monaco;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;
    if (!showUnderlines) {
      monaco.editor.setModelMarkers(model, 'coolsolve', []);
    } else {
      doParse(useModelStore.getState().eescode);
    }
  }, [showUnderlines, doParse]);

  // Monaco onChange handler — user typing
  const handleChange = useCallback(
    (value: string | undefined) => {
      setEescode(value || '');
    },
    [setEescode]
  );

  // Parse on every code change: typing, file load, examples, back button, etc.
  useEffect(() => {
    doParse(eescode);
  }, [eescode, doParse]);

  const commitRename = (id: string, name: string) => {
    const trimmed = name.trim();
    if (trimmed) {
      renameTab(id, trimmed);
    }
    setEditingTabId(null);
  };

  return (
    <div
      className="editor-pane"
      style={{ '--active-editor-bg': activeEditorBg } as React.CSSProperties}
    >
      <div className="editor-tabs-bar">
        <div className="editor-tabs" ref={tabsRef} onScroll={checkScroll}>
          {openTabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const isEditing = tab.id === editingTabId;
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index && draggedIndex !== index;
            return (
              <div
                key={tab.id}
                className={`editor-tab ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                onClick={() => requestSwitchTab(tab.id)}
                draggable={!isEditing}
                onDragStart={(e) => {
                  setDraggedIndex(index);
                  e.dataTransfer.setData('text/plain', String(index));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== index) setDragOverIndex(index);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData('text/plain'));
                  if (!isNaN(from) && from !== index) {
                    reorderTabs(from, index);
                  }
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
                }}
                title={tab.filePath || `${tab.name} (Drag to reorder · Right-click to rename)`}
              >
                <FileCode size={13} className="tab-icon" />
                {isEditing ? (
                  <input
                    autoFocus
                    className="tab-rename-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => commitRename(tab.id, editingName)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(tab.id, editingName);
                      else if (e.key === 'Escape') setEditingTabId(null);
                    }}
                  />
                ) : (
                  <span className="editor-tab-name">{tab.name}</span>
                )}
                {tab.dirty ? <span className="editor-tab-dirty" title="Unsaved changes" /> : null}
                <button
                  className="tab-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    requestCloseTab(tab.id);
                  }}
                  title="Close Tab"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
          <button
            className="editor-tab-add-btn"
            onClick={newTab}
            title="New File"
          >
            <Plus size={13} />
          </button>
        </div>
        {(canScrollLeft || canScrollRight) && (
          <div className="editor-tab-scroll-controls">
            <button
              className="editor-tab-scroll-btn"
              disabled={!canScrollLeft}
              onClick={() => stepScroll(-1)}
              title="Scroll tabs left"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              className="editor-tab-scroll-btn"
              disabled={!canScrollRight}
              onClick={() => stepScroll(1)}
              title="Scroll tabs right"
              aria-label="Scroll tabs right"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}

        <div className="editor-tab-actions">
          {solving && (
            <button
              className="toolbar-btn danger icon-only"
              onClick={handleStopSolve}
              title="Stop calculation (Esc)"
              aria-label="Stop calculation"
            >
              <Square size={12} />
            </button>
          )}
          <button
            className={`toolbar-btn primary icon-only${tryHarderAvailable ? ' try-harder' : ''}`}
            onClick={() => handleSolve(false, tryHarderAvailable)}
            disabled={solving || parametricRunning || !eescode.trim()}
            title={
              solving
                ? (deepSearchRunning ? 'Deep search in progress…' : 'Solving…')
                : tryHarderAvailable
                  ? 'Try Harder: re-run with Deep Search pipeline (F2)'
                  : 'Solve equations (F2 / Ctrl+Enter)'
            }
            aria-label="Solve"
          >
            {solving ? (
              <span className="spinner" />
            ) : tryHarderAvailable ? (
              <Zap size={13} fill="currentColor" />
            ) : (
              <Play size={13} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-btn"
            onClick={() => handleSolve(true, false)}
            disabled={solving || parametricRunning || !eescode.trim()}
            title="Debug solve: trace blocks, residuals & diagnostics (Ctrl+Shift+Enter)"
            aria-label="Debug Solve"
          >
            <Bug size={14} />
          </button>
        </div>
      </div>

      {/* Right-click Tab Context Menu */}
      {contextMenu && (
        <div
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const t = openTabs.find((tab) => tab.id === contextMenu.tabId);
              if (t) {
                setEditingTabId(t.id);
                setEditingName(t.name.replace(/\.eescode$/, ''));
              }
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            onClick={() => {
              requestCloseTab(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            Close
          </button>
          <button
            onClick={() => {
              requestCloseOtherTabs(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            Close Others
          </button>
        </div>
      )}

      {tabToClose && (
        <ConfirmModal
          title="Discard Unsaved Work?"
          message={`"${tabToClose.name}" has unsaved changes or run results. Closing it will discard them.`}
          confirmLabel="Discard & Close"
          onConfirm={() => {
            closeTab(tabToClose.id);
            setTabToClose(null);
          }}
          onCancel={() => setTabToClose(null)}
        />
      )}
      {othersToClose && (
        <ConfirmModal
          title="Discard Unsaved Work?"
          message="Other open tabs have unsaved changes or run results. Closing them will discard them."
          confirmLabel="Discard Others"
          onConfirm={() => {
            closeOtherTabs(othersToClose);
            setOthersToClose(null);
          }}
          onCancel={() => setOthersToClose(null)}
        />
      )}
      {tabToSwitchTo && (
        <ConfirmModal
          title="Discard Unsaved Table Edits?"
          message="The lookup table has unsaved cell edits. Switching files will discard them — save the table first to keep them."
          confirmLabel="Discard & Switch"
          onConfirm={() => {
            useModelStore.getState().setLookupTableDirty(false);
            switchTab(tabToSwitchTo);
            setTabToSwitchTo(null);
          }}
          onCancel={() => setTabToSwitchTo(null)}
        />
      )}
      <div className="editor-body" ref={editorBodyRef}>
        <Editor
          height="100%"
          defaultLanguage={EES_LANGUAGE_ID}
          value={eescode}
          onChange={handleChange}
          beforeMount={defineEditorThemes}
          onMount={handleMount}
          theme={activeMonacoTheme}
          loading={<div className="editor-loading">Loading editor…</div>}
          options={{
            fontSize: editorFontSize,
            fontFamily: fontCss(editorFont),
            fontLigatures: true,
            lineHeight: Math.round(editorFontSize * 1.55),
            padding: { top: 8, bottom: 8 },
            fixedOverflowWidgets: true,
            find: {
              addExtraSpaceOnTop: true,
              autoFindInSelection: 'never',
              seedSearchStringFromSelection: 'always',
            },
            minimap: {
              enabled: minimap,
              renderCharacters: false,
              showMarkSectionHeaders: false,
              showRegionSectionHeaders: false,
              maxColumn: 80,
              showSlider: 'mouseover',
            },
            wordWrap: wordWrap ? 'on' : 'off',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            renderLineHighlight: 'line',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            roundedSelection: true,
            folding: true,
            showFoldingControls: 'mouseover',
            stickyScroll: { enabled: stickyScroll },
            renderValidationDecorations: showUnderlines ? 'editable' : 'off',
            links: false,
            matchBrackets: 'near',
            occurrencesHighlight: 'off',
            linkedEditing: true,
            mouseWheelZoom: false,
            multiCursorModifier: 'ctrlCmd',
            formatOnPaste: true,
            suggest: { preview: true },
            quickSuggestions: { other: true, comments: false, strings: false },
            lineNumbersMinChars: 4,
            glyphMargin: false,
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            scrollbar: { verticalScrollbarSize: 12, horizontalScrollbarSize: 12, useShadows: false },
            tabSize: 4,
          }}
        />
      </div>
      <div className="editor-status">
        <span className={parseErrors.length ? 'status-err' : 'status-ok'}>
          {parseErrors.length ? `✖ ${parseErrors.length} error${parseErrors.length > 1 ? 's' : ''}` : '✔ No problems'}
        </span>
        <span>{equationCount} eq · {variableCount} var{!isSquare && equationCount > 0 ? ' · not square' : ''}</span>
        <span className="status-spacer" />
        <span>Ln {cursor.line}, Col {cursor.col}{selLen ? ` (${selLen} selected)` : ''}</span>
        <span>Spaces: 4</span>
        <span>CoolSolve</span>
      </div>
    </div>
  );
}
