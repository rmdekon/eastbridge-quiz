import type { MiniGame, MiniGameManifest } from '../types';
import { MANIFESTS } from './manifests';

/**
 * Plugin registry. To add a game:
 *  1. create src/minigames/YourGame.ts exporting `export default () => new YourGame()`
 *     where YourGame extends BaseGame and passes a manifest to super().
 *  2. add its manifest to MANIFESTS below.
 *  3. add a lazy loader to LOADERS.
 * That's it — the picker, teacher toggles, admin panel and arcade break pick them up.
 */


export const LOADERS: Record<string, () => Promise<{ default: new () => MiniGame }>> = {
  'crew-sabotage': () => import('./CrewSabotage'),
  'blaster-arena': () => import('./BlasterArena'),
  'eagle-run': () => import('./EagleRun'),
  'neon-slope': () => import('./NeonSlope'),
  'sky-hop': () => import('./SkyHop'),
  'tower-stack': () => import('./TowerStack'),
  'kart-dash': () => import('./KartDash'),
  'hoop-shot': () => import('./HoopShot'),
  'fruit-slash': () => import('./FruitSlash'),
  'gold-rush': () => import('./GoldRush'),
};

export { MANIFESTS };
export const MINIGAME_MANIFESTS = MANIFESTS;

export const getManifest = (id: string) => MANIFESTS.find((m) => m.id === id);

/** Games suitable for a year group and not disabled by the admin. */
export const gamesForYear = (year: number, disabled: string[] = []): MiniGameManifest[] =>
  MANIFESTS.filter((m) => year >= m.minYear && year <= m.maxYear && !disabled.includes(m.id));

export const loadMinigame = async (id: string): Promise<MiniGame> => {
  const loader = LOADERS[id];
  if (!loader) throw new Error(`Unknown minigame: ${id}`);
  const mod = await loader();
  return new mod.default();
};

export const pickSurpriseGame = (year: number, disabled: string[] = []): MiniGameManifest | undefined => {
  const pool = gamesForYear(year, disabled);
  return pool[Math.floor(Math.random() * pool.length)];
};
