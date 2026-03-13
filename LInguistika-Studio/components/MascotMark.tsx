import React, { useEffect, useRef, useState } from 'react';

type MascotMarkProps = {
  size?: number;
  className?: string;
  trackMouse?: boolean;
  maxPupilOffset?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const MascotMark: React.FC<MascotMarkProps> = ({
  size = 30,
  className = '',
  trackMouse = true,
  maxPupilOffset = 2.4,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!trackMouse || typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;

    const handlePointerMove = (event: PointerEvent) => {
      if (!wrapperRef.current) return;

      const rect = wrapperRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;

      const distance = Math.hypot(dx, dy);
      const scale = Math.min(distance / 90, 1);
      const angle = Math.atan2(dy, dx);
      const x = Math.cos(angle) * maxPupilOffset * scale;
      const y = Math.sin(angle) * maxPupilOffset * scale;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPupilOffset({ x, y }));
    };

    const resetEyes = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPupilOffset({ x: 0, y: 0 }));
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('blur', resetEyes);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('blur', resetEyes);
    };
  }, [trackMouse, maxPupilOffset]);

  const faceOffset = {
    x: clamp(pupilOffset.x * 0.55, -1.8, 1.8),
    y: clamp(pupilOffset.y * 0.35, -1.2, 1.2),
  };

  return (
    <div ref={wrapperRef} className={className} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
        <path d="M 50 20 Q 30 20 30 40 L 30 160 Q 30 180 50 180 L 100 180 L 100 20 Z" fill="#FFC800" />
        <path d="M 100 20 L 100 180 L 150 180 Q 170 180 170 160 L 170 40 Q 170 20 150 20 Z" fill="#00AEEF" />

        <g transform={`translate(${faceOffset.x} ${faceOffset.y})`}>
          <ellipse cx="60" cy="70" rx="8" ry="12" fill="#051026" />
          <ellipse cx="140" cy="70" rx="8" ry="12" fill="#051026" />
          <path
            d="M 70 110 Q 100 138 130 110"
            stroke="#051026"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
};