import { memo } from "react";

const WAVE_BAR_COUNT = 9;

type TeacherAvatarProps = {
  /** Drives the avatar animation: speaking, listening, thinking, idle, idle-call. */
  state: string;
};

/** Animated illustrated teacher whose expression reflects the call state. */
function TeacherAvatarComponent({ state }: TeacherAvatarProps) {
  return (
    <div className={`avatar-stage avatar--${state}`} aria-hidden>
      <span className="halo halo--1" />
      <span className="halo halo--2" />
      <svg className="teacher-svg" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="face" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fde3c8" />
            <stop offset="60%" stopColor="#f5c79b" />
            <stop offset="100%" stopColor="#d99a6a" />
          </radialGradient>
          <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2a1f" />
            <stop offset="100%" stopColor="#1f1410" />
          </linearGradient>
          <linearGradient id="suit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f7cc7" />
            <stop offset="100%" stopColor="#1f3f7a" />
          </linearGradient>
          <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff9b8a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff9b8a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* shoulders / suit */}
        <path
          d="M30 220 C 40 175, 70 160, 100 160 C 130 160, 160 175, 170 220 Z"
          fill="url(#suit)"
        />
        <path d="M88 162 L100 178 L112 162 L108 200 L92 200 Z" fill="#f5f1ea" />
        <circle cx="100" cy="186" r="3.5" fill="#3f7cc7" />

        {/* neck */}
        <rect x="88" y="148" width="24" height="18" rx="6" fill="#e5b489" />

        {/* head */}
        <g className="head">
          <circle cx="100" cy="100" r="52" fill="url(#face)" />
          <path
            d="M52 92 C 55 55, 95 40, 130 50 C 152 56, 153 80, 150 96 C 138 80, 120 76, 100 78 C 82 80, 68 86, 56 100 Z"
            fill="url(#hair)"
          />
          <ellipse cx="51" cy="104" rx="6" ry="9" fill="#e5b489" />
          <ellipse cx="149" cy="104" rx="6" ry="9" fill="#e5b489" />

          <circle cx="74" cy="116" r="9" fill="url(#cheek)" />
          <circle cx="126" cy="116" r="9" fill="url(#cheek)" />

          <g className="eye eye--left">
            <ellipse cx="82" cy="102" rx="6.5" ry="7.5" fill="#fff" />
            <circle className="pupil" cx="82" cy="103" r="3.4" fill="#1c1a17" />
            <circle cx="83.5" cy="101" r="1.1" fill="#fff" />
          </g>
          <g className="eye eye--right">
            <ellipse cx="118" cy="102" rx="6.5" ry="7.5" fill="#fff" />
            <circle className="pupil" cx="118" cy="103" r="3.4" fill="#1c1a17" />
            <circle cx="119.5" cy="101" r="1.1" fill="#fff" />
          </g>

          <path
            d="M73 91 Q 82 87 91 91"
            stroke="#2b1d15"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M109 91 Q 118 87 127 91"
            stroke="#2b1d15"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />

          <g fill="none" stroke="#1c1a17" strokeWidth="2">
            <circle cx="82" cy="102" r="11" />
            <circle cx="118" cy="102" r="11" />
            <path d="M93 102 L 107 102" />
            <path d="M71 99 L 60 96" />
            <path d="M129 99 L 140 96" />
          </g>

          <path
            d="M100 110 Q 96 122 100 126 Q 104 124 102 120"
            stroke="#b9805a"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />

          <g className="mouth">
            <ellipse className="mouth-shape" cx="100" cy="138" rx="9" ry="3" fill="#3a1a18" />
            <rect className="mouth-line" x="92" y="137" width="16" height="2.4" rx="1.2" fill="#3a1a18" />
            <path className="tongue" d="M94 139 Q 100 144 106 139 Z" fill="#d24a4a" />
          </g>
        </g>

        {/* tiny AI antenna */}
        <g className="antenna">
          <line x1="100" y1="48" x2="100" y2="36" stroke="#2b1d15" strokeWidth="2" strokeLinecap="round" />
          <circle cx="100" cy="33" r="4" fill="#2dd4a4">
            <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>

      <div className="wave" aria-hidden>
        {Array.from({ length: WAVE_BAR_COUNT }).map((_, index) => (
          <span key={index} style={{ ["--i" as never]: index }} />
        ))}
      </div>
    </div>
  );
}

export const TeacherAvatar = memo(TeacherAvatarComponent);
