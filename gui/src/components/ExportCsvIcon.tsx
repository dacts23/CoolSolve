interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function ExportCsvIcon({ size = 15, className = '', style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3" />
      <polyline points="14 2 14 7 19 7" />
      <path d="M19 7v4" />
      <path d="M13.5 15.5h8.5" />
      <path d="m18.5 12 3.5 3.5-3.5 3.5" />
      <text
        x="5.2"
        y="16.5"
        fill="currentColor"
        stroke="none"
        fontSize="5.2"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        letterSpacing="-0.2px"
      >
        CSV
      </text>
    </svg>
  );
}
