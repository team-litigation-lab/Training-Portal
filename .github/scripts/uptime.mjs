// Uptime check for the live LSH training sites (run by .github/workflows/uptime.yml).
// Prints a Markdown report and exits 1 if any check fails. Each check is retried
// once after 20 s so a single blip doesn't open an issue.
const CHECKS = [
    { name: 'LSH Nexus (home)', url: 'https://cm-training-activity.pages.dev/', expect: '<html' },
    { name: 'LSH Nexus (database)', url: 'https://cm-training-activity.pages.dev/api/site-state', json: (b) => b && b.success === true },
    { name: 'LSH Nexus (Docket simulator)', url: 'https://cm-training-activity.pages.dev/simulators/docket.html', expect: '<html' },
    { name: 'CM Training course', url: 'https://case-management-training.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'EA/PA Training course', url: 'https://ea-pa-training.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'PD Claims Training course', url: 'https://propertydamageclaimstraining.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'Medsum & Demand Training course', url: 'https://medsumanddemandtraining.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'Lien Negotiator Training course', url: 'https://liennegotiatortraining.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'Standard Foundational Training course', url: 'https://foundational-training.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'CMS (home)', url: 'https://lshcasemanagementtraining-trainingcrm.pages.dev/', expect: 'front-desk-drill.js' },
    // the CMS's site state: it answers paused (true/false) once its database is reachable (Lock/Unlock, and its
    // locked field, were removed from the CMS)
    { name: 'CMS (database)', url: 'https://lshcasemanagementtraining-trainingcrm.pages.dev/api/state', json: (b) => b && typeof b.paused === 'boolean' },
    // The two other tools a signed-in person reaches through SSO (functions/api/launch.js SSO_TOOLS).
    { name: 'Knowledge Base', url: 'https://lsh-knowledge-base.legalsupporthelp.workers.dev/', expect: '<html' },
    { name: 'LSH Ring Channel', url: 'https://lshringchannel.legalsupporthelp.workers.dev/', expect: '<html' }
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

// 🚀 Is the live site the latest code? The commit the live course was built from (its /deploy.json, written by its
// build/deploy-info.cjs) is compared with its GitHub main's; a course without one yet is compared by the page's build
// stamp (APP_BUILD in index.html), which only follows the page's own files. A deploy that stopped (a failed
// Cloudflare build, build minutes used up, an expired token) shows here instead of going unnoticed for days. A main
// commit under 45 minutes old is given time to deploy.
const DEPLOYS = [
    { name: 'Standard Foundational Training deploy', live: 'https://foundational-training.legalsupporthelp.workers.dev/', repo: 'team-litigation-lab/Foundational-Training' }
];
const stamp = (html) => (String(html).match(/APP_BUILD = "([^"]+)"/) || [])[1] || null;
async function deployed(d) {
    const t0 = Date.now(), gh = { 'User-Agent': 'LSH-uptime-check', Accept: 'application/vnd.github+json' };
    if (process.env.GH_TOKEN) gh.Authorization = 'Bearer ' + process.env.GH_TOKEN;
    try {
        const api = `https://api.github.com/repos/${d.repo}/commits/main`;
        let res = await fetch(api, { headers: gh, signal: AbortSignal.timeout(20000) });
        if (!res.ok && gh.Authorization) { delete gh.Authorization; res = await fetch(api, { headers: gh, signal: AbortSignal.timeout(20000) }); }   // (a public repository reads without the token)
        const commit = await res.json();
        if (!res.ok || !commit.sha) return { ok: false, ms: Date.now() - t0, detail: `GitHub didn't give main's latest commit (HTTP ${res.status})` };
        const age = (Date.now() - Date.parse(commit.commit.committer.date)) / 60000;
        const info = await fetch(d.live + 'deploy.json?uptime=' + Date.now(), { headers: { 'User-Agent': 'LSH-uptime-check' }, signal: AbortSignal.timeout(20000) })
            .then(async (r) => r.ok ? JSON.parse(await r.text()) : null).catch(() => null);
        if (info && info.commit) {
            const ms = Date.now() - t0, have = String(info.commit).slice(0, 7), want = commit.sha.slice(0, 7);
            if (String(info.commit) === commit.sha) return { ok: true, ms, detail: `live is main (commit ${have})` };
            if (age < 45) return { ok: true, ms, detail: `main is ${Math.round(age)} min old: deploying (live ${have}, main ${want})` };
            return { ok: false, ms, detail: `live is commit ${have} but main is ${want}, ${Math.round(age / 60)} h old: the deploy has stopped (check the Cloudflare build)` };
        }
        const want = stamp(await (await fetch(`https://raw.githubusercontent.com/${d.repo}/${commit.sha}/index.html`, { signal: AbortSignal.timeout(20000) })).text());
        const have = stamp(await (await fetch(d.live + '?uptime=' + Date.now(), { headers: { 'User-Agent': 'LSH-uptime-check' }, signal: AbortSignal.timeout(20000) })).text());
        const ms = Date.now() - t0;
        if (!want || !have) return { ok: false, ms, detail: `no build stamp to compare (live ${have || 'none'}, main ${want || 'none'})` };
        if (have === want) return { ok: true, ms, detail: `live is main (${have})` };
        if (age < 45) return { ok: true, ms, detail: `main is ${Math.round(age)} min old: deploying (live ${have}, main ${want})` };
        return { ok: false, ms, detail: `live is ${have} but main is ${want}, ${Math.round(age / 60)} h old: the deploy has stopped (check the Cloudflare build)` };
    } catch (e) { return { ok: false, ms: Date.now() - t0, detail: e.name === 'TimeoutError' ? 'no answer within 20 s' : e.message }; }
}
for (const d of DEPLOYS) {
    const r = await deployed(d);
    if (!r.ok) down++;
    rows.push(`| ${r.ok ? '✅' : '🔴'} | ${d.name} | ${d.live} | ${r.detail} | ${r.ms} ms |`);
}
console.log(`### Uptime check · ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC\n`);
console.log(down ? `**${down} of ${rows.length} checks failed.**\n` : `All ${rows.length} checks passed.\n`);
console.log('| | Site | Address | Result | Time |\n|---|---|---|---|---|');
console.log(rows.join('\n'));
if (down) console.log(`\nWorkflow run: ${process.env.GITHUB_SERVER_URL || ''}/${process.env.GITHUB_REPOSITORY || ''}/actions/runs/${process.env.GITHUB_RUN_ID || ''}`);
process.exit(down ? 1 : 0);
