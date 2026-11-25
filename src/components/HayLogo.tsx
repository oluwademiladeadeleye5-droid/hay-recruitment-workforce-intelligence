import React from 'react';

interface HayLogoProps {
  onClick?: () => void;
  inverted?: boolean;
  compact?: boolean;
  tag?: string;
}

export const HayLogo: React.FC<HayLogoProps> = ({
  onClick,
  inverted = false,
  compact = false,
  tag = 'RECRUITMENT',
}) => {
  const content = (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="hayMarkBg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0A2540" />
            <stop offset="100%" stopColor="#132F4C" />
          </linearGradient>
        </defs>
        <rect
          width="32"
          height="32"
          rx="8"
          fill={inverted ? '#112E4B' : 'url(#hayMarkBg)'}
        />
        {/* Left Emerald Pillar */}
        <rect x="7.5" y="7" width="4.4" height="18" rx="2.2" fill="#00A859" />
        {/* Ascending Diagonal Pulse Connector */}
        <path
          d="M10.5 18.5L21.5 13.5"
          stroke="#00B4D8"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Right Electric Indigo Pillar */}
        <rect x="20.1" y="7" width="4.4" height="18" rx="2.2" fill="#533AFD" />
        {/* Ascending Pulse Node */}
        <circle cx="22.3" cy="13.5" r="2.7" fill="#7C6BFF" stroke="#FFFFFF" strokeWidth="1.2" />
      </svg>

      {!compact && (
        <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
          <span
            className={`font-display text-xl font-extrabold tracking-tight leading-none ${
              inverted ? 'text-white' : 'text-[#0A2540] dark:text-white'
            }`}
          >
            hay
          </span>
          <span
            className={`text-[10px] font-semibold tracking-[0.16em] uppercase leading-none ${
              inverted ? 'text-slate-300' : 'text-[#425466] dark:text-slate-400'
            }`}
          >
            {tag}
          </span>
        </span>
      )}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#533AFD] rounded-lg"
      >
        {content}
      </button>
    );
  }

  return content;
};
