import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Btn, Card, EmptyState, ProgressBar, SectionHeader, Stat } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { formatDateTime, formatMs } from '../../lib/utils';
import { modeById } from '../../data/modes';
import { exportReportCsv } from '../../lib/exports';

export const GameReportPage: React.FC = () => {
  const { reportId = '' } = useParams();
  const { db } = useApp();
  const report = db.reports.find((r) => r.id === reportId);

  if (!report) {
    return (
      <div className="page-tight py-16 text-center">
        <div className="text-5xl">🎮</div>
        <h1 className="font-display text-2xl font-bold text-navy-700 mt-3">Report not found</h1>
        <Link to="/teacher/gradebook" className="inline-block mt-4">
          <Btn>Back to gradebook</Btn>
        </Link>
      </div>
    );
  }

  const sorted = [...report.players].sort((a, b) => b.score - a.score);
  const avgScore = sorted.length ? Math.round(sorted.reduce((a, p) => a + p.score, 0) / sorted.length) : 0;
  const avgCorrect = sorted.length
    ? Math.round(sorted.reduce((a, p) => a + (p.total ? (p.correct / p.total) * 100 : 0), 0) / sorted.length)
    : 0;
  const hardest = [...report.questionStats].sort((a, b) => a.correctPct - b.correctPct)[0];

  return (
    <div className="page">
      <button onClick={() => history.back()} className="text-sm font-bold text-navy-300 hover:text-navy-600">
        ← Back
      </button>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">{report.title}</h1>
          <p className="text-sm text-navy-300 mt-1">
            {modeById(report.mode).emoji} {modeById(report.mode).name} · played {formatDateTime(report.endedAt)} ·{' '}
            {report.players.length} players
          </p>
        </div>
        <div className="flex gap-2">
          <Btn size="sm" variant="ghost" onClick={() => exportReportCsv(report)}>
            ⬇️ Export CSV
          </Btn>
          <Link to={`/teacher/editor/${report.quizId}`}>
            <Btn size="sm" variant="ghost">
              Open quiz
            </Btn>
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Players" value={report.players.length} tone="navy" icon="🦅" />
        <Stat label="Average score" value={avgScore.toLocaleString()} tone="teal" icon="🎯" />
        <Stat label="Average accuracy" value={`${avgCorrect}%`} tone="sage" icon="✅" />
        <Stat
          label="Hardest question"
          value={hardest ? `${hardest.correctPct}%` : '—'}
          hint={hardest?.text.slice(0, 40)}
          tone="red"
          icon="🧠"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card pad={false}>
          <div className="p-4">
            <SectionHeader title="Final standings" subtitle="Scores include arcade bonuses." />
          </div>
          <div className="table-wrap border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Score</th>
                  <th>Correct</th>
                  <th>Streak</th>
                  <th>Coins</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.id}>
                    <td className="font-bold text-navy-300">{i + 1}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <Avatar id={p.avatarId} size={26} />
                        <span className="font-bold">{p.name}</span>
                        {p.isGuest && <span className="badge-navy">guest</span>}
                      </span>
                    </td>
                    <td className="font-bold">{p.score.toLocaleString()}</td>
                    <td>
                      {p.correct}/{p.total}
                    </td>
                    <td>{p.bestStreak}</td>
                    <td className="text-gold-600">🪙 {p.coins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sorted.length === 0 && <EmptyState emoji="🦅" title="No players recorded" />}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Question analysis" subtitle="Where the class struggled." />
          <div className="space-y-3">
            {report.questionStats.map((q, i) => (
              <div key={q.questionId}>
                <div className="flex items-start justify-between gap-2 text-sm">
                  <span className="font-semibold text-navy-700">
                    {i + 1}. {q.text}
                  </span>
                  <span className="shrink-0 font-bold">{q.correctPct}%</span>
                </div>
                <div className="mt-1">
                  <ProgressBar
                    value={q.correctPct}
                    tone={q.correctPct >= 70 ? 'sage' : q.correctPct >= 40 ? 'gold' : 'red'}
                    label={`Question ${i + 1} correctness`}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-navy-300">
                  {q.attempts} attempts · avg {formatMs(q.avgMs)}
                  {q.mostChosenWrong && ` · most-chosen wrong: “${q.mostChosenWrong.text}” (${q.mostChosenWrong.count})`}
                </p>
              </div>
            ))}
            {report.questionStats.length === 0 && <EmptyState emoji="📊" title="No question data" />}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionHeader title="Teaching next steps" />
        <ul className="space-y-1.5 text-sm text-navy-500">
          {hardest && (
            <li>
              🔁 Re-teach <strong>{hardest.text}</strong> — only {hardest.correctPct}% answered correctly
              {hardest.mostChosenWrong ? `, and ${hardest.mostChosenWrong.count} learners chose “${hardest.mostChosenWrong.text}”` : ''}.
            </li>
          )}
          <li>🤝 Learners below 50%: {sorted.filter((p) => p.total && p.correct / p.total < 0.5).map((p) => p.name).join(', ') || 'none'}</li>
          <li>🌟 Learners at 90%+: {sorted.filter((p) => p.total && p.correct / p.total >= 0.9).map((p) => p.name).join(', ') || 'none'}</li>
          <li>🎮 Total arcade coins earned in this game: {sorted.reduce((a, p) => a + p.coins, 0)}</li>
        </ul>
      </Card>
    </div>
  );
};
