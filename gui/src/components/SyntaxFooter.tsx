export interface SyntaxItem {
  code: string;
}

interface SyntaxFooterProps {
  items: SyntaxItem[];
  fileHint?: string;
}

/**
 * SyntaxFooter — A minimal, static, single-line docked footer bar
 * showing reference syntax and file conventions without any distractions.
 */
export default function SyntaxFooter({ items, fileHint }: SyntaxFooterProps) {
  return (
    <div className="syntax-footer">
      <span className="syntax-footer-label">SYNTAX</span>
      <div className="syntax-footer-items">
        {items.map((item, idx) => (
          <span key={item.code} className="syntax-footer-item-wrapper">
            {idx > 0 && <span className="syntax-footer-sep">·</span>}
            <code className="syntax-footer-code">{item.code}</code>
          </span>
        ))}
      </div>
      {fileHint && (
        <span className="syntax-footer-file" title="Associated file naming pattern">
          file: <code>{fileHint}</code>
        </span>
      )}
    </div>
  );
}
