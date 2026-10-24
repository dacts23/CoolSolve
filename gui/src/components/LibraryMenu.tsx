import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BookOpen, ChevronRight, ExternalLink, Search, X, Folder, FolderOpen, FileCode } from 'lucide-react';
import { api } from '../api/client';
import type { LibraryMenuCategory, LibraryMenuModel, LibraryMenuResponse } from '../api/types';
import { LIBRARY_DASHBOARD_URL, libraryModelPageUrl } from '../utils/library';

const LEVEL_TITLES: Record<number, string> = {
  1: 'Level 1 · Introductory',
  2: 'Level 2 · Intermediate',
  3: 'Level 3 · Advanced',
  4: 'Level 4 · Research',
};

interface Props {
  /** Called with the model ID when the user picks a model. */
  onOpen: (id: string) => void;
}

/**
 * "Library" toolbar button: a drop-down that follows the taxonomy of the CoolSolve Library
 * (category → sub-category → model). Only verified models are listed; the dashboard behind
 * the last entry shows all of them, blocked ones included.
 */
export default function LibraryMenu({ onOpen }: Props) {
  const [menu, setMenu] = useState<LibraryMenuResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getLibraryMenu().then((res) => {
      setMenu(res);
      if (res?.categories?.[0]) {
        setExpanded(new Set([res.categories[0].key]));
      }
    }).catch(() => setMenu(null));
  }, []);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const q = query.trim().toLowerCase();
  const matches = useCallback(
    (m: LibraryMenuModel) =>
      !q || m.title.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    [q],
  );

  // While searching, show only the groups with matches (all expanded)
  const categories = useMemo(() => {
    if (!menu) return [];
    if (!q) return menu.categories;
    const out: LibraryMenuCategory[] = [];
    for (const cat of menu.categories) {
      const models = cat.models.filter(matches);
      const children = cat.children
        .map((c) => ({ ...c, models: c.models.filter(matches) }))
        .filter((c) => c.models.length > 0);
      const count = models.length + children.reduce((n, c) => n + c.models.length, 0);
      if (count > 0) out.push({ ...cat, models, children, count });
    }
    return out;
  }, [menu, q, matches]);

  const renderModel = (m: LibraryMenuModel) => (
    <div key={m.id} className="library-model">
      <button
        className="library-model-open"
        title={`${m.id} · ${LEVEL_TITLES[m.level] ?? ''} · ${m.kind}`}
        onClick={() => {
          setOpen(false);
          onOpen(m.id);
        }}
      >
        <FileCode size={13} className="library-file-icon" />
        <span className="library-model-title">{m.title}</span>
        <span className="library-model-id">{m.id}</span>
        <span className={`library-level level-${m.level}`} title={LEVEL_TITLES[m.level]}>
          L{m.level}
        </span>
      </button>
      <a
        className="library-model-info"
        href={libraryModelPageUrl(m.id)}
        target="_blank"
        rel="noopener noreferrer"
        title="Model page: description, verification, README"
      >
        <ExternalLink size={12} />
      </a>
    </div>
  );

  return (
    <div className="toolbar-group library-selector" ref={rootRef}>
      <button
        className="toolbar-btn"
        onClick={() => setOpen(!open)}
        title="Models of the CoolSolve Library, by topic"
      >
        <BookOpen size={16} /> Library
      </button>
      {open && (
        <div className="library-dropdown">
          {!menu || !menu.available ? (
            <div className="library-empty">
              {menu?.reason ?? 'The model library is not available.'}
            </div>
          ) : (
            <>
              <div className="library-search">
                <Search size={13} className="library-search-icon" />
                <input
                  autoFocus
                  placeholder={`Search ${menu.total} verified models…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button className="library-search-clear" onClick={() => setQuery('')} title="Clear search">
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="library-tree">
                {categories.length === 0 && (
                  <div className="library-empty">
                    {query ? `No model matches "${query}".` : 'No models found.'}
                  </div>
                )}
                {categories.map((cat) => {
                  const isCatOpen = !!q || expanded.has(cat.key);
                  return (
                    <div key={cat.key} className="library-category">
                      <button className="library-group-header" onClick={() => toggle(cat.key)}>
                        <ChevronRight size={13} className={`library-chevron ${isCatOpen ? 'open' : ''}`} />
                        {isCatOpen ? (
                          <FolderOpen size={14} className="library-folder-icon" />
                        ) : (
                          <Folder size={14} className="library-folder-icon" />
                        )}
                        <span className="library-group-title">{cat.title}</span>
                        <span className="library-count-pill">{cat.count}</span>
                      </button>

                      {isCatOpen && (
                        <div className="library-children">
                          {cat.models.map(renderModel)}
                          {cat.children.map((sub) => {
                            const subKey = `${cat.key}/${sub.key}`;
                            const isSubOpen = !!q || expanded.has(subKey);
                            return (
                              <div key={subKey} className="library-group depth-1">
                                <button className="library-group-header" onClick={() => toggle(subKey)}>
                                  <ChevronRight size={13} className={`library-chevron ${isSubOpen ? 'open' : ''}`} />
                                  {isSubOpen ? (
                                    <FolderOpen size={14} className="library-folder-icon" />
                                  ) : (
                                    <Folder size={14} className="library-folder-icon" />
                                  )}
                                  <span className="library-group-title">{sub.title}</span>
                                  <span className="library-count-pill">{sub.models.length}</span>
                                </button>
                                {isSubOpen && (
                                  <div className="library-children">
                                    {sub.models.map(renderModel)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <a className="library-footer" href={LIBRARY_DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={13} /> Browse the whole library (all models, incl. blocked)
              </a>
              <div className="library-snapshot">
                {menu.snapshot.models ? `${menu.snapshot.models} models` : 'Library'}
                {menu.snapshot.commit ? ` · snapshot ${menu.snapshot.commit}` : ''}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
