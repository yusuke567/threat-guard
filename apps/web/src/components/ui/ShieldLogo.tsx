interface ShieldLogoProps {
  size?: number;
  className?: string;
}

export default function ShieldLogo({ size = 24, className = '' }: ShieldLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 2C16 2 4 6.5 4 6.5V15c0 8.5 5.5 15.5 12 17 6.5-1.5 12-8.5 12-17V6.5L16 2Z"
        fill="#3B82F6"
        stroke="#2563EB"
        strokeWidth="0.5"
      />
      <path
        d="M13.5 17.5L11 15l-1.5 1.5 4 4 8-8L20 11l-6.5 6.5Z"
        fill="white"
      />
    </svg>
  );
}
