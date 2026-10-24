import type { LucideProps } from 'lucide-react';

export default function ThermoDiagramIcon({
  size = 20,
  strokeWidth = 2,
  color = 'currentColor',
  className = '',
  ...props
}: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-thermo-diagram ${className}`}
      {...props}
    >
      <path d="M3 3v18h18" />
      <path d="M7 18 C7.5 11, 10.5 8, 13 8 C15.5 8, 18.5 11, 19 18" />
      <circle cx="13" cy="8" r="1.6" fill={color} />
    </svg>
  );
}
