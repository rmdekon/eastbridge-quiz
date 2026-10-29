import type { GameModeMeta } from '../types';

export const GAME_MODES: GameModeMeta[] = [
  {
    id: 'classic',
    name: 'Classic',
    emoji: '⚡',
    blurb: 'Kahoot-style speed points. Faster correct answers score more.',
    minigameBreaks: true,
  },
  {
    id: 'eagle_cash',
    name: 'Eagle Cash',
    emoji: '🪙',
    blurb: 'Gimkit-style economy: bank Eagle Coins, keep streaks, spend on power-ups.',
    minigameBreaks: true,
  },
  {
    id: 'trophy_hunt',
    name: 'Trophy Hunt',
    emoji: '🏆',
    blurb: 'Blooket-style random events: double trophies, steals and shields.',
    minigameBreaks: true,
  },
  {
    id: 'cipher_crack',
    name: 'Cipher Crack',
    emoji: '🔐',
    blurb: 'Every correct answer reveals a letter of the class cipher word.',
    minigameBreaks: true,
  },
  {
    id: 'scholar_swarm',
    name: 'Scholar Swarm',
    emoji: '🐝',
    blurb: 'Fast-fire swarm rounds — quick correct answers earn a speed bonus.',
    minigameBreaks: true,
  },
  {
    id: 'team_battle',
    name: 'Team Battle',
    emoji: '🛡️',
    blurb: 'Two to four houses race together. Team score plus a class-vs-boss bar.',
    minigameBreaks: true,
    teamBased: true,
  },
  {
    id: 'crowd_party',
    name: 'Crowd Party',
    emoji: '🎉',
    blurb: 'Assembly mode: giant QR code, live leaderboard and emoji reactions.',
    minigameBreaks: true,
  },
];

export const modeById = (id: string) => GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];

export const TEAM_NAMES = ['Gold Eagles', 'Navy Eagles', 'Teal Eagles', 'Sage Eagles'];
export const TEAM_COLORS = ['#C8973A', '#1B3A6B', '#2A7F8F', '#7FA476'];
