import React from 'react';
import { Link } from 'react-router-dom';
import { Card, Logo } from '../components/ui';

export const Privacy: React.FC = () => (
  <div className="page-tight py-8">
    <div className="flex items-center gap-3">
      <Logo size={52} />
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-700">Privacy & safeguarding</h1>
        <p className="text-sm text-navy-300">Written for Eastbridge International School, Accra — 2026/27</p>
      </div>
    </div>

    <Card className="mt-5 space-y-5 text-sm leading-relaxed text-navy-500">
      <section>
        <h2 className="font-display text-lg font-bold text-navy-700">What we collect (and what we do not)</h2>
        <p className="mt-1">
          Learners are identified by a first name, a class, an avatar and a school-issued code. We do not ask children for
          email addresses, phone numbers, photos, dates of birth or home addresses. Guests joining a live game only type a
          nickname.
        </p>
        <p className="mt-2">
          There are <strong>no ads, no third-party analytics, no trackers and no social logins</strong>. Nothing is sold or
          shared with advertisers.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-navy-700">Ghana Data Protection Act, 2012 (Act 843)</h2>
        <ul className="mt-1 list-disc pl-5 space-y-1">
          <li>
            <strong>Purpose limitation:</strong> data is used only for teaching, assessment and the arcade reward system.
          </li>
          <li>
            <strong>Minimisation:</strong> only the fields needed for a quiz and a score are stored.
          </li>
          <li>
            <strong>Security:</strong> row-level security in Postgres means a teacher sees only their classes and a learner
            sees only their own results. Images use signed URLs.
          </li>
          <li>
            <strong>Retention:</strong> the ICT office sets the retention window; teachers can delete a quiz or assignment at
            any time, and the admin can deactivate a learner account.
          </li>
          <li>
            <strong>Rights:</strong> a parent or guardian can ask the school for a copy of their child&apos;s data, or ask
            for it to be corrected or erased, by contacting the ICT office.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-navy-700">Safety features in the product</h2>
        <ul className="mt-1 list-disc pl-5 space-y-1">
          <li>No free-text chat between learners — only eight preset emoji reactions.</li>
          <li>Nicknames are filtered locally for profanity, links, emails and long digit strings.</li>
          <li>Teachers can hide learner names on a leaderboard, lock the lobby and kick a participant.</li>
          <li>Minigames are school-safe: no gore, no realistic weapons, no external links.</li>
          <li>Arcade passes are issued only after a verified correct answer and expire with a server timestamp.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-navy-700">Accessibility</h2>
        <p className="mt-1">
          Every control is keyboard reachable with a visible focus ring, touch targets are at least 44px, colours are checked
          for AA contrast and a colour-blind-safe arcade palette is used. Text size, sound, motion and image loading can all
          be adjusted in Settings.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-navy-700">Where data lives</h2>
        <p className="mt-1">
          In production this app runs on Supabase with row-level security. In demo mode everything stays in this browser&apos;s
          local storage and never leaves the device.
        </p>
      </section>

      <p className="text-xs text-navy-300">
        Questions about this policy? Contact the Eastbridge ICT office. <Link to="/" className="font-bold text-teal-500">Back to home</Link>
      </p>
    </Card>
  </div>
);
