export interface AvatarDef {
  id: string;
  name: string;
  emoji: string;
  from: string;
  to: string;
  price: number;
  kind: 'skin' | 'hat' | 'trail' | 'base';
}

export const AVATARS: AvatarDef[] = [
  { id: 'eagle-gold', name: 'Gold Eagle', emoji: '🦅', from: '#E0B45C', to: '#C8973A', price: 0, kind: 'base' },
  { id: 'eagle-navy', name: 'Navy Eagle', emoji: '🦅', from: '#2C5490', to: '#1B3A6B', price: 0, kind: 'base' },
  { id: 'eagle-teal', name: 'Teal Eagle', emoji: '🦅', from: '#4FA3B2', to: '#2A7F8F', price: 0, kind: 'base' },
  { id: 'eagle-sage', name: 'Sage Eagle', emoji: '🦅', from: '#C3D8BD', to: '#7FA476', price: 0, kind: 'base' },
  { id: 'skin-sunset', name: 'Sunset Skin', emoji: '🌅', from: '#F7A072', to: '#D1495B', price: 350, kind: 'skin' },
  { id: 'skin-lagoon', name: 'Lagoon Skin', emoji: '🌊', from: '#6FD6C6', to: '#177E89', price: 350, kind: 'skin' },
  { id: 'skin-kente', name: 'Kente Skin', emoji: '🧵', from: '#F4C95D', to: '#B23A48', price: 500, kind: 'skin' },
  { id: 'hat-cap', name: 'Library Cap', emoji: '🧢', from: '#B7CDB3', to: '#7FA476', price: 0, kind: 'hat' },
  { id: 'hat-grad', name: 'Graduation Cap', emoji: '🎓', from: '#2C5490', to: '#1B3A6B', price: 0, kind: 'hat' },
  { id: 'hat-crown', name: 'Eagle Crown', emoji: '👑', from: '#F4C95D', to: '#C8973A', price: 750, kind: 'hat' },
  { id: 'hat-headset', name: 'Quiz Headset', emoji: '🎧', from: '#4FA3B2', to: '#1C5B67', price: 400, kind: 'hat' },
  { id: 'trail-sparkle', name: 'Sparkle Trail', emoji: '✨', from: '#F4C95D', to: '#C8973A', price: 600, kind: 'trail' },
  { id: 'trail-feather', name: 'Feather Trail', emoji: '🪶', from: '#C3D8BD', to: '#7FA476', price: 450, kind: 'trail' },
  { id: 'trail-star', name: 'Star Trail', emoji: '⭐', from: '#6FD6C6', to: '#2A7F8F', price: 700, kind: 'trail' },
];

export const avatarById = (id?: string): AvatarDef =>
  AVATARS.find((a) => a.id === id) ?? AVATARS[0];

export const SHOP_ITEMS = AVATARS.filter((a) => a.price > 0);

export const BADGES: Record<string, { label: string; emoji: string; blurb: string }> = {
  'Scholar Streak': { label: 'Scholar Streak', emoji: '🔥', blurb: 'Answered 5 questions correctly in a row' },
  'Coin Collector': { label: 'Coin Collector', emoji: '🪙', blurb: 'Banked over 900 Eagle Coins' },
  'Perfect Week': { label: 'Perfect Week', emoji: '🌟', blurb: 'Practised every day for a week' },
  'Founder': { label: 'Founder', emoji: '🏛️', blurb: 'Set up the Eastbridge arcade' },
  'Maths Lead': { label: 'Maths Lead', emoji: '➗', blurb: 'Leads Mathematics' },
  'Science Lead': { label: 'Science Lead', emoji: '🔬', blurb: 'Leads Science' },
  'ICT Teacher': { label: 'ICT Teacher', emoji: '💻', blurb: 'Teaches ICT' },
  'Quiz Master': { label: 'Quiz Master', emoji: '🎯', blurb: 'Hosted 10 live games' },
  'Arcade Ace': { label: 'Arcade Ace', emoji: '🕹️', blurb: 'Scored 500+ in a minigame break' },
};
