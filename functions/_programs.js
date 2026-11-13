// 🎓 The training programs whose records live in the shared course KV (COURSE_KV), in one place.
//
// Revoking a trainee follows this list: Users → Revoke wipes their records in every program here (_purge.js), and
// Program Access → Revoke / Suspend puts them on that program's block list (_ft-block.js programBlock). So a NEW program
// is covered the day it is added here, as long as its Worker keeps the contract in COURSE-PROGRAMS.md:
//   • its trainees at <prefix>trainee:<id>, the id being their name and batch slugged (name--batch), and the rest of
//     their records at <prefix><kind>:<id>;
//   • and it honors <prefix>access:blocked (the code to copy is in COURSE-PROGRAMS.md).
// topic: the Portal's topic key (topics table, Program Access); prefix: the program Worker's KV prefix ('' for EA / PA).
// (A new program also goes in launch.js, programs.html, program-progress.js and _attendance.js: see COURSE-PROGRAMS.md.)
export const COURSE_PROGRAMS = [
    { topic: 'STANDARD TRAINING', id: 'ft', label: 'Standard Foundational Training', prefix: 'ft:' },
    { topic: 'EA  PA TRAINING-OUTSOURCED MANP', id: 'eapa', label: 'EA / PA Training', prefix: '' },
    { topic: 'CM TRAINING', id: 'cm', label: 'Case Management Training', prefix: 'cm:' },
    { topic: 'PROPERTY DAMAGE', id: 'pd', label: 'PD Claims Training', prefix: 'pd:' },
    { topic: 'MEDSUM AND DEMAND', id: 'md', label: 'Medsum & Demand Training', prefix: 'md:' },
    { topic: 'LIEN NEGOTIATION', id: 'ln', label: 'Lien Negotiator Training', prefix: 'ln:' }
];
