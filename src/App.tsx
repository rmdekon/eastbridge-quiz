import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from './components/AppShell';
import { Toasts, Spinner } from './components/ui';
import { useApp } from './store/AppStore';
import type { Role } from './types';

import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Join } from './pages/Join';

/**
 * Everything behind a route is code-split. A learner joining a game from a
 * phone only downloads the join screen and the play screen, never the quiz
 * editor, the gradebook exports or three.js.
 */
const Privacy = React.lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })));
const NotFound = React.lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));
const TeacherDashboard = React.lazy(() =>
  import('./pages/teacher/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard })),
);
const QuizLibrary = React.lazy(() => import('./pages/teacher/QuizLibrary').then((m) => ({ default: m.QuizLibrary })));
const QuizEditor = React.lazy(() => import('./pages/teacher/QuizEditor').then((m) => ({ default: m.QuizEditor })));
const ImportPage = React.lazy(() => import('./pages/teacher/ImportPage').then((m) => ({ default: m.ImportPage })));
const AssignmentsPage = React.lazy(() =>
  import('./pages/teacher/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })),
);
const GradebookPage = React.lazy(() =>
  import('./pages/teacher/GradebookPage').then((m) => ({ default: m.GradebookPage })),
);
const GradebookDetail = React.lazy(() =>
  import('./pages/teacher/GradebookDetail').then((m) => ({ default: m.GradebookDetail })),
);
const MinigamePreview = React.lazy(() =>
  import('./pages/teacher/MinigamePreview').then((m) => ({ default: m.MinigamePreview })),
);
const GameReportPage = React.lazy(() =>
  import('./pages/teacher/GameReportPage').then((m) => ({ default: m.GameReportPage })),
);
const AdminPage = React.lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const LearnerHome = React.lazy(() => import('./pages/learner/LearnerHome').then((m) => ({ default: m.LearnerHome })));
const MyTasks = React.lazy(() => import('./pages/learner/MyTasks').then((m) => ({ default: m.MyTasks })));
const TaskPlay = React.lazy(() => import('./pages/learner/TaskPlay').then((m) => ({ default: m.TaskPlay })));
const AvatarShop = React.lazy(() => import('./pages/learner/AvatarShop').then((m) => ({ default: m.AvatarShop })));
const HostGame = React.lazy(() => import('./pages/host/HostGame').then((m) => ({ default: m.HostGame })));
const LivePlay = React.lazy(() => import('./pages/play/LivePlay').then((m) => ({ default: m.LivePlay })));

const FullScreenLoader: React.FC = () => (
  <div className="min-h-dvh grid place-items-center">
    <div className="flex flex-col items-center gap-3 text-navy-400">
      <Spinner size={34} />
      <p className="text-sm font-bold">Loading Eastbridge Quiz Arcade…</p>
    </div>
  </div>
);

const RequireRole: React.FC<{ roles: Role[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { user, ready } = useApp();
  const location = useLocation();
  if (!ready) return <FullScreenLoader />;
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={user.role === 'learner' ? '/home' : '/teacher'} replace />;
  }
  return <>{children}</>;
};

const RoleHome: React.FC = () => {
  const { user, ready } = useApp();
  if (!ready) return <FullScreenLoader />;
  if (!user) return <Landing />;
  return <Navigate to={user.role === 'learner' ? '/home' : '/teacher'} replace />;
};

const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

export const App: React.FC = () => {
  const location = useLocation();
  return (
    <>
      <AppShell>
        <Suspense fallback={<FullScreenLoader />}>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname.split('/').slice(0, 3).join('/')}>
              <Route path="/" element={<RoleHome />} />
              <Route path="/login" element={<Page><Login /></Page>} />
              <Route path="/join" element={<Page><Join /></Page>} />
              <Route path="/privacy" element={<Page><Privacy /></Page>} />

              <Route
                path="/teacher"
                element={
                  <RequireRole roles={['teacher', 'admin']}>
                    <Page><TeacherDashboard /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/library"
                element={
                  <RequireRole roles={['teacher', 'admin']}>
                    <Page><QuizLibrary /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/editor/:quizId"
                element={
                  <RequireRole roles={['teacher', 'admin']}>
                    <Page><QuizEditor /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/import"
                element={
                  <RequireRole roles={['teacher', 'admin']}>
                    <Page><ImportPage /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/assignments"
                element={
                  <RequireRole roles={['teacher', 'admin']}>
                    <Page><AssignmentsPage /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/gradebook"
                element={
                  <RequireRole roles={['teacher', 'admin']}>
                    <Page><GradebookPage /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/gradebook/:assignmentId"
                element={
                  <RequireRole roles={['teacher', 'admin']}>
                    <Page><GradebookDetail /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/report/:reportId"
                element={
                  <RequireRole roles={['teacher', 'admin']}>
                    <Page><GameReportPage /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/teacher/minigames"
                element={
                  <RequireRole roles={['teacher', 'admin']}>
                    <Page><MinigamePreview /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireRole roles={['admin']}>
                    <Page><AdminPage /></Page>
                  </RequireRole>
                }
              />

              <Route
                path="/host/:sessionId"
                element={
                  <RequireRole roles={['teacher', 'admin']}>
                    <HostGame />
                  </RequireRole>
                }
              />
              <Route path="/play/:pin" element={<LivePlay />} />

              <Route
                path="/home"
                element={
                  <RequireRole roles={['learner']}>
                    <Page><LearnerHome /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/tasks"
                element={
                  <RequireRole roles={['learner']}>
                    <Page><MyTasks /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/tasks/:assignmentId"
                element={
                  <RequireRole roles={['learner']}>
                    <Page><TaskPlay /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/practice/:quizId"
                element={
                  <RequireRole roles={['learner']}>
                    <Page><TaskPlay /></Page>
                  </RequireRole>
                }
              />
              <Route
                path="/shop"
                element={
                  <RequireRole roles={['learner']}>
                    <Page><AvatarShop /></Page>
                  </RequireRole>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </AppShell>
      <Toasts />
    </>
  );
};
