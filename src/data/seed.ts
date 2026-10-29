import type {
  Assignment,
  AssignmentSubmission,
  ClassRoom,
  GameReport,
  Profile,
  Question,
  QuizSet,
} from '../types';
import type { DB } from '../lib/backend/types';
import { emptyDB } from '../lib/backend/types';
import { IMG } from './sampleImages';

const now = Date.now();
const iso = (offsetDays: number, hour = 9) => {
  const d = new Date(now + offsetDays * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const q = (
  id: string,
  text: string,
  options: string[],
  correctIndex: number,
  extra: Partial<Question> = {},
): Question => ({
  id,
  type: options.length === 2 && options[0].toLowerCase() === 'true' ? 'true_false' : 'multiple_choice',
  text,
  options: options.map((t, i) => ({ id: `${id}_o${i}`, text: t })),
  correctIndex,
  timeLimit: 20,
  points: 1000,
  ...extra,
});

/* --------------------------------- staff --------------------------------- */

const profiles: Profile[] = [
  {
    id: 'p_admin',
    role: 'admin',
    firstName: 'Nana',
    lastName: 'Adjei',
    email: 'nana.adjei@eastbridge.edu.gh',
    avatarId: 'eagle-gold',
    coins: 0,
    xp: 0,
    ownedItems: ['eagle-gold'],
    badges: ['Founder'],
    active: true,
    createdAt: iso(-320),
  },
  {
    id: 'p_teacher_ama',
    role: 'teacher',
    firstName: 'Ama',
    lastName: 'Mensah',
    email: 'ama.mensah@eastbridge.edu.gh',
    avatarId: 'eagle-navy',
    coins: 0,
    xp: 0,
    ownedItems: ['eagle-navy'],
    badges: ['Maths Lead'],
    active: true,
    createdAt: iso(-300),
  },
  {
    id: 'p_teacher_kofi',
    role: 'teacher',
    firstName: 'Kofi',
    lastName: 'Boateng',
    email: 'kofi.boateng@eastbridge.edu.gh',
    avatarId: 'eagle-teal',
    coins: 0,
    xp: 0,
    ownedItems: ['eagle-teal'],
    badges: ['Science Lead'],
    active: true,
    createdAt: iso(-280),
  },
  {
    id: 'p_teacher_esi',
    role: 'teacher',
    firstName: 'Esi',
    lastName: 'Owusu',
    email: 'esi.owusu@eastbridge.edu.gh',
    avatarId: 'eagle-sage',
    coins: 0,
    xp: 0,
    ownedItems: ['eagle-sage'],
    badges: ['ICT Teacher'],
    active: true,
    createdAt: iso(-260),
  },
];

/* -------------------------------- classes -------------------------------- */

const classes: ClassRoom[] = [
  { id: 'c_y5a', name: '5 Aurora', yearGroup: 5, teacherIds: ['p_teacher_ama'], code: 'EB5A', createdAt: iso(-250) },
  { id: 'c_y7b', name: '7 Falcon', yearGroup: 7, teacherIds: ['p_teacher_kofi'], code: 'EB7B', createdAt: iso(-250) },
  { id: 'c_y9c', name: '9 Horizon', yearGroup: 9, teacherIds: ['p_teacher_esi'], code: 'EB9C', createdAt: iso(-250) },
  { id: 'c_y4a', name: '4 Kite', yearGroup: 4, teacherIds: ['p_teacher_ama'], code: 'EB4A', createdAt: iso(-250) },
  { id: 'c_y8a', name: '8 Talon', yearGroup: 8, teacherIds: ['p_teacher_kofi'], code: 'EB8A', createdAt: iso(-250) },
];

const learnerSeed: Array<[string, string, string, string, string, number, number, number, number]> = [
  // id, first, last, classId, pin, coins, xp, level, streak
  ['p_l1', 'Akosua', 'Darkwah', 'c_y5a', '1024', 820, 640, 4, 6],
  ['p_l2', 'Kojo', 'Amoah', 'c_y5a', '2048', 640, 410, 3, 4],
  ['p_l3', 'Efua', 'Sarpong', 'c_y5a', '3141', 1180, 990, 5, 9],
  ['p_l4', 'Yaw', 'Nkrumah', 'c_y5a', '4096', 300, 180, 2, 1],
  ['p_l5', 'Adwoa', 'Bediako', 'c_y7b', '5123', 940, 760, 5, 7],
  ['p_l6', 'Kwame', 'Asante', 'c_y7b', '6144', 520, 350, 3, 3],
  ['p_l7', 'Abena', 'Ofori', 'c_y7b', '7168', 1320, 1180, 6, 12],
  ['p_l8', 'Fiifi', 'Quansah', 'c_y7b', '8192', 210, 120, 2, 0],
  ['p_l9', 'Maame', 'Addo', 'c_y9c', '9216', 1460, 1420, 6, 14],
  ['p_l10', 'Kwesi', 'Appiah', 'c_y9c', '1357', 700, 500, 4, 5],
  ['p_l11', 'Naa', 'Lamptey', 'c_y9c', '2468', 1020, 880, 5, 8],
  ['p_l12', 'Sena', 'Agbeko', 'c_y9c', '3579', 380, 260, 3, 2],
];

const learners: Profile[] = learnerSeed.map(([id, first, last, classId, pin, coins, xp], i) => ({
  id,
  role: 'learner',
  firstName: first,
  lastName: last,
  schoolCode: `EB-${classId.replace('c_y', '').toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
  pin,
  classId,
  avatarId: i % 3 === 0 ? 'eagle-gold' : i % 3 === 1 ? 'eagle-teal' : 'eagle-navy',
  coins,
  xp,
  ownedItems: ['eagle-navy', i % 2 ? 'hat-cap' : 'hat-grad'],
  hatId: i % 2 ? 'hat-cap' : 'hat-grad',
  badges: [
    ...(xp > 800 ? ['Scholar Streak'] : []),
    ...(coins > 900 ? ['Coin Collector'] : []),
    ...(i === 2 ? ['Perfect Week'] : []),
  ],
  active: true,
  createdAt: iso(-200 + i),
}));

/* -------------------------------- quizzes -------------------------------- */

const y5MathsQuestions: Question[] = [
  q(
    'qm1',
    'Which shape has exactly three sides?',
    ['Square', 'Triangle', 'Pentagon', 'Circle'],
    1,
    { imageUrl: IMG.triangleShapes, imageAlt: 'A gold triangle beside a teal circle, labelled three sides', topic: '2D shapes', timeLimit: 15 },
  ),
  {
    ...q('qm1b', 'Which picture shows a shape with exactly four equal sides and four right angles?', ['Square', 'Triangle', 'Circle', 'Pentagon'], 0, {
      explanation: 'A square has four equal sides and four right angles. A pentagon has five sides and a circle has none.',
      topic: '2D shapes',
      timeLimit: 20,
    }),
    options: [
      { id: 'qm1b_o0', text: 'Square', imageUrl: IMG.shapeSquare, imageAlt: 'A gold square with four equal sides' },
      { id: 'qm1b_o1', text: 'Triangle', imageUrl: IMG.shapeTriangle, imageAlt: 'A gold triangle with three sides' },
      { id: 'qm1b_o2', text: 'Circle', imageUrl: IMG.shapeCircle, imageAlt: 'A gold circle with a curved edge' },
      { id: 'qm1b_o3', text: 'Pentagon', imageUrl: IMG.shapePentagon, imageAlt: 'A gold pentagon with five sides' },
    ],
  },
  q('qm2', 'What is 7 × 8?', ['54', '56', '64', '48'], 1, {
    explanation: '7 × 8 = 56. Split it as 7 × 4 = 28, then double it.',
    topic: 'Multiplication',
    timeLimit: 15,
  }),
  q('qm3', 'A bar is split into 4 equal parts and 3 are shaded. What fraction is shaded?', ['1/4', '1/2', '3/4', '4/3'], 2, {
    imageUrl: IMG.fractionBars,
    imageAlt: 'A bar divided into four quarters with three quarters shaded gold',
    explanation: 'Three of the four equal parts are shaded, so the fraction is 3/4. That is also 0.75 or 75%.',
    topic: 'Fractions',
    timeLimit: 30,
    points: 1200,
  }),
  q('qm4', 'What is 250 + 175?', ['415', '425', '435', '325'], 1, {
    explanation: '250 + 175 = 425. Add 200 + 100 = 300, then 50 + 75 = 125, and 300 + 125 = 425.',
    topic: 'Addition',
  }),
  q('qm5', 'A square has four equal sides. Is that true or false?', ['True', 'False'], 0, {
    explanation: 'True — a square has four sides that are all the same length and four right angles.',
    topic: '2D shapes',
    timeLimit: 10,
  }),
  q('qm6', 'Which number is a multiple of 6?', ['16', '24', '34', '45'], 1, {
    explanation: '24 = 6 × 4, so 24 is a multiple of 6.',
    topic: 'Times tables',
  }),
  q('qm7', 'What is 1/2 of 18?', ['6', '8', '9', '12'], 2, {
    explanation: 'Half of 18 is 9, because 9 + 9 = 18.',
    topic: 'Fractions',
  }),
  q('qm8', 'Which unit would you use to measure the length of your pencil?', ['Kilometres', 'Centimetres', 'Litres', 'Kilograms'], 1, {
    explanation: 'A pencil is a few centimetres long. Kilometres are for long distances, litres measure liquid and kilograms measure mass.',
    topic: 'Measurement',
  }),
];

const y7ScienceQuestions: Question[] = [
  q(
    'qs1',
    'Which parts of a plant cell are missing from an animal cell?',
    ['Nucleus and cytoplasm', 'Cell wall and chloroplasts', 'Cell membrane and nucleus', 'Mitochondria and ribosomes'],
    1,
    {
      imageUrl: IMG.plantCell,
      imageAlt: 'Diagram of a plant cell showing the cell wall, chloroplasts and nucleus',
      explanation:
        'Plant cells have a rigid cell wall and chloroplasts for photosynthesis. Animal cells have neither.',
      topic: 'Cells',
      timeLimit: 25,
    },
  ),
  q(
    'qs2',
    'Photosynthesis produces glucose and which gas?',
    ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'],
    2,
    {
      imageUrl: IMG.photosynthesis,
      imageAlt: 'A leaf absorbing sunlight, carbon dioxide and water to produce glucose and oxygen',
      explanation:
        'Light energy drives the reaction: carbon dioxide + water → glucose + oxygen. The oxygen is released into the air.',
      topic: 'Photosynthesis',
      timeLimit: 25,
      points: 1200,
    },
  ),
  q('qs3', 'The water cycle moves water between land, air and sea. True or false?', ['True', 'False'], 0, {
    imageUrl: IMG.waterCycle,
    imageAlt: 'The water cycle: sun evaporates water from the sea, clouds form and rain falls',
    explanation: 'True. Evaporation, condensation and precipitation move water through the cycle.',
    topic: 'States of matter',
    timeLimit: 15,
  }),
  q('qs4', 'What is the boiling point of pure water at sea level?', ['40 °C', '75 °C', '100 °C', '120 °C'], 2, {
    explanation: 'At standard atmospheric pressure water boils at 100 °C and freezes at 0 °C.',
    topic: 'States of matter',
  }),
  q('qs5', 'Which of these is a non-contact force?', ['Friction', 'Air resistance', 'Gravity', 'Tension'], 2, {
    explanation: 'Gravity acts at a distance without touching. Friction, air resistance and tension need contact.',
    topic: 'Forces',
  }),
  q('qs6', 'Which organ pumps blood around the body?', ['Lungs', 'Heart', 'Liver', 'Kidney'], 1, {
    explanation: 'The heart is a muscular pump. The right side sends blood to the lungs, the left side to the body.',
    topic: 'Body systems',
    timeLimit: 15,
  }),
  q('qs7', 'A mixture is separated into its parts by filtering. True or false?', ['True', 'False'], 0, {
    explanation: 'True — filtering separates an insoluble solid from a liquid, like sand from water.',
    topic: 'Separation techniques',
    timeLimit: 15,
  }),
  q('qs8', 'In a food chain, what do we call an organism that makes its own food?', ['Consumer', 'Predator', 'Producer', 'Decomposer'], 2, {
    explanation: 'Green plants are producers: they make food by photosynthesis. Consumers eat other organisms.',
    topic: 'Ecology',
  }),
];

const y9IctQuestions: Question[] = [
  q(
    'qi1',
    'In the CIA triad, what does the “C” stand for?',
    ['Control', 'Confidentiality', 'Compliance', 'Cryptography'],
    1,
    {
      imageUrl: IMG.ciaTriad,
      imageAlt: 'A triangle labelled confidentiality, integrity and availability',
      explanation:
        'Confidentiality means only authorised people can read the data. Integrity is about accuracy, availability is about access when needed.',
      topic: 'CIA triad',
      timeLimit: 25,
      points: 1200,
    },
  ),
  q(
    'qi2',
    'A student’s exam mark is changed from 62 to 92 without permission. Which part of the CIA triad is broken?',
    ['Confidentiality', 'Integrity', 'Availability', 'None of them'],
    1,
    {
      explanation: 'The data is no longer accurate and trustworthy, which is a breach of integrity.',
      topic: 'CIA triad',
      timeLimit: 25,
    },
  ),
  q(
    'qi3',
    'Which type of malware encrypts your files and demands payment?',
    ['Adware', 'Ransomware', 'Spyware', 'Rootkit'],
    1,
    {
      imageUrl: IMG.malware,
      imageAlt: 'A friendly bug icon on a laptop screen representing malware',
      explanation:
        'Ransomware locks or encrypts files, then demands payment for the key. Never pay — restore from a backup instead.',
      topic: 'Malware',
      timeLimit: 25,
    },
  ),
  q(
    'qi4',
    'A server that hosts the school register goes offline so staff cannot take attendance. Which goal is affected?',
    ['Availability', 'Confidentiality', 'Integrity', 'Authentication'],
    0,
    {
      explanation: 'Availability means systems and data are accessible to authorised users when needed.',
      topic: 'CIA triad',
    },
  ),
  q(
    'qi5',
    'Which of these is the strongest password?',
    ['eagles2010', 'Ghana!2010', 'T4mbo+Kite_92!', 'password'],
    2,
    {
      imageUrl: IMG.passwordStrength,
      imageAlt: 'Three password choices rated weak, medium and strong',
      explanation:
        'Long and unpredictable beats short and clever. T4mbo+Kite_92! mixes length, symbols and letter case.',
      topic: 'Account security',
      timeLimit: 25,
    },
  ),
  q(
    'qi6',
    'An email says your account will be closed in 1 hour and asks you to re-enter your password. What is this?',
    ['A firewall update', 'Phishing', 'A backup alert', 'Two-factor authentication'],
    1,
    {
      imageUrl: IMG.phishing,
      imageAlt: 'A fake urgent email with a misspelled domain asking for a password',
      explanation:
        'Urgency plus a password request is classic phishing. Check the sender domain and never log in from an email link.',
      topic: 'Social engineering',
      timeLimit: 30,
    },
  ),
  q(
    'qi7',
    'Malware can spread through a USB drive. True or false?',
    ['True', 'False'],
    0,
    {
      explanation: 'True. Removable media is a common route for worms and trojans — scan drives before opening files.',
      topic: 'Malware',
      timeLimit: 15,
    },
  ),
  q(
    'qi8',
    'What is the main purpose of the 3-2-1 backup rule?',
    ['To save storage space', 'To keep 3 copies of data on 2 media with 1 off-site', 'To make files open faster', 'To stop phishing emails'],
    1,
    {
      imageUrl: IMG.backup,
      imageAlt: 'Original data copied to three separate backup locations',
      explanation:
        '3 copies, on 2 different types of media, with 1 copy off-site — so a fire, theft or ransomware attack cannot destroy everything.',
      topic: 'Backups',
      timeLimit: 30,
      points: 1200,
    },
  ),
];

const quizzes: QuizSet[] = [
  {
    id: 'quiz_y5_maths',
    title: 'Year 5 Maths — Fractions & Shapes',
    emoji: '🔢',
    description:
      'Warm-up quiz covering multiplication facts, fractions of shapes and quick addition. Ideal for a Monday mental maths starter.',
    subject: 'Maths',
    yearGroup: 5,
    tags: ['fractions', 'shapes', 'mental maths', 'multiplication'],
    visibility: 'shared',
    ownerId: 'p_teacher_ama',
    folder: 'Numeracy set A',
    questions: y5MathsQuestions,
    createdAt: iso(-40),
    updatedAt: iso(-3),
  },
  {
    id: 'quiz_y7_science',
    title: 'Year 7 Science — Cells, Forces & Matter',
    emoji: '🔬',
    description:
      'Revision quiz on plant and animal cells, photosynthesis, forces and the particle model. Includes explained answers.',
    subject: 'Science',
    yearGroup: 7,
    tags: ['cells', 'photosynthesis', 'forces', 'revision'],
    visibility: 'shared',
    ownerId: 'p_teacher_kofi',
    folder: 'Biology revision',
    questions: y7ScienceQuestions,
    createdAt: iso(-30),
    updatedAt: iso(-2),
  },
  {
    id: 'quiz_y9_ict',
    title: 'Year 9 ICT — Cybersecurity: CIA & Malware',
    emoji: '🛡️',
    description:
      'Core cybersecurity essentials: the CIA triad, malware families, phishing, password strength and the 3-2-1 backup rule.',
    subject: 'ICT',
    yearGroup: 9,
    tags: ['cybersecurity', 'CIA triad', 'malware', 'phishing', 'backups'],
    visibility: 'shared',
    ownerId: 'p_teacher_esi',
    folder: 'Security unit',
    questions: y9IctQuestions,
    createdAt: iso(-20),
    updatedAt: iso(-1),
  },
];

/* ------------------------------ assignments ------------------------------ */

const assignments: Assignment[] = [
  {
    id: 'asg_ict_security',
    quizId: 'quiz_y9_ict',
    teacherId: 'p_teacher_esi',
    title: 'Cybersecurity Checkpoint (CIA + Malware)',
    instructions:
      'Work on your own. Read each question carefully and use the explanation after each answer. You may play one arcade break after a correct answer.',
    targetType: 'class',
    classIds: ['c_y9c'],
    learnerIds: [],
    startDate: iso(-5),
    dueDate: iso(3, 16),
    attempts: 2,
    timeLimitMin: 20,
    shuffle: true,
    shuffleAnswers: true,
    showAnswers: true,
    arcade: { enabled: true, durationSec: 60, allowedGames: ['crew-sabotage', 'blaster-arena', 'eagle-run'], trigger: 'every', skipAllowed: true },
    shortCode: 'EB-7K2Q9A',
    createdAt: iso(-6),
  },
  {
    id: 'asg_maths_fractions',
    quizId: 'quiz_y5_maths',
    teacherId: 'p_teacher_ama',
    title: 'Fractions Warm-up Task',
    instructions: 'Aim for your best accuracy. Arcade breaks are on for every correct answer.',
    targetType: 'class',
    classIds: ['c_y5a'],
    learnerIds: [],
    startDate: iso(-8),
    dueDate: iso(-1, 16),
    attempts: 1,
    shuffle: false,
    shuffleAnswers: false,
    showAnswers: true,
    arcade: { enabled: true, durationSec: 45, allowedGames: ['eagle-run', 'tower-stack', 'sky-hop'], trigger: 'every', skipAllowed: true },
    shortCode: 'EB-3MATH5',
    createdAt: iso(-9),
  },
  {
    id: 'asg_science_cells',
    quizId: 'quiz_y7_science',
    teacherId: 'p_teacher_kofi',
    title: 'Cells & Photosynthesis Revision',
    instructions: 'Complete before Friday. Two attempts allowed — your best score counts.',
    targetType: 'class',
    classIds: ['c_y7b'],
    learnerIds: [],
    startDate: iso(-2),
    dueDate: iso(6, 16),
    attempts: 2,
    shuffle: true,
    shuffleAnswers: true,
    showAnswers: true,
    arcade: { enabled: true, durationSec: 60, allowedGames: ['sky-hop', 'fruit-slash', 'gold-rush'], trigger: 'every_2', skipAllowed: false },
    shortCode: 'EB-8SCI7',
    createdAt: iso(-3),
  },
];

const mkSubmission = (
  id: string,
  assignmentId: string,
  learnerId: string,
  quizId: string,
  pctScore: number,
  total: number,
  bonus: number,
  status: AssignmentSubmission['status'],
  daysAgo: number,
  late = false,
): AssignmentSubmission => {
  const correct = Math.round((pctScore / 100) * total);
  return {
    id,
    assignmentId,
    learnerId,
    quizId,
    attempt: 1,
    score: Math.round((correct / total) * total),
    accuracy: Math.round((correct / total) * 100),
    correct,
    total,
    bestStreak: Math.max(1, Math.round(correct / 2)),
    totalTimeMs: 45_000 + correct * 3_500,
    answers: [],
    arcadeBonus: bonus,
    minigameResults: bonus
      ? [{ gameId: 'eagle-run', score: 320, coins: bonus, durationMs: 60_000, playedAt: iso(-daysAgo) }]
      : [],
    status,
    late,
    submittedAt: status === 'done' || status === 'overdue' ? iso(-daysAgo) : undefined,
    startedAt: iso(-daysAgo),
    teacherComment: correct / total >= 0.9 ? 'Excellent — explain the CIA triad to a partner next lesson.' : undefined,
  };
};

const submissions: AssignmentSubmission[] = [
  mkSubmission('sub_1', 'asg_ict_security', 'p_l9', 'quiz_y9_ict', 88, 8, 140, 'done', 2),
  mkSubmission('sub_2', 'asg_ict_security', 'p_l10', 'quiz_y9_ict', 50, 8, 60, 'done', 1),
  mkSubmission('sub_3', 'asg_ict_security', 'p_l11', 'quiz_y9_ict', 100, 8, 160, 'done', 2),
  mkSubmission('sub_4', 'asg_maths_fractions', 'p_l1', 'quiz_y5_maths', 75, 8, 90, 'done', 3, true),
  mkSubmission('sub_5', 'asg_maths_fractions', 'p_l2', 'quiz_y5_maths', 63, 8, 45, 'done', 4, true),
  mkSubmission('sub_6', 'asg_maths_fractions', 'p_l3', 'quiz_y5_maths', 100, 8, 150, 'done', 3),
  mkSubmission('sub_7', 'asg_science_cells', 'p_l5', 'quiz_y7_science', 75, 8, 80, 'done', 1),
  mkSubmission('sub_8', 'asg_science_cells', 'p_l6', 'quiz_y7_science', 38, 8, 20, 'done', 1),
  mkSubmission('sub_9', 'asg_science_cells', 'p_l7', 'quiz_y7_science', 100, 8, 120, 'done', 0),
];

/* ----------------------------- sample report ----------------------------- */

const reportPlayers = [
  { name: 'Maame A.', id: 'p_l9', correct: 7 },
  { name: 'Naa L.', id: 'p_l11', correct: 8 },
  { name: 'Kwesi A.', id: 'p_l10', correct: 5 },
  { name: 'Sena A.', id: 'p_l12', correct: 4 },
  { name: 'Abena O.', id: 'p_l7', correct: 6 },
  { name: 'Kwame A.', id: 'p_l6', correct: 3 },
].map((p, i) => ({
  id: `rep_p${i}`,
  sessionId: 'sess_demo',
  name: p.name,
  avatarId: ['eagle-gold', 'eagle-navy', 'eagle-teal'][i % 3],
  isGuest: false,
  profileId: p.id,
  score: p.correct * 950 + (6 - i) * 120,
  coins: 120 + i * 15,
  streak: Math.min(3, p.correct),
  bestStreak: Math.min(4, p.correct),
  correct: p.correct,
  total: 8,
  answers: [],
  connected: false,
  team: i % 2,
}));

const reports: GameReport[] = [
  {
    id: 'report_demo_ict',
    sessionId: 'sess_demo',
    quizId: 'quiz_y9_ict',
    hostId: 'p_teacher_esi',
    mode: 'classic',
    title: 'Year 9 ICT — CIA & Malware (live)',
    endedAt: iso(-4, 11),
    players: reportPlayers,
    questionStats: y9IctQuestions.map((qq, i) => ({
      questionId: qq.id,
      text: qq.text,
      correctPct: [88, 62, 75, 50, 38, 25, 63, 50][i] ?? 60,
      attempts: 6,
      avgMs: [8200, 11_400, 9600, 13_200, 15_800, 18_400, 7200, 12_600][i] ?? 10_000,
      mostChosenWrong: i === 5 ? { text: 'A firewall update', count: 4 } : undefined,
    })),
  },
];

export const createSeedDB = (): DB => {
  const db = emptyDB();
  db.profiles = profiles.map((p) => (p.role === 'learner' ? { ...p } : { ...p }));
  db.classes = classes;
  db.quizzes = quizzes.map((quiz) => ({ ...quiz, questions: quiz.questions.map((x) => ({ ...x })) }));
  db.assignments = assignments;
  db.submissions = submissions;
  db.reports = reports;
  db.sessions = [];
  db.players = [];
  db.profiles.push(...learners.map((l) => ({ ...l })));
  return db;
};

export const DEMO_QUIZ_IDS = quizzes.map((q) => q.id);

export const demoCredentials = {
  admin: { email: 'nana.adjei@eastbridge.edu.gh', password: 'eastbridge' },
  teacher: { email: 'esi.owusu@eastbridge.edu.gh', password: 'eastbridge' },
  learner: { schoolCode: 'EB-9C-009', pin: '9216' },
};
