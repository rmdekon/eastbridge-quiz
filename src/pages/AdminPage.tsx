import React, { useMemo, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Btn, Card, ConfirmDialog, EmptyState, Field, Modal, SectionHeader, Stat, Tabs, Toggle } from '../components/ui';
import { useApp } from '../store/AppStore';
import { MINIGAME_MANIFESTS } from '../minigames/registry';
import { SUBJECTS, type ClassRoom, type Profile } from '../types';
import { formatDate, uid } from '../lib/utils';
import { generateLearnerPin, generateSchoolCode } from '../lib/codes';

type EditorState =
  | { kind: 'teacher'; profile: Profile }
  | { kind: 'learner'; profile: Profile }
  | { kind: 'class'; classroom: ClassRoom }
  | null;

export const AdminPage: React.FC = () => {
  const { db, saveProfile, saveClass, deleteClass, deleteProfile, saveOrgSettings, resetDemo, notify } = useApp();
  const [tab, setTab] = useState<'staff' | 'classes' | 'learners' | 'arcade' | 'school'>('staff');
  const [editor, setEditor] = useState<EditorState>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [search, setSearch] = useState('');

  const staff = db.profiles.filter((p) => p.role === 'admin' || p.role === 'teacher');
  const learners = useMemo(
    () =>
      db.profiles
        .filter((p) => p.role === 'learner')
        .filter(
          (p) =>
            !search ||
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
            (p.schoolCode ?? '').toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => (a.schoolCode ?? '').localeCompare(b.schoolCode ?? '')),
    [db.profiles, search],
  );

  const newTeacher = (): Profile => ({
    id: uid('p'),
    role: 'teacher',
    firstName: '',
    lastName: '',
    email: '',
    avatarId: 'eagle-navy',
    coins: 0,
    xp: 0,
    ownedItems: ['eagle-navy'],
    badges: [],
    active: true,
    createdAt: new Date().toISOString(),
  });

  const newLearner = (): Profile => ({
    id: uid('p'),
    role: 'learner',
    firstName: '',
    lastName: '',
    classId: db.classes[0]?.id,
    schoolCode: '',
    pin: generateLearnerPin(),
    avatarId: 'eagle-gold',
    coins: 0,
    xp: 0,
    ownedItems: ['eagle-navy'],
    badges: [],
    active: true,
    createdAt: new Date().toISOString(),
  });

  const newClass = (): ClassRoom => ({
    id: uid('c'),
    name: '',
    yearGroup: 5,
    teacherIds: [],
    code: '',
    createdAt: new Date().toISOString(),
  });

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gold-600">ICT office · Admin</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">School administration</h1>
          <p className="text-sm text-navy-300 mt-1">Teachers, classes, learners, arcade policy and grade bands.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn
            variant="ghost"
            onClick={() => {
              const csv = [
                'schoolCode,firstName,lastName,class,pin,coins',
                ...learners.map((l) => `${l.schoolCode},${l.firstName},${l.lastName},${db.classes.find((c) => c.id === l.classId)?.name ?? ''},${l.pin},${l.coins}`),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'eastbridge-learners.csv';
              a.click();
            }}
          >
            ⬇️ Learner codes
          </Btn>
          <Btn variant="danger" onClick={() => setConfirmReset(true)}>
            ♻️ Reset demo data
          </Btn>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Teachers" value={staff.filter((s) => s.role === 'teacher').length} tone="navy" icon="🧑‍🏫" />
        <Stat label="Classes" value={db.classes.length} tone="teal" icon="🏫" />
        <Stat label="Learners" value={db.profiles.filter((p) => p.role === 'learner').length} tone="gold" icon="🦅" />
        <Stat label="Quizzes" value={db.quizzes.length} tone="sage" icon="📚" />
      </div>

      <div className="mt-4">
        <Tabs
          tabs={[
            { id: 'staff', label: 'Teachers', count: staff.length },
            { id: 'classes', label: 'Classes', count: db.classes.length },
            { id: 'learners', label: 'Learners', count: learners.length },
            { id: 'arcade', label: 'Minigames' },
            { id: 'school', label: 'School & grades' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
        />
      </div>

      {tab === 'staff' && (
        <Card className="mt-4" pad={false}>
          <div className="flex items-center justify-between p-3">
            <h2 className="font-display font-bold text-navy-700">Teacher accounts</h2>
            <Btn size="sm" onClick={() => setEditor({ kind: 'teacher', profile: newTeacher() })}>
              + Add teacher
            </Btn>
          </div>
          <div className="table-wrap border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Classes</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {staff.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <Avatar id={t.avatarId} size={28} />
                        <span className="font-bold">
                          {t.firstName} {t.lastName}
                        </span>
                      </span>
                    </td>
                    <td className="text-xs">{t.email ?? '—'}</td>
                    <td className="capitalize">{t.role}</td>
                    <td className="text-xs">
                      {db.classes.filter((c) => c.teacherIds.includes(t.id)).map((c) => c.name).join(', ') || '—'}
                    </td>
                    <td>
                      <span className={t.active ? 'badge-sage' : 'badge-red'}>{t.active ? 'Active' : 'Disabled'}</span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Btn size="sm" variant="ghost" onClick={() => setEditor({ kind: 'teacher', profile: t })}>
                          Edit
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await saveProfile({ ...t, active: !t.active });
                            notify(t.active ? 'Account disabled' : 'Account enabled');
                          }}
                        >
                          {t.active ? 'Disable' : 'Enable'}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="p-3 text-xs text-navy-300">
            In production, accounts are created through Supabase Auth invitations. Local demo mode signs in with the password
            “eastbridge”.
          </p>
        </Card>
      )}

      {tab === 'classes' && (
        <Card className="mt-4" pad={false}>
          <div className="flex items-center justify-between p-3">
            <h2 className="font-display font-bold text-navy-700">Classes · Years 1–9</h2>
            <Btn size="sm" onClick={() => setEditor({ kind: 'class', classroom: newClass() })}>
              + Add class
            </Btn>
          </div>
          <div className="table-wrap border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Year</th>
                  <th>Code</th>
                  <th>Teachers</th>
                  <th>Learners</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {db.classes.map((c) => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.name}</td>
                    <td>Year {c.yearGroup}</td>
                    <td>{c.code}</td>
                    <td className="text-xs">
                      {c.teacherIds.map((id) => db.profiles.find((p) => p.id === id)?.lastName).filter(Boolean).join(', ') || '—'}
                    </td>
                    <td>{db.profiles.filter((p) => p.classId === c.id).length}</td>
                    <td>
                      <Btn size="sm" variant="ghost" onClick={() => setEditor({ kind: 'class', classroom: c })}>
                        Edit
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {db.classes.length === 0 && <EmptyState emoji="🏫" title="No classes yet" />}
          </div>
        </Card>
      )}

      {tab === 'learners' && (
        <Card className="mt-4" pad={false}>
          <div className="flex flex-wrap items-center gap-2 p-3">
            <h2 className="font-display font-bold text-navy-700">Learner accounts</h2>
            <input
              className="input !min-h-[44px] !py-2 text-sm max-w-[240px] ml-auto"
              placeholder="Search name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search learners"
            />
            <Btn size="sm" onClick={() => setEditor({ kind: 'learner', profile: newLearner() })}>
              + Add learner
            </Btn>
          </div>
          <div className="table-wrap border-0 max-h-[520px] overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>School code</th>
                  <th>PIN</th>
                  <th>Class</th>
                  <th>Coins</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {learners.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <Avatar id={l.avatarId} size={26} />
                        <span className="font-bold">
                          {l.firstName} {l.lastName}
                        </span>
                      </span>
                    </td>
                    <td className="font-mono text-xs">{l.schoolCode}</td>
                    <td className="font-mono text-xs">{l.pin}</td>
                    <td>{db.classes.find((c) => c.id === l.classId)?.name ?? '—'}</td>
                    <td>🪙 {l.coins}</td>
                    <td>
                      <span className={l.active ? 'badge-sage' : 'badge-red'}>{l.active ? 'Active' : 'Disabled'}</span>
                    </td>
                    <td>
                      <Btn size="sm" variant="ghost" onClick={() => setEditor({ kind: 'learner', profile: l })}>
                        Edit
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="p-3 text-xs text-navy-300">
            Learner IDs collect only a first name, last name, class and school code — no email required. PINs can be reset at
            any time.
          </p>
        </Card>
      )}

      {tab === 'arcade' && (
        <Card className="mt-4">
          <SectionHeader
            title="Minigame policy"
            subtitle="Turn a game off to hide it from every teacher, learner and assignment."
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {MINIGAME_MANIFESTS.map((g) => {
              const off = db.settings.minigamesDisabled.includes(g.id);
              return (
                <div key={g.id} className="flex items-center gap-3 rounded-2xl border border-navy-100 p-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: g.thumbnail }} aria-hidden="true">
                    {g.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-navy-700">{g.name}</p>
                    <p className="text-[11px] text-navy-300">
                      Years {g.minYear}–{g.maxYear}
                    </p>
                  </div>
                  <Toggle
                    label={`Enable ${g.name}`}
                    checked={!off}
                    onChange={(v) =>
                      saveOrgSettings({
                        ...db.settings,
                        minigamesDisabled: v
                          ? db.settings.minigamesDisabled.filter((id) => id !== g.id)
                          : [...db.settings.minigamesDisabled, g.id],
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-2xl bg-navy-50 p-3 text-xs text-navy-500">
            <p>
              <strong>Anti-cheat:</strong> a one-time signed pass is issued only after a verified correct answer. Break length
              is enforced by timestamps, and arcade bonuses are capped at 20% of the question value.
            </p>
          </div>
        </Card>
      )}

      {tab === 'school' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionHeader title="School profile" />
            <div className="space-y-3">
              <Field label="School name" htmlFor="school-name">
                <input
                  id="school-name"
                  className="input"
                  value={db.settings.schoolName}
                  onChange={(e) => saveOrgSettings({ ...db.settings, schoolName: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Academic year" htmlFor="acad-year">
                  <input
                    id="acad-year"
                    className="input"
                    value={db.settings.academicYear}
                    onChange={(e) => saveOrgSettings({ ...db.settings, academicYear: e.target.value })}
                  />
                </Field>
                <Field label="Current term" htmlFor="term">
                  <select
                    id="term"
                    className="input"
                    value={db.settings.term}
                    onChange={(e) => saveOrgSettings({ ...db.settings, term: e.target.value })}
                  >
                    <option>Term 1</option>
                    <option>Term 2</option>
                    <option>Term 3</option>
                  </select>
                </Field>
              </div>
              <div>
                <span className="label">Subjects offered</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUBJECTS.map((s) => (
                    <span key={s} className="badge-navy">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Grade bands" subtitle="Configurable for the 2026/27 reporting cycle." />
            <div className="space-y-2">
              {db.settings.gradeBands.map((b, i) => (
                <div key={b.grade} className="flex items-center gap-2">
                  <span className="w-10 font-display font-bold text-navy-700">{b.grade}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input !min-h-[44px] !py-2"
                    value={b.min}
                    aria-label={`${b.grade} minimum percentage`}
                    onChange={(e) => {
                      const bands = [...db.settings.gradeBands];
                      bands[i] = { ...b, min: Number(e.target.value) };
                      void saveOrgSettings({ ...db.settings, gradeBands: bands });
                    }}
                  />
                  <span className="text-xs text-navy-300">% and above</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-navy-300">Grades are recalculated across the gradebook instantly.</p>
          </Card>

          <Card className="lg:col-span-2">
            <SectionHeader title="Data & privacy" />
            <div className="grid gap-2 text-sm text-navy-500 sm:grid-cols-2">
              <p>✅ No third-party analytics or ads are loaded.</p>
              <p>✅ Learner names, classes and scores only.</p>
              <p>✅ Row-level security in Supabase isolates each class.</p>
              <p>✅ Signed image URLs for quiz pictures.</p>
              <p>✅ Nickname profanity filter for guest joins.</p>
              <p>✅ Preset emoji reactions only — no chat.</p>
            </div>
            <p className="mt-3 text-xs text-navy-300">
              Designed with Ghana&apos;s Data Protection Act, 2012 (Act 843) in mind. Export or erase learner data from this
              page on request.
            </p>
          </Card>

          <Card className="lg:col-span-2">
            <SectionHeader title="Danger zone" />
            <div className="flex flex-wrap items-center gap-3">
              <Btn variant="danger" onClick={() => setConfirmReset(true)}>
                Reset all demo data
              </Btn>
              <p className="text-xs text-navy-300">
                Restores the three sample quizzes, classes and learners. Local demo mode only.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* editors */}
      {editor?.kind === 'teacher' && (
        <ProfileEditor
          profile={editor.profile}
          onClose={() => setEditor(null)}
          onSave={async (p) => {
            await saveProfile({ ...p, role: p.role === 'admin' ? 'admin' : 'teacher' });
            notify('Teacher saved');
            setEditor(null);
          }}
          classes={db.classes}
        />
      )}
      {editor?.kind === 'learner' && (
        <ProfileEditor
          profile={editor.profile}
          learner
          classes={db.classes}
          onClose={() => setEditor(null)}
          onSave={async (p) => {
            const classroom = db.classes.find((c) => c.id === p.classId);
            const code =
              p.schoolCode ||
              generateSchoolCode(
                classroom?.yearGroup ?? 1,
                classroom?.code.slice(-1) ?? 'A',
                db.profiles.filter((x) => x.role === 'learner' && x.classId === p.classId).length + 1,
              );
            await saveProfile({ ...p, role: 'learner', schoolCode: code });
            notify('Learner saved');
            setEditor(null);
          }}
        />
      )}
      {editor?.kind === 'class' && (
        <ClassEditor
          classroom={editor.classroom}
          teachers={staff.filter((s) => s.role === 'teacher')}
          onClose={() => setEditor(null)}
          onSave={async (c) => {
            await saveClass({ ...c, code: c.code || `EB${c.yearGroup}${(c.name.split(' ')[1] ?? 'A').slice(0, 1).toUpperCase()}` });
            setEditor(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Reset all demo data?"
        body="Every quiz, assignment, submission and account in this browser returns to the seeded demo. This cannot be undone."
        destructive
        confirmLabel="Reset everything"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          await resetDemo();
          setConfirmReset(false);
          notify('Demo data restored');
        }}
      />
    </div>
  );
};

const ProfileEditor: React.FC<{
  profile: Profile;
  learner?: boolean;
  classes: ClassRoom[];
  onClose: () => void;
  onSave: (p: Profile) => void | Promise<void>;
}> = ({ profile, learner, classes, onClose, onSave }) => {
  const [draft, setDraft] = useState(profile);
  return (
    <Modal
      open
      onClose={onClose}
      title={learner ? (profile.firstName ? 'Edit learner' : 'Add learner') : profile.firstName ? 'Edit teacher' : 'Add teacher'}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn onClick={() => onSave(draft)}>Save</Btn>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="First name" htmlFor="p-first" required>
            <input
              id="p-first"
              className="input"
              value={draft.firstName}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
            />
          </Field>
          <Field label="Last name" htmlFor="p-last" required>
            <input id="p-last" className="input" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          </Field>
        </div>
        {!learner ? (
          <>
            <Field label="School email" htmlFor="p-email" required>
              <input
                id="p-email"
                type="email"
                className="input"
                value={draft.email ?? ''}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="firstname.lastname@eastbridge.edu.gh"
              />
            </Field>
            <Field label="Role" htmlFor="p-role">
              <select id="p-role" className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Profile['role'] })}>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin (ICT head)</option>
              </select>
            </Field>
            <Field label="Classes taught" htmlFor="p-classes">
              <div className="max-h-40 overflow-y-auto rounded-xl border border-navy-100 p-2">
                {classes.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal-500"
                      checked={c.teacherIds.includes(draft.id)}
                      readOnly
                      onClick={() => undefined}
                      aria-label={c.name}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              <p className="hint">Assign classes from the Classes tab (class editor).</p>
            </Field>
          </>
        ) : (
          <>
            <Field label="Class" htmlFor="p-class">
              <select id="p-class" className="input" value={draft.classId ?? ''} onChange={(e) => setDraft({ ...draft, classId: e.target.value })}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="School code" htmlFor="p-code" hint="Leave blank to auto-generate">
                <input
                  id="p-code"
                  className="input font-mono"
                  value={draft.schoolCode ?? ''}
                  onChange={(e) => setDraft({ ...draft, schoolCode: e.target.value.toUpperCase() })}
                  placeholder="EB-5A-013"
                />
              </Field>
              <Field label="4-digit PIN" htmlFor="p-pin">
                <div className="flex gap-1">
                  <input
                    id="p-pin"
                    className="input font-mono"
                    value={draft.pin ?? ''}
                    onChange={(e) => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  />
                  <Btn type="button" size="sm" variant="ghost" onClick={() => setDraft({ ...draft, pin: generateLearnerPin() })}>
                    ↻
                  </Btn>
                </div>
              </Field>
            </div>
          </>
        )}
        <Toggle label="Account active" checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} />
        <p className="text-xs text-navy-300">Created {formatDate(draft.createdAt)}</p>
      </div>
    </Modal>
  );
};

const ClassEditor: React.FC<{
  classroom: ClassRoom;
  teachers: Profile[];
  onClose: () => void;
  onSave: (c: ClassRoom) => void | Promise<void>;
}> = ({ classroom, teachers, onClose, onSave }) => {
  const [draft, setDraft] = useState(classroom);
  return (
    <Modal
      open
      onClose={onClose}
      title={classroom.name ? 'Edit class' : 'Add class'}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn onClick={() => onSave(draft)}>Save</Btn>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Class name" htmlFor="c-name" required hint="e.g. 5 Aurora">
          <input id="c-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Year group" htmlFor="c-year">
            <select
              id="c-year"
              className="input"
              value={draft.yearGroup}
              onChange={(e) => setDraft({ ...draft, yearGroup: Number(e.target.value) as ClassRoom['yearGroup'] })}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class code" htmlFor="c-code" hint="Used in learner IDs">
            <input
              id="c-code"
              className="input font-mono"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              placeholder={`EB${draft.yearGroup}A`}
            />
          </Field>
        </div>
        <div>
          <span className="label">Teachers</span>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-navy-100 p-2">
            {teachers.map((t) => {
              const on = draft.teacherIds.includes(t.id);
              return (
                <label key={t.id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-500"
                    checked={on}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        teacherIds: on ? draft.teacherIds.filter((id) => id !== t.id) : [...draft.teacherIds, t.id],
                      })
                    }
                  />
                  {t.firstName} {t.lastName}
                </label>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-navy-300">
          Class delete is available from the class row actions; learners stay in the system but become unassigned.
        </p>
      </div>
    </Modal>
  );
};
