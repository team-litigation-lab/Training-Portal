// LSH Nexus blueprint video — the scenes.
// Each scene: { id, section, kicker, title, points[], mock (HTML for the right-hand screen), vo (voice-over) }.
// build.js renders each to a 1920x1080 frame, times it from its voice-over, and stitches the MP4.

const win = (url, body) => `<div class="win"><div class="bar"><i></i><i></i><i></i><span>${url}</span></div><div class="page">${body}</div></div>`;
const adminBar = `<div class="abar"><b>LSH Nexus</b><span>Blueprint</span><span>System Management ▾</span><span>Trainee Monitoring</span><span>Attendance</span><span>Referrals</span><span>Switch view</span><span>Logout</span></div>`;
const tBar = `<div class="tbar"><b>LSH Nexus</b><span>LSH Academy Index</span><span>LSH Sims</span><span>LSH Atlas</span><span>Log Out</span></div>`;

module.exports = [
{ id: 'title', type: 'title', section: '',
  title: 'LSH Nexus', sub: 'Platform Blueprint — features &amp; functions',
  tags: ['Trainee view', 'Trainer view'],
  vo: `Welcome to LSH Nexus — the master training portal for Legal Support Help. In this walkthrough we'll look at the blueprint of the whole platform: what it does, how it fits together, and exactly what a trainee and a trainer each see and do.` },

{ id: 'overview', section: 'The Big Picture', kicker: 'One front door',
  title: 'One portal for every LSH training program',
  points: ['A single sign-in opens every program, tool and resource', 'Training programs each run as their own app, launched from the portal', 'Shared tools beside the programs: 🛠 LSH Sims, 📚 LSH Atlas, ☎ LSH Voice, 🗂 LSH CaseWorX', 'Progress is saved to the account — any computer, any time'],
  mock: `<div class="arch">
    <div class="node hub">🏠 LSH Nexus<small>Master Portal · sign-in · LSH Academy Index</small></div>
    <div class="row">
      <div class="node">🎓 Legal VA Foundational</div><div class="node">🗂 Case Management</div><div class="node">🧾 EA / PA</div>
      <div class="node">⚕️ Property Damage Claims</div><div class="node">📄 Medsum &amp; Demand</div><div class="node">💼 Lien Negotiator</div>
    </div>
    <div class="row"><div class="node alt">🛠 LSH Sims</div><div class="node alt">📖 LSH Atlas</div><div class="node alt">☎ LSH Voice</div><div class="node alt">🗂 LSH CaseWorX</div></div>
  </div>`,
  vo: `LSH Nexus is one front door. Trainees and trainers sign in once, here, and from there every training program opens — Legal VA Foundational, Case Management, E A P A, Property Damage Claims, Medsum and Demand, and Lien Negotiator — each one a Track. Beside them sit the shared tools: LSH Sims for practice, LSH Atlas for the firm's SOPs, LSH Voice for mock calls, and LSH CaseWorX, the practice case management system. Everything is saved to the person's account, not their browser, so they can pick up on any computer.` },

{ id: 'twoviews', type: 'split', section: 'The Big Picture', kicker: 'Two views, one platform',
  title: 'Who sees what',
  left: { h: '👩‍🎓 Trainee view', items: ['Register &amp; log in once', 'LSH Academy Index', 'Lessons, practice, feedback', 'LSH Sims &amp; scores', 'LSH Atlas', 'Certificate'] },
  right: { h: '🧑‍🏫 Trainer view', items: ['Approvals &amp; Batch IDs', 'Program Access', 'Master Control', 'Trainee Monitoring', 'Attendance', 'Grading &amp; reviews'] },
  vo: `The platform has two views. The trainee view is about learning: logging in, finding a program, working through lessons, practicing on simulators and earning a certificate. The trainer view is about running training: approving people, controlling access, monitoring progress, taking attendance and grading work. Let's start with the trainee.` },

// ---------------- TRAINEE VIEW ----------------
{ id: 't-section', type: 'section', section: 'Trainee View', title: 'Part 1 · The Trainee View', sub: 'Learning on LSH Nexus, step by step',
  vo: `Part one: the trainee view.` },

{ id: 't-register', section: 'Trainee View', kicker: 'Step 1 · Getting in',
  title: 'Register once, then log in once',
  points: ['Register on the portal — Trainee is the default type', 'Sign in with the @legalsupporthelp.com Google account, then username &amp; password', 'A trainer approves the account and issues the Batch ID (e.g. B100526)', 'Personal Gmail accounts are refused, with instructions'],
  mock: win('lsh-nexus / trainee-login', `${tBar}<div class="form">
    <div class="ftitle">Trainee Log In</div>
    <div class="gbtn">G&nbsp; Step 1 · Sign in with your @legalsupporthelp.com Google account</div>
    <label>Username</label><div class="inp">maria.santos</div>
    <label>Password</label><div class="inp">••••••••••</div>
    <div class="cta">Log In →</div>
    <div class="note">New to LSH? <u>Register</u> — an admin approves you and assigns your Batch ID.</div></div>`),
  vo: `A new trainee registers once on the portal. To sign in, they first use their at legalsupporthelp dot com Google account, then their username and password. A personal Gmail is refused, with a clear message telling them to switch Chrome profiles. Once a trainer approves the registration, the trainee receives a Batch ID — a B followed by the training start date — shared by everyone in that batch.` },

{ id: 't-directory', section: 'Trainee View', kicker: 'Step 2 · The LSH Academy Index',
  title: 'Find your program and open it',
  points: ['Every LSH program listed, with tools beside it', '<b>Request Access</b> → “Awaiting Admin Approval”', '<b>Enter Program</b> opens in a new tab, already signed in', '<b>Completed</b> programs stay open; certificates download here'],
  mock: win('lsh-nexus / programs', `${tBar}<div class="cards">
    <div class="card"><h4>🎓 Legal VA Foundational</h4><p>Core VA training</p><div class="b ok">Enter Program</div></div>
    <div class="card"><h4>🗂 Case Management</h4><p>John Doe v. Apex</p><div class="b wait">Awaiting Admin Approval</div></div>
    <div class="card"><h4>⚕️ PD Claims</h4><p>Property damage</p><div class="b req">Request Access</div></div>
    <div class="card"><h4>🧾 EA / PA</h4><p>Executive assistant</p><div class="b done">✓ Completed · Certificate</div></div>
    <div class="card dim"><h4>🤝 Settlements / Closing</h4><p>Coming soon</p><div class="b soon">Coming Soon</div></div>
    <div class="card"><h4>🃏 Flash Cards</h4><p>Daily Digest</p><div class="b ok">Rules · Trivia · Terms · Process · FAQs</div></div></div>`),
  vo: `After logging in, the trainee lands on LSH Academy Index. Every program is listed here. A program they can't open yet shows Request Access — one press, and it shows Awaiting Admin Approval until a trainer approves it. Approved programs show Enter Program, which opens in a new tab already signed in — no second password. Completed programs stay open, and that's where the certificate is downloaded.` },

{ id: 't-program', section: 'Trainee View', kicker: 'Step 3 · Inside a program',
  title: 'Lessons, practice and feedback',
  points: ['📚 Lessons opened day by day by the trainer', '▶ Lecture videos and files right on the page', '🧪 Activities, Knowledge Checks and Practice Labs — saved as you go', '🎯 Trainer Feedback · 💬 Your feedback · 🎓 Certificate'],
  mock: win('program / day 3', `<div class="tbar"><b>Case Management Track</b><span>Lessons</span><span>Practice</span><span>Scorecard</span><span>Certificate</span></div>
    <div class="lesson"><div class="side"><div class="d on">Day 1 ✓</div><div class="d on">Day 2 ✓</div><div class="d cur">Day 3</div><div class="d lock">Day 4 🔒</div><div class="d lock">Day 5 🔒</div></div>
    <div class="main"><div class="slide">Calendaring court deadlines<br><small>Slide 4 of 12 · ⛶ Full screen</small></div>
    <div class="chips"><span>🧪 Knowledge Check · 92%</span><span>🎯 Trainer Feedback</span><span>💬 Rate this lesson</span></div></div></div>`),
  vo: `Inside a program, lessons open one day at a time as the trainer releases them. Each lesson has slides, videos and files. Practice comes as activities, Knowledge Checks and Practice Labs, and the work saves as they go. The trainer's feedback appears right here — strengths, areas to build, and what to focus on next. Trainees can rate lessons, even anonymously, and the certificate unlocks when the program is complete.` },

{ id: 't-sims', section: 'Trainee View', kicker: 'Step 4 · LSH Sims',
  title: 'Practice real work, safely',
  points: ['☎ Call Sim on LSH Voice — AI callers &amp; graded calls', '📆 Calendaring — book the attorney’s week, submit for review', '✉️ Email Workspace &amp; Email Replies', '⚖️ Docket · 🗂 Records · 🏛 E-Filing · ✍️ Drafting'],
  mock: win('lsh-nexus / simulators', `${tBar}<div class="who">Practicing as <b>Maria Santos</b> · B100526</div><div class="grid4">
    <div class="sim">📞<b>Call Sim</b><small>LSH Voice</small></div><div class="sim">📆<b>Google Calendar</b><small>Calendaring</small></div>
    <div class="sim">✉️<b>Email Workspace</b><small>Triage inbox</small></div><div class="sim">↩️<b>Email Replies</b><small>Scored replies</small></div>
    <div class="sim">⚖️<b>Docket System</b><small>Court deadlines</small></div><div class="sim">🗂<b>Records Requests</b><small>HIPAA &amp; fees</small></div>
    <div class="sim">🏛<b>Court E-Filing</b><small>Federal &amp; state</small></div><div class="sim">✍️<b>Drafting</b><small>LOR &amp; letters</small></div></div>
    <div class="res">My recent results: Docket 88 · Records 94 · Calendar ✓ Submitted</div>`),
  vo: `LSH Sims let trainees practice real legal-support work with fictional cases. Mock phone calls on LSH Voice, with AI callers or graded calls. Calendaring in a Google Calendar style workspace, submitted to the trainer for review. An email workspace and scored email replies. And legal paperwork: docketing, medical records requests, court e-filing and drafting. Trainees are always signed in, so every run is saved under their name and batch.` },

{ id: 't-legal', type: 'three', section: 'Trainee View', kicker: 'Deep dive · Legal-work simulators',
  title: 'Docket, Records and E-Filing',
  cols: [
    { h: '⚖️ Docket System', items: ['Docketing Inbox: decide what goes on the docket', 'Calendar every deadline, with owner &amp; reminders', 'Federal FRCP 6 vs. state counting', 'Deadline Calculator unlocks after hand-counting'] },
    { h: '🗂 Medical Records', items: ['Review HIPAA authorization (45 CFR 164.508)', 'Right department, right dates of service', 'Business-day clock, rejections, invoices', 'Fee caps, disputes, planted problems — scored /100'] },
    { h: '🏛 Court E-Filing', items: ['Federal ECF and state e-filing provider flows', 'Fix files: OCR, /s/ signature, redaction, size', 'Traps: privileged memos never get filed', 'Notice of Electronic Filing / clerk accept-reject'] } ],
  vo: `Three simulators train the paperwork side of case management. The Docket System has trainees sort incoming notices, decide what belongs on the docket, and calendar every deadline — counting by hand before the calculator unlocks. Medical Records Requests runs a full collection on a business-day clock, with authorizations, rejections, fee disputes and planted problems, scored out of one hundred. And Court E-Filing walks through federal and state filing, including fixing documents and avoiding traps like filing a privileged memo.` },

{ id: 't-daily', section: 'Trainee View', kicker: 'Step 5 · Daily practice',
  title: 'Flash Cards, CaseWorX and My Evaluations',
  points: ['🃏 Flash Cards Daily Digest: Rules, Trivia, Terminologies, Process, FAQs', 'Same card for the whole batch each day — something to talk about', '🗂 LSH CaseWorX: mock case files and the scored Front Desk Drill', '📋 My Evaluations: calendars in progress, submitted, and trainer reports'],
  mock: win('lsh-nexus / flashcards', `<div class="tbar"><b>🃏 Flash Cards · Daily Digest</b><span>Rules</span><span>Trivia</span><span>Terminologies</span><span>Process</span><span>FAQs</span></div>
    <div class="fcg"><div class="fc"><small>RULES</small><b>FRCP 6(d): service by mail adds how many days?</b><i>Tap to flip</i></div>
    <div class="fc on"><small>TERMINOLOGIES</small><b>Lien</b><p>A legal claim on settlement money for a debt, such as medical bills.</p><i>✓ Got it</i></div>
    <div class="fc"><small>PROCESS</small><b>First step after a new intake call?</b><i>Tap to flip</i></div></div>
    <div class="res">🗂 LSH CaseWorX · Front Desk Drill — score 46 / 50 · 📋 My Evaluations: Week 2 calendar ✓ Reviewed</div>`),
  vo: `Daily practice keeps skills sharp. Flash Cards is a Daily Digest: one card a day from each deck — rules, trivia, terminologies, process and F A Qs — and everyone in the batch gets the same card, so it's something to talk about. LSH CaseWorX is the practice case management system, with mock case files and a scored Front Desk Drill. And My Evaluations shows a trainee's calendars in progress, what they've submitted, and their trainer's reports.` },

{ id: 't-kb', section: 'Trainee View', kicker: 'Step 5 · LSH Atlas',
  title: 'Look it up before you ask',
  points: ['The firm’s SOPs, Library and Glossary — team only', 'Opens signed in from the Academy Index, no access code', 'Tips, how-tos and templates from the team: 👍 Helpful, comments', 'Contribute your own — reviewed by an admin before publishing'],
  mock: win('knowledge-base', `<div class="tbar"><b>📖 LSH Atlas</b><span>Featured</span><span>Library</span><span>Glossary</span><span>SOPs</span></div>
    <div class="search">🔍 How do I calendar an RFA served by mail?</div>
    <div class="kb"><div class="art"><b>SOP · Calendaring discovery deadlines</b><small>Official · ⬇ original file</small></div>
    <div class="art"><b>Tip · Mail service adds 3 days (federal)</b><small>From the team · 👍 24 Helpful</small></div>
    <div class="art"><b>Template · Records request cover letter</b><small>From the team · 💬 6 comments</small></div></div>`),
  vo: `The LSH Atlas is where L S H team members find the firm's standard operating procedures and share what they know. It opens signed in from the Academy Index. Trainees can browse the Library, the Glossary and official SOPs, mark team tips as helpful, comment, and contribute their own — every post is reviewed by an admin before it's published.` },

{ id: 't-steps', type: 'steps', section: 'Trainee View', kicker: 'Trainee checklist',
  title: 'First steps for every trainee',
  steps: ['Bookmark LSH Nexus', 'Register — wait for approval &amp; Batch ID', 'Request your program in the Academy Index', 'Enter Program &amp; start the first open lesson', 'Try a Sim, explore LSH Atlas'],
  foot: 'Stuck? Message your trainer with your name, Batch ID and a screenshot. Got someone great? Use “Got a referral?” on the main page.',
  vo: `So, for a trainee, the path is simple. Bookmark LSH Nexus. Register and wait for approval. Request your program in the Academy Index. Enter it and start the first open lesson. Then try a Sim and explore LSH Atlas. If anything goes wrong, message the trainer with your name, Batch ID and a screenshot. And anyone can refer a candidate to L S H using the Got a referral button on the main page.` },

// ---------------- TRAINER VIEW ----------------
{ id: 'a-section', type: 'section', section: 'Trainer View', title: 'Part 2 · The Trainer View', sub: 'Running training from the admin side',
  vo: `Part two: the trainer view.` },

{ id: 'a-signin', section: 'Trainer View', kicker: 'Admin sign-in',
  title: 'One admin sign-in opens everything',
  points: ['Register as Admin / Trainer — the Master Account approves it', 'Sign in at Admin Login: every program’s admin, LSH Sims, LSH Atlas, LSH Voice', 'The same admin bar on every main page', 'Site-wide Lock belongs to the Master Account only'],
  mock: win('lsh-nexus / programs (admin)', `${adminBar}<div class="cards">
    <div class="card"><h4>🎓 Legal VA Foundational</h4><p>Batch B100526 · 18 trainees</p><div class="b ok">Enter Program</div></div>
    <div class="card"><h4>🗂 Case Management</h4><p>Batch B092226 · 12 trainees</p><div class="b ok">Enter Program</div></div>
    <div class="card"><h4>⚕️ PD Claims</h4><p>Batch B101226 · 9 trainees</p><div class="b ok">Enter Program</div></div></div>
    <div class="pend"><b>🙋 Pending Topic Requests (3)</b><div>Maria Santos → Case Management <span class="ap">Approve</span><span class="dn">Deny</span></div><div>J. Rivera → PD Claims <span class="ap">Approve</span><span class="dn">Deny</span></div></div>`),
  vo: `A trainer registers as Admin or Trainer, and only the Master Account can approve that. From then on, one sign-in opens everything: every program's admin, LSH Sims, LSH Atlas and LSH Voice. Every main page carries the same admin bar — Blueprint, System Management, Trainee Monitoring, Attendance, Referrals, Switch view and Logout.` },

{ id: 'a-approvals', section: 'Trainer View', kicker: 'Approvals',
  title: 'New registrations can’t be missed',
  points: ['A popup on every portal page while a trainer is signed in', '✓ Approve issues the Batch ID · ✕ Decline', 'It stays until every registration is decided', 'Hidden on the landing page and in 👁 Trainee view — safe to present'],
  mock: win('any portal page', `${adminBar}<div class="modal"><div class="mh">⏳ New registrations waiting (2)</div>
    <div class="mr"><div><b>Maria Santos</b><small>Registered today 9:14 · Starts Oct 5</small></div><span class="ap">✓ Approve</span><span class="dn">✕ Decline</span></div>
    <div class="mr"><div><b>Jordan Rivera</b><small>Registered today 9:40 · Starts Oct 5</small></div><span class="ap">✓ Approve</span><span class="dn">✕ Decline</span></div>
    <div class="mf">Open Registrations →</div></div>`),
  vo: `Whenever a registration is waiting, a popup appears on every portal page while a trainer is signed in. Approve issues the trainee's Batch ID; Decline turns them away. It can't be dismissed until each registration is decided, so nobody is left waiting. It never appears on the landing page or in Trainee view, so it's safe while presenting.` },

{ id: 'a-access', section: 'Trainer View', kicker: 'Program Access',
  title: 'Control who opens what',
  points: ['🙋 Access Requests: Approve / Deny trainees’ program requests', '<b>Grant</b> · <b>Revoke</b> · <b>⏸ Suspend</b> · <b>▶ Restore</b> per trainee, per program', 'Mark Passed → trainee downloads the certificate', '<b>Switch view</b> shows the Academy Index exactly as a trainee sees it'],
  mock: win('master control / program access', `${adminBar}<table class="tbl"><tr><th>Trainee</th><th>Batch</th><th>Program</th><th>Status</th><th>Actions</th></tr>
    <tr><td>Maria Santos</td><td>B100526</td><td>Case Mgmt</td><td><span class="st ok">Approved</span></td><td><span class="x">Revoke</span><span class="x">⏸ Suspend</span><span class="x">Mark Passed</span></td></tr>
    <tr><td>Jordan Rivera</td><td>B100526</td><td>PD Claims</td><td><span class="st wait">Requested</span></td><td><span class="ap">Approve</span><span class="dn">Deny</span></td></tr>
    <tr><td>Alex Chen</td><td>B092226</td><td>EA / PA</td><td><span class="st done">Passed</span></td><td><span class="x">Revoke</span></td></tr>
    <tr><td>Sam Patel</td><td>B092226</td><td>Case Mgmt</td><td><span class="st sus">Suspended</span></td><td><span class="x">▶ Restore</span></td></tr></table>`),
  vo: `Program Access is where trainers decide who opens what. Access requests from the Academy Index are approved or denied. For each trainee and each program there are four actions: Grant, Revoke, Suspend — which pauses access without removing any work — and Restore. Marking a trainee passed lets them download the certificate. And Switch view shows the Academy Index exactly as a trainee sees it, perfect before a demo.` },

{ id: 'a-master', section: 'Trainer View', kicker: 'System Management',
  title: 'Master Control: the whole workspace in one menu',
  points: ['👥 Users, 📝 Registrations, 🔑 Program Access', '🟢 Who’s online and 🧾 activity logs', '📣 Broadcast &amp; Ping — announcements to the batch', '⏸ Pause or 🔒 lock the workspace · 🔐 sign-in checks · 🤖 AI usage'],
  mock: win('lsh-nexus / system management', `${adminBar}<div class="tiles">
    <div class="tile">🛡<b>Master Control</b></div><div class="tile">📝<b>Registrations</b><small>2 waiting</small></div><div class="tile">👥<b>Users</b></div>
    <div class="tile">🔑<b>Program Access</b><small>3 requests</small></div><div class="tile">📣<b>Broadcast &amp; Ping</b></div><div class="tile">🟢<b>Online now</b><small>14</small></div>
    <div class="tile">🛠<b>LSH Sims</b></div><div class="tile">📖<b>LSH Atlas</b></div><div class="tile">☎<b>LSH Voice</b></div>
    <div class="tile">🔐<b>Checks</b></div><div class="tile">🤖<b>AI Usage</b></div><div class="tile">🧾<b>Logs</b></div></div>`),
  vo: `System Management gathers everything else in one menu. Master Control holds users, registrations and program access, who's online right now, and the activity logs. Broadcast and Ping sends announcements to a batch. Trainers can pause the workspace, and the Master Account can lock the whole site. There are also sign-in checks across every program, and a view of today's shared AI usage.` },

{ id: 'a-dashboard', section: 'Trainer View', kicker: 'Master Control',
  title: 'Dashboard &amp; Control Directory',
  points: ['A one-line KPI strip: approvals, requests, users, submissions, online', 'Every admin feature in one table, live status, <b>Open →</b>', 'ⓘ How to use pop-outs with the steps for each screen', '📊 Check &amp; Release Grades — grade, then release to trainees'],
  mock: win('lsh-nexus / master control', `${adminBar}<div class="kpi"><span><b>2</b>approvals</span><span><b>3</b>requests</span><span><b>146</b>users</span><span><b>18</b>submissions</span><span><b>14</b>online</span></div>
    <table class="tbl"><tr><th>Feature</th><th>Group</th><th>Status</th><th></th></tr>
    <tr><td>📝 Log-in Approvals</td><td>People &amp; Access</td><td><span class="st wait">2 waiting</span></td><td><span class="x">Open →</span><span class="x">ⓘ</span></td></tr>
    <tr><td>🔑 Program Access</td><td>People &amp; Access</td><td></td><td><span class="x">Open →</span><span class="x">ⓘ</span></td></tr>
    <tr><td>📊 Check &amp; Release Grades</td><td>Grading &amp; Progress</td><td><span class="st done">18 submissions</span></td><td><span class="x">Open →</span><span class="x">ⓘ</span></td></tr>
    <tr><td>📢 Broadcast &amp; Ping</td><td>Monitoring &amp; Comms</td><td></td><td><span class="x">Open →</span><span class="x">ⓘ</span></td></tr>
    <tr><td>🔒 Site Lock</td><td>System</td><td><span class="st ok">Open</span></td><td><span class="x">Open →</span><span class="x">ⓘ</span></td></tr></table>`),
  vo: `Master Control now opens on a Dashboard. A one-line strip shows what needs attention — approvals, access requests, users, submissions and who's online. Below it, the Control Directory lists every admin feature in one table, grouped by job — people and access, grading and progress, training content, monitoring and comms, and system — each with its live status, an Open button, and a How to use pop-out with the steps. Check and Release Grades is where submissions are graded and then released to trainees.` },

{ id: 'a-monitor', section: 'Trainer View', kicker: 'Trainee Monitoring',
  title: 'Every trainee on one page',
  points: ['A tab per program, grouped by batch — latest first', 'Days completed, Knowledge Check &amp; practice averages, simulator scores', 'Sort by “furthest behind”, filter, search, export CSV', '📦 Archive a finished batch — kept and restorable'],
  mock: win('lsh-nexus / progress', `${adminBar}<div class="ptabs"><span class="on">Case Management</span><span>Foundational</span><span>EA / PA</span><span>PD Claims</span></div>
    <table class="tbl"><tr><th>Trainee</th><th>Days</th><th>KC avg</th><th>Practice</th><th>Sims</th><th>Last active</th></tr>
    <tr><td>Maria Santos</td><td><div class="pb"><i style="width:80%"></i></div>8/10</td><td>92%</td><td>88%</td><td>91</td><td>5 min ago</td></tr>
    <tr><td>Jordan Rivera</td><td><div class="pb"><i style="width:60%"></i></div>6/10</td><td>85%</td><td>79%</td><td>84</td><td>1 h ago</td></tr>
    <tr class="warn"><td>Sam Patel</td><td><div class="pb"><i style="width:30%"></i></div>3/10</td><td>71%</td><td>64%</td><td>62</td><td>2 days ago</td></tr></table>
    <div class="res">Sort: furthest behind ▾ · ⬇ CSV · 📦 Archive batch</div>`),
  vo: `Trainee Monitoring puts every trainee on one page, with a tab per program and trainees grouped by batch. For each person: days completed, Knowledge Check and practice averages, trainer feedback, simulator scores and when they were last active. Sorting by furthest behind finds the people who need help first. When a batch finishes, it can be archived — and restored later if needed.` },

{ id: 'a-attendance', section: 'Trainer View', kicker: 'Attendance',
  title: 'Attendance, batch by batch',
  points: ['The one place attendance is taken, for every program', 'Pick the batch and the day', 'Training shown is the batch’s — changeable per batch or trainee', 'Logs stay with the batch and show in Trainee Monitoring'],
  mock: win('lsh-nexus / attendance', `${adminBar}<div class="att"><div class="sel">Batch <b>B100526</b> ▾ · Day <b>3</b> ▾ · Case Management</div>
    <div class="ar"><span>Maria Santos</span><span class="p on">Present</span><span class="p">Late</span><span class="p">Absent</span></div>
    <div class="ar"><span>Jordan Rivera</span><span class="p">Present</span><span class="p on2">Late</span><span class="p">Absent</span></div>
    <div class="ar"><span>Sam Patel</span><span class="p">Present</span><span class="p">Late</span><span class="p on3">Absent</span></div>
    <div class="cta">Save attendance</div></div>`),
  vo: `Attendance is taken in one place for every program. Pick the batch and the day, mark each trainee, and save. The logs stay with the batch and show up in Trainee Monitoring. Tip: take attendance while the whole batch is still on the call, before opening the day's lessons.` },

{ id: 'a-program', section: 'Trainer View', kicker: 'Program admin',
  title: 'Running the day inside a program',
  points: ['Open lessons or days for a batch when ready to teach', '🖥 Presenter view for the live session', '👁 Trainee view to check what trainees see', 'Grade activities and write Trainer Feedback'],
  mock: win('program / 🛡 admin', `<div class="tbar"><b>🛡 Case Management · Admin</b><span>Days</span><span>Grading</span><span>Feedback</span><span>🖥 Presenter</span><span>👁 Trainee view</span></div>
    <div class="days"><div class="dy on">Day 1 · Open</div><div class="dy on">Day 2 · Open</div><div class="dy on">Day 3 · Open</div><div class="dy">Day 4 · <u>Open for B100526</u></div></div>
    <div class="fb"><b>Trainer Feedback · Maria Santos</b><div>Strengths: precise deadline math, clean docket entries</div><div>Build: reminder lead times</div><div>Next: e-filing redaction</div></div>`),
  vo: `Each program has its own admin area for running the day. Trainers open lessons for a batch when they're ready to teach them, run the live session in Presenter view, and check what trainees see with Trainee view. This is also where activities are graded and each trainee's written feedback is recorded.` },

{ id: 'a-reviews', type: 'grid', section: 'Trainer View', kicker: 'Reviews',
  title: 'Everything trainees share comes to you',
  cells: [
    { h: '📖 LSH Atlas review', t: 'Approve posts, comments and profiles — or send back with a note. Feature, archive, edit.' },
    { h: '📆 Trainee Evaluations', t: 'Calendar work per trainee — last saved, scorecard, submitted, review status — returned on their My Evaluations.' },
    { h: '🛠 Sim Scores', t: 'Every run saved under the trainee’s name and batch, in Monitoring and the course Scorecard.' },
    { h: '🤝 Referrals', t: 'Referred candidates with CVs. Set a status — New, Contacted, Interviewing, Hired — keep notes, export CSV.' } ],
  vo: `Everything trainees share comes to the trainer for review. LSH Atlas posts and comments are approved, or sent back with a note. Trainee Evaluations show each trainee's calendar work, reviewed and returned on their My Evaluations. Sim scores flow automatically into Trainee Monitoring and the course scorecard. And referrals arrive with the candidate's details and CV, tracked through statuses from New to Hired.` },

{ id: 'a-revoke', section: 'Trainer View', kicker: 'Off-boarding',
  title: 'Revoking reaches every program — safely',
  points: ['Users → Revoke removes the account and its work everywhere', 'A backup is filed first — JSON + CSV to the batch’s Drive folder', 'No Drive? The record downloads before anything is deleted', 'The audit log and username tombstone are kept'],
  mock: `<div class="flow"><div class="fs">🗑 Revoke</div><div class="ar2">↓</div><div class="fs">📦 Collect every record</div><div class="ar2">↓</div><div class="fs">☁️ File to Drive<small>LSH Training Archives / program / Batch</small></div><div class="ar2">↓</div><div class="fs red">Delete from all programs</div></div>`,
  vo: `When someone leaves, Revoke removes their account and their work from every program, so batch averages only count the people still training. But the backup always comes first: the whole record is filed as JSON and CSV into the batch's folder on the shared Drive — or downloaded to the trainer's computer — and only then deleted. The audit log is always kept.` },

{ id: 'a-checklist', type: 'steps', section: 'Trainer View', kicker: 'Trainer checklist',
  title: 'The trainer’s daily routine',
  steps: ['Approve registrations &amp; program requests', 'Take attendance, open today’s lessons', 'Broadcast &amp; Ping if the batch needs it', 'Grade &amp; release, Trainee Evaluations, feedback', 'Check Monitoring for anyone falling behind', 'Review KB posts and new referrals'],
  foot: 'Keep this order: approvals first, so nobody is locked out of the day you are about to open.',
  vo: `Here's the trainer's daily routine. Approve registrations and program requests. Take attendance and open today's lessons. Send an announcement if the batch needs one. Grade and release activities, review Trainee Evaluations, and write feedback. Check Trainee Monitoring for anyone falling behind. And review new LSH Atlas posts and referrals. Approvals always come first, so nobody is locked out of the day you're about to open.` },

{ id: 'security', type: 'grid', section: 'Under the Hood', kicker: 'Security &amp; architecture',
  title: 'Built to be safe by default',
  cells: [
    { h: '🔐 Workspace-only sign-in', t: 'Only @legalsupporthelp.com Google accounts — checked in the browser and again on the server.' },
    { h: '🎟 Signed launch tickets', t: 'Programs open with a short-lived, signed ticket for that program only, used once.' },
    { h: '🚫 Revocation everywhere', t: 'Revoke and Suspend reach every program’s scorecards through a shared block list.' },
    { h: '🙈 Nothing private on screen', t: 'No passwords or access codes on the platform; credentials are shared privately.' } ],
  vo: `Under the hood, the platform is built to be safe by default. Only Workspace Google accounts can sign in, checked twice. Programs open with short-lived signed tickets that work for one program, once. Revoking or suspending reaches every program's scorecards. And no passwords or access codes are ever shown on screen.` },

{ id: 'close', type: 'title', section: '',
  title: 'LSH Nexus', sub: 'One portal. Every program. Every trainee.',
  tags: ['Blueprint at /blueprint.html'],
  vo: `That's the LSH Nexus blueprint: one portal, every program, every trainee. For the slide-by-slide version, open the Blueprint from the header on any page. Thanks for watching.` }
];
