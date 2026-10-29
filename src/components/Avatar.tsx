import React from 'react';
import { avatarById } from '../data/avatars';
import { cx } from '../lib/utils';

export const Avatar: React.FC<{
  id?: string;
  size?: number;
  hat?: string;
  trail?: string;
  className?: string;
  ring?: boolean;
}> = ({ id, size = 44, hat, trail, className, ring }) => {
  const a = avatarById(id);
  const hatDef = hat ? avatarById(hat) : null;
  return (
    <span
      className={cx('relative inline-flex shrink-0 items-center justify-center rounded-2xl', ring && 'ring-2 ring-gold-300 ring-offset-2', className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${a.from}, ${a.to})`,
        fontSize: size * 0.52,
        boxShadow: trail ? `0 0 0 3px ${a.from}55` : undefined,
      }}
      aria-hidden="true"
    >
      <span className="leading-none drop-shadow-sm">{a.emoji}</span>
      {hatDef && (
        <span
          className="absolute -top-1.5 -right-1"
          style={{ fontSize: size * 0.42 }}
          aria-hidden="true"
        >
          {hatDef.emoji}
        </span>
      )}
    </span>
  );
};

export const AvatarChip: React.FC<{
  name: string;
  avatarId?: string;
  size?: number;
  sub?: string;
  className?: string;
}> = ({ name, avatarId, size = 36, sub, className }) => (
  <span className={cx('inline-flex items-center gap-2 min-w-0', className)}>
    <Avatar id={avatarId} size={size} />
    <span className="min-w-0">
      <span className="block truncate text-sm font-bold text-navy-700">{name}</span>
      {sub && <span className="block truncate text-[11px] text-navy-300">{sub}</span>}
    </span>
  </span>
);
