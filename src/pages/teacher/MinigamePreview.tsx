import React, { useState } from 'react';
import { ArcadeBreak } from '../../arcade/ArcadeBreak';
import { Btn, Card, Modal, SectionHeader, Toggle } from '../../components/ui';
import { MINIGAME_MANIFESTS } from '../../minigames/registry';
import { useApp } from '../../store/AppStore';
import { cx } from '../../lib/utils';

export const MinigamePreview: React.FC = () => {
  const { db, saveOrgSettings, settings } = useApp();
  const [playing, setPlaying] = useState<string | null>(null);
  const [year, setYear] = useState(5);
  const [duration, setDuration] = useState(60);

  const disabled = db.settings.minigamesDisabled;

  const toggle = (id: string, enabled: boolean) => {
    const next = enabled ? disabled.filter((g) => g !== id) : [...disabled, id];
    void saveOrgSettings({ ...db.settings, minigamesDisabled: next });
  };

  const game = MINIGAME_MANIFESTS.find((g) => g.id === playing);

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">Arcade breaks</h1>
          <p className="text-sm text-navy-300 mt-1">
            Ten original three.js minigames. Try every game here — learners only get them after a correct answer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-sm font-bold text-navy-500 self-center" htmlFor="preview-year">
            Preview as
          </label>
          <select
            id="preview-year"
            className="input !min-h-[44px] !py-2 text-sm w-auto"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => (
              <option key={y} value={y}>
                Year {y} difficulty
              </option>
            ))}
          </select>
          <select
            aria-label="Preview duration"
            className="input !min-h-[44px] !py-2 text-sm w-auto"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {[15, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MINIGAME_MANIFESTS.map((g) => {
          const isDisabled = disabled.includes(g.id);
          const yearOk = year >= g.minYear && year <= g.maxYear;
          return (
            <Card key={g.id} className={cx('flex flex-col', isDisabled && 'opacity-70')}>
              <div
                className="flex h-28 items-center justify-center rounded-2xl text-5xl"
                style={{ background: g.thumbnail }}
                aria-hidden="true"
              >
                {g.emoji}
              </div>
              <div className="mt-3 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display font-bold text-navy-700">{g.name}</h2>
                  {isDisabled && <span className="badge-red">Off</span>}
                </div>
                <p className="text-xs text-navy-300 mt-0.5">{g.tagline}</p>
                <p className="mt-1 text-[11px] text-navy-300">
                  Years {g.minYear}–{g.maxYear} · {g.controls}
                </p>
                {!yearOk && <p className="mt-1 text-[11px] font-bold text-gold-600">Not available for Year {year}</p>}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Btn size="sm" variant="gold" disabled={isDisabled || !yearOk} onClick={() => setPlaying(g.id)}>
                  ▶ Play
                </Btn>
                <label className="flex items-center gap-1 text-[11px] font-bold text-navy-500">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-500"
                    checked={!isDisabled}
                    onChange={(e) => toggle(g.id, e.target.checked)}
                  />
                  Enabled
                </label>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-5">
        <SectionHeader
          title="Engine notes"
          subtitle="What every game guarantees."
        />
        <div className="grid gap-3 text-sm text-navy-500 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['♻️ Pooling & instancing', 'Reused geometry, no per-frame allocations, pixel ratio capped at 1.5.'],
            ['📉 Adaptive quality', 'Effects drop automatically when frames fall below 40 FPS.'],
            ['🧹 Clean disposal', 'Geometries, materials, textures and the renderer are released on exit.'],
            ['📱 Touch + keyboard', 'Every game supports swipe or drag as well as keys.'],
            ['🎚️ Difficulty by year', 'Years 1–3 forgiving, 4–6 medium, 7–9 harder and faster.'],
            ['🕹️ 2D fallback', 'A canvas reaction game takes over when WebGL is unavailable.'],
          ].map(([t, b]) => (
            <div key={t} className="rounded-2xl bg-navy-50 p-3">
              <p className="font-bold text-navy-700">{t}</p>
              <p className="text-xs mt-0.5">{b}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-navy-300">
          Motion is reduced automatically when the viewer prefers reduced motion; sound respects the local audio setting (
          {settings.sound ? 'on' : 'off'}).
        </p>
      </Card>

      <Modal open={Boolean(game)} onClose={() => setPlaying(null)} size="xl" title={game ? `Preview · ${game.name}` : ''}>
        {game && (
          <div className="-m-5 overflow-hidden rounded-b-3xl">
            <ArcadeBreak
              durationSec={duration}
              yearGroup={year}
              allowedGames={[game.id]}
              allowPicker={false}
              skipAllowed
              questionPoints={1000}
              muted={!settings.sound}
              reducedMotion={settings.reducedMotion}
              title={`Teacher preview · ${game.name}`}
              onComplete={() => setPlaying(null)}
              onSkip={() => setPlaying(null)}
            />
          </div>
        )}
      </Modal>

      <div className="mt-4">
        <Toggle
          label="Show instructions for 5 seconds before each break"
          description="Applies to every game. Learners can tap “Start now” to skip the wait."
          checked
          onChange={() => undefined}
        />
      </div>
    </div>
  );
};
