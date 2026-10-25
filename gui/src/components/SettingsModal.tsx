import { X } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { ACCENTS, APP_PALETTES, EDITOR_FONTS, EDITOR_FONT_SIZES } from '../utils/appearance';
import { THEME_CHOICES } from '../languages/editorThemes';
import Select from './Select';
import { PlotRow as Row, PlotToggle as ToggleBtn } from './SetupShell';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    settingsTab, setSettingsTab,
    theme, palette, accent, editorTheme, editorFont, editorFontSize, forceAppBg,
    wordWrap, stickyScroll, showUnderlines, minimap, minimapSliderAlways,
    setPalette, setAccent, setEditorTheme, setEditorFont, setEditorFontSize, setForceAppBg,
    setWordWrap, setStickyScroll, setShowUnderlines, setMinimap, setMinimapSliderAlways,
  } = useUIStore();

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card modal-settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ fontWeight: 600 }}>Settings</span>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="settings-layout">
          <aside className="settings-sidebar">
            <button
              className={`settings-nav-item ${settingsTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setSettingsTab('appearance')}
            >
              Appearance
            </button>
            <button
              className={`settings-nav-item ${settingsTab === 'editor' ? 'active' : ''}`}
              onClick={() => setSettingsTab('editor')}
            >
              Editor
            </button>
          </aside>
          <section className="settings-content">
            {settingsTab === 'appearance' ? (
              <>
                <Row title="Theme" hint={`App and editor theme (${theme === 'dark' ? 'Dark' : 'Light'} mode active)`}>
                  <Select
                    value={(palette || 'catppuccin').replace(/-(dark|light)$/, '')}
                    options={THEME_CHOICES.map((t) => {
                      const pal = APP_PALETTES.find((p) => p.family === t.id && p.dark === (theme === 'dark'));
                      return { value: t.id, label: pal ? pal.variantLabel : t.label };
                    })}
                    onChange={setPalette}
                    style={{ minWidth: 220 }}
                  />
                </Row>
                <Row title="Accent color" hint="Used for focus, selection and buttons">
                  <div className="swatches">
                    {ACCENTS.map((a) => (
                      <button
                        key={a.id}
                        title={a.label}
                        aria-label={a.label}
                        className={`swatch ${accent === a.id ? 'active' : ''}`}
                        style={{ background: theme === 'dark' ? a.dark : a.light }}
                        onClick={() => setAccent(a.id)}
                      />
                    ))}
                  </div>
                </Row>
              </>
            ) : (
              <>
                <Row title="Color scheme" hint={`Syntax highlighting theme (${theme === 'dark' ? 'Dark' : 'Light'} variant)`}>
                  <Select
                    value={(editorTheme || palette || 'catppuccin').replace(/-(dark|light)$/, '')}
                    options={THEME_CHOICES.map((t) => {
                      const pal = APP_PALETTES.find((p) => p.family === t.id && p.dark === (theme === 'dark'));
                      return { value: t.id, label: pal ? pal.variantLabel : t.label };
                    })}
                    onChange={setEditorTheme}
                    align="right"
                    style={{ minWidth: 220 }}
                  />
                </Row>
                <Row title="Match app background" hint="Keep editor canvas seamlessly integrated with app surface">
                  <ToggleBtn checked={forceAppBg} onChange={setForceAppBg} />
                </Row>
                <Row title="Font family" hint="Cascadia, JetBrains and Fira are bundled; the rest use system fonts">
                  <Select
                    value={editorFont}
                    options={EDITOR_FONTS}
                    onChange={setEditorFont}
                    align="right"
                  />
                </Row>
                <Row title="Font size" hint="Editor text size in pixels (scales with pinch zoom)">
                  <Select
                    value={String(editorFontSize)}
                    options={EDITOR_FONT_SIZES.map((f) => ({ value: String(f.value), label: f.label }))}
                    onChange={(v) => setEditorFontSize(Number(v))}
                    align="right"
                  />
                </Row>
                <Row title="Word wrap" hint="Wrap long equations across multiple lines">
                  <ToggleBtn checked={wordWrap} onChange={setWordWrap} />
                </Row>
                <Row title="Sticky scroll" hint="Pin current section or comment header to top while scrolling">
                  <ToggleBtn checked={stickyScroll} onChange={setStickyScroll} />
                </Row>
                <Row title="Problem underlines" hint="Show squiggly underlines for errors and diagnostics">
                  <ToggleBtn checked={showUnderlines} onChange={setShowUnderlines} />
                </Row>
                <Row title="Minimap" hint="Show overview code navigation on the right">
                  <ToggleBtn checked={minimap} onChange={setMinimap} />
                </Row>
                <Row title="Minimap slider" hint="Always show the viewport box instead of only on hover">
                  <ToggleBtn checked={minimapSliderAlways} onChange={setMinimapSliderAlways} />
                </Row>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
