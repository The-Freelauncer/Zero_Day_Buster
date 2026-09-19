import React, { useId } from 'react';

/*
  PwnArmor mark
  -------------
  A shield sheared along a diagonal fault line: the two halves are offset,
  and the gap between them glows. That gap is the idea — a zero-day is the
  seam in armour that nobody patched yet. Reads cleanly down to 16px because
  the silhouette stays a shield and the fracture stays a single line.

  <BrandMark />    -> icon only (favicon, header, app tile)
  <BrandLockup />  -> icon + wordmark + descriptor
*/

export function BrandMark({ size = 32, className = '', title = 'PwnArmor' }) {
  const uid = useId().replace(/:/g, '');
  const top = `pa-top-${uid}`;
  const bottom = `pa-bot-${uid}`;
  const glow = `pa-glow-${uid}`;

  const shield =
    'M16 2.2 L28.4 6.9 L28.4 16.8 C28.4 23.6 23.1 28.6 16 30.4 ' +
    'C8.9 28.6 3.6 23.6 3.6 16.8 L3.6 6.9 Z';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={top}>
          <polygon points="0,0 32,0 32,12.6 0,20.4" />
        </clipPath>
        <clipPath id={bottom}>
          <polygon points="0,20.4 32,12.6 32,32 0,32" />
        </clipPath>
        <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* upper half, pushed right */}
      <g clipPath={`url(#${top})`}>
        <path
          d={shield}
          transform="translate(1.15 -0.7)"
          fill="var(--mark-fill, rgba(91,140,255,0.13))"
          stroke="var(--mark-stroke, #5b8cff)"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
      </g>

      {/* lower half, pushed left */}
      <g clipPath={`url(#${bottom})`}>
        <path
          d={shield}
          transform="translate(-1.15 0.7)"
          fill="var(--mark-fill, rgba(91,140,255,0.13))"
          stroke="var(--mark-stroke, #5b8cff)"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
      </g>

      {/* the fault line */}
      <line
        x1="2.6"
        y1="21.2"
        x2="29.4"
        y2="14.6"
        stroke="var(--mark-seam, #2ee6c5)"
        strokeWidth="1.9"
        strokeLinecap="round"
        filter={`url(#${glow})`}
      />
    </svg>
  );
}

export function BrandLockup({
  size = 34,
  descriptor = 'Zero Day Buster',
  className = '',
}) {
  return (
    <span className={`zdb-lockup ${className}`}>
      <BrandMark size={size} />
      <span className="zdb-lockup-text">
        <span className="zdb-lockup-name">PwnArmor</span>
        {descriptor && <span className="zdb-lockup-descriptor">{descriptor}</span>}
      </span>
    </span>
  );
}

export default BrandMark;
