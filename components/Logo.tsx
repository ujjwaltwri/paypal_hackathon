/**
 * Chargeback Copilot mark: a bold "C" that holds a coin, the merchant's money
 * kept inside instead of slipping out through a chargeback.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1d4ed8" />
      <path d="M22.39 10.25A8.6 8.6 0 1 0 22.39 21.75" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3.4" fill="#9fd0ff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[16px] font-semibold tracking-tight text-ink">Chargeback Copilot</span>
    </span>
  );
}
