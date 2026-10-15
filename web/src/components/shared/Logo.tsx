import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function AuroraLogo({ size = 24, className = '', showText = false }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="auroraLogoBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          <linearGradient id="auroraLogoCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>

          <linearGradient id="auroraLogoViolet" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" />
            <stop offset="50%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>

          <radialGradient id="auroraLogoOrb" cx="38%" cy="36%" r="62%">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="30%" stopColor="#7DD3FC" />
            <stop offset="70%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#818CF8" />
          </radialGradient>

          <radialGradient id="auroraLogoAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#A855F7" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>

          <filter id="auroraLogoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Container */}
        <rect width="100" height="100" rx="22" fill="url(#auroraLogoBg)" stroke="#334155" strokeWidth="1.5" />

        {/* Ambient Glow */}
        <circle cx="50" cy="50" r="42" fill="url(#auroraLogoAura)" />

        {/* Outer Aurora Orbit Ribbon 1 */}
        <path
          d="M 22 42 C 22 25, 42 16, 68 22 C 78 24, 76 34, 66 32 C 48 29, 32 36, 26 48 C 24 53, 22 48, 22 42 Z"
          fill="url(#auroraLogoCyan)"
          filter="url(#auroraLogoGlow)"
          opacity="0.9"
        />

        {/* Outer Aurora Orbit Ribbon 2 */}
        <path
          d="M 78 58 C 78 75, 58 84, 32 78 C 22 76, 24 66, 34 68 C 52 71, 68 64, 74 52 C 76 47, 78 52, 78 58 Z"
          fill="url(#auroraLogoViolet)"
          filter="url(#auroraLogoGlow)"
          opacity="0.9"
        />

        {/* Concentric Orbital Rings */}
        <ellipse
          cx="50"
          cy="50"
          rx="34"
          ry="24"
          transform="rotate(-30 50 50)"
          stroke="url(#auroraLogoCyan)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="120 40"
        />

        <ellipse
          cx="50"
          cy="50"
          rx="36"
          ry="18"
          transform="rotate(25 50 50)"
          stroke="url(#auroraLogoViolet)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="100 60"
          opacity="0.85"
        />

        {/* Central Luminous Celestial Orb */}
        <circle cx="50" cy="50" r="18" fill="url(#auroraLogoOrb)" filter="url(#auroraLogoGlow)" />

        {/* Specular Highlight on Orb */}
        <ellipse cx="44" cy="43" rx="7" ry="4" transform="rotate(-35 44 43)" fill="#FFFFFF" opacity="0.65" />

        {/* Starlight Sparkles */}
        <polygon points="68,26 69.5,29.5 73,31 69.5,32.5 68,36 66.5,32.5 63,31 66.5,29.5" fill="#FFFFFF" />
        <circle cx="30" cy="68" r="1.5" fill="#38BDF8" opacity="0.9" />
        <circle cx="72" cy="62" r="1.2" fill="#E0F2FE" opacity="0.8" />
      </svg>
      {showText && <span className="font-semibold tracking-tight text-white">Aurora AI</span>}
    </span>
  );
}
