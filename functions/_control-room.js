// The page shell of the System Management pages the server draws itself (/api/ai-usage, /api/admin-password-check):
// the same admin bar, hero band and framed panels as system.html (control-room.css), so they look like the rest of it.
// title, eyebrow, h1 and intro are HTML the caller has already escaped; body is the page's own panels; tail goes before </body>.
export const controlRoomPage = (title, eyebrow, h1, intro, body, tail = '') => `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} — LSH Nexus</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/simulators/sim.css">
<script src="/portal-nav.js"></script>
<link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/control-room.css"></head>
<body class="cr-page">
<div class="sim-top"><a class="sim-brand" href="/programs.html"><img src="/lsh-logo-dark.svg" alt="Legal Support Help" width="75" height="46"><span>LSH Nexus<small>System Management</small></span></a>
<div class="sim-nav"><script>document.write(PortalNav.adminHtml('sys', { back: '/system.html' }));</script></div></div>
<div class="sim-wrap"><section class="sim-hero"><div class="eyebrow">${eyebrow}</div><h1>${h1}</h1><p>${intro}</p></section>
${body}
</div>${tail}</body></html>`;
