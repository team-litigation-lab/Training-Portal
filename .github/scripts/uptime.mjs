// Uptime check for the live LSH training sites (run by .github/workflows/uptime.yml).
// Prints a Markdown report and exits 1 if any check fails. Each check is retried
// once after 20 s so a single blip doesn't open an issue.
const CHECKS = [
    { name: 'Training Portal (home)', url: 'https://cm-training-activity.pages.dev/', expect: '<html' },
    { name: 'Training Portal (database)', url: 'https://cm-training-activity.pages.dev/api/site-state', json: (b) => b && b.success === true },
    { name: 'Training Portal (Docket simulator)', url: 'https://cm-training-activity.pages.dev/simulators/docket.html', expect: '<html' },
    { name: 'CM Training course', url: 'https://case-management-training.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'EA/PA Training course', url: 'https://ea-pa-training.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'PD Claims Training course', url: 'https://propertydamageclaimstraining.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'Medsum & Demand Training course', url: 'https://medsumanddemandtraining.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'CMS (home)', url: 'https://lshcasemanagementtraining-trainingcrm.pages.dev/', expect: 'front-desk-drill.js' },
    { name: 'CMS (database)', url: 'https://lshcasemanagementtraining-trainingcrm.pages.dev/api/state', json: (b) => b && typeof b.locked === 'boolean' }
];

async function run(c) {
    const t0 = Date.now();
    try {
        const res = await fetch(c.url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'LSH-uptime-check' } });
        const text = await res.text();
        const ms = Date.now() - t0;
        if (!res.ok) return { ok: false, ms, detail: `HTTP ${res.status}` };
        if (c.expect && !text.includes(c.expect)) return { ok: false, ms, detail: `page loaded but "${c.expect}" is missing` };
        if (c.json) { let b; try { b = JSON.parse(text); } catch (e) { return { ok: false, ms, detail: 'not JSON' }; } if (!c.json(b)) return { ok: false, ms, detail: `unexpected answer: ${text.slice(0, 120)}` }; }
        return { ok: true, ms, detail: `HTTP ${res.status}` };
    } catch (e) { return { ok: false, ms: Date.now() - t0, detail: e.name === 'TimeoutError' ? 'no answer within 20 s' : e.message }; }
}

const rows = [];
let down = 0;
for (const c of CHECKS) {
    let r = await run(c);
    if (!r.ok) { await new Promise(res => setTimeout(res, 20000)); r = await run(c); }
    if (!r.ok) down++;
    rows.push(`| ${r.ok ? '✅' : '🔴'} | ${c.name} | ${c.url} | ${r.detail} | ${r.ms} ms |`);
}
console.log(`### Uptime check · ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC\n`);
console.log(down ? `**${down} of ${CHECKS.length} checks failed.**\n` : `All ${CHECKS.length} checks passed.\n`);
console.log('| | Site | Address | Result | Time |\n|---|---|---|---|---|');
console.log(rows.join('\n'));
if (down) console.log(`\nWorkflow run: ${process.env.GITHUB_SERVER_URL || ''}/${process.env.GITHUB_REPOSITORY || ''}/actions/runs/${process.env.GITHUB_RUN_ID || ''}`);
process.exit(down ? 1 : 0);
