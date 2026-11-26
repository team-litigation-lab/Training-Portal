// Builds the LSH Nexus blueprint video: node build.js
// Renders each scene in scenes.js to a 1920x1080 PNG (Playwright), times it from its voice-over
// (~150 words a minute plus a pause), and stitches LSH_Nexus_Blueprint.mp4 with ffmpeg.
// Also writes the voice-over script (VOICEOVER_SCRIPT.md) and captions (LSH_Nexus_Blueprint.srt).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const scenes = require('./scenes');
const OUT = __dirname, FR = path.join(OUT, 'frames');
fs.mkdirSync(FR, { recursive: true });
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '../../lsh-logo-dark.png')).toString('base64');   // the one LSH logo (white outline and wordmark, for dark backgrounds)

const WPS = 2.45, PAD = 1.6, FADE = 0.45;
const words = s => s.split(/\s+/).filter(Boolean).length;
scenes.forEach(s => { s.dur = Math.max(4, +(words(s.vo) / WPS + PAD).toFixed(1)); });

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{width:1920px;height:1080px;font-family:'IBM Plex Sans',Arial,sans-serif;background:#faf8f4;color:#0f2148;overflow:hidden;position:relative}
.top{position:absolute;top:0;left:0;right:0;height:84px;display:flex;align-items:center;justify-content:space-between;padding:0 72px;border-bottom:1px solid rgba(15,33,72,.1);background:#fff}
.top img{height:46px}.top .sec{font-weight:800;letter-spacing:.16em;text-transform:uppercase;font-size:18px;color:#c2410c}
.top .sec.tr{color:#0f2148}
.foot{position:absolute;bottom:0;left:0;right:0;height:10px;background:#e7e3da}.foot i{display:block;height:100%;background:#f97316}
.num{position:absolute;bottom:26px;right:72px;font-size:18px;color:#64748b;font-weight:600}
.wrap{position:absolute;top:84px;bottom:10px;left:0;right:0;display:flex;align-items:center;padding:0 72px;gap:64px}
.txt{flex:0 0 700px}.kick{font-size:22px;font-weight:800;color:#c2410c;letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px}
h1{font-size:60px;font-weight:900;line-height:1.08;letter-spacing:-.015em;margin-bottom:34px}
ul{list-style:none}li{font-size:28px;line-height:1.4;margin-bottom:20px;padding-left:44px;position:relative;color:#1e293b}
li:before{content:'';position:absolute;left:0;top:12px;width:20px;height:20px;border-radius:6px;background:#f97316}
.vis{flex:1;display:flex;align-items:center;justify-content:center}
.win{width:100%;background:#fff;border-radius:18px;box-shadow:0 30px 70px -30px rgba(15,33,72,.45);overflow:hidden;border:1px solid rgba(15,33,72,.12)}
.bar{height:44px;background:#eef1f6;display:flex;align-items:center;gap:8px;padding:0 18px}.bar i{width:13px;height:13px;border-radius:50%;background:#cbd5e1}
.bar span{margin-left:16px;background:#fff;border-radius:8px;padding:5px 16px;font-size:16px;color:#64748b;flex:1}
.page{min-height:600px;background:#faf8f4}
.abar,.tbar{display:flex;gap:22px;align-items:center;background:#0f2148;color:#c9d3ea;padding:14px 22px;font-size:16px;font-weight:600}
.abar b,.tbar b{color:#fff;font-size:18px;margin-right:auto}.abar span:nth-child(3){color:#fb923c}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:22px}
.card{background:#fff;border:1px solid rgba(15,33,72,.1);border-radius:14px;padding:18px}.card.dim{opacity:.55}
.card h4{font-size:19px;margin-bottom:6px}.card p{font-size:15px;color:#64748b;margin-bottom:14px}
.b{font-size:15px;font-weight:700;border-radius:9px;padding:9px 12px;text-align:center}
.b.ok{background:#f97316;color:#111}.b.wait{background:#fef3c7;color:#92400e}.b.req{border:2px solid #0f2148}.b.done{background:#dcfce7;color:#166534}.b.soon{background:#e2e8f0;color:#475569}
.form{max-width:560px;margin:34px auto;background:#fff;border-radius:16px;padding:30px;border:1px solid rgba(15,33,72,.1)}
.ftitle{font-size:28px;font-weight:900;margin-bottom:18px}.gbtn{border:2px solid #4285f4;color:#1a56db;border-radius:10px;padding:12px;font-weight:700;font-size:16px;margin-bottom:18px}
label{display:block;font-size:15px;font-weight:700;margin:10px 0 6px}.inp{border:1px solid #cbd5e1;border-radius:9px;padding:11px;font-size:17px}
.cta{margin-top:20px;background:#f97316;border-radius:10px;padding:13px;text-align:center;font-weight:800;font-size:18px;color:#111}
.note{margin-top:14px;font-size:15px;color:#64748b}
.lesson{display:flex;gap:18px;padding:22px}.side{flex:0 0 150px}.d{padding:11px;border-radius:9px;margin-bottom:8px;font-size:16px;font-weight:600;background:#fff;border:1px solid #e2e8f0}
.d.on{color:#166534}.d.cur{background:#0f2148;color:#fff}.d.lock{color:#94a3b8}
.main{flex:1}.slide{height:340px;border-radius:14px;background:linear-gradient(135deg,#1f2440,#353c68);color:#fff;font-size:32px;font-weight:800;display:flex;flex-direction:column;justify-content:center;padding:40px}
.slide small{font-size:16px;color:#c9cde3;font-weight:500;margin-top:12px}
.chips{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.chips span{background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:9px 14px;font-size:15px;font-weight:600}
.who{margin:18px 22px 0;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 14px;font-size:16px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:18px 22px}
.sim{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px 12px;text-align:center;font-size:36px}.sim b{display:block;font-size:16px;margin-top:8px}.sim small{font-size:13px;color:#64748b}
.fcg{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:22px}.fc{background:#0f2148;color:#fff;border-radius:16px;padding:22px;min-height:250px;display:flex;flex-direction:column;gap:10px}
.fc small{color:#fb923c;font-weight:800;letter-spacing:.1em;font-size:13px}.fc b{font-size:20px;line-height:1.3}.fc p{font-size:16px;color:#c9d3ea;line-height:1.4}.fc i{margin-top:auto;font-style:normal;font-size:14px;color:#94a3b8}.fc.on{background:#fff7ed;color:#0f2148;border:2px solid #f97316}.fc.on p{color:#334155}.fc.on i{color:#166534;font-weight:700}
.kpi{display:flex;gap:10px;padding:18px 22px 0}.kpi span{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:14px;color:#64748b}.kpi b{display:block;font-size:26px;color:#0f2148}
.res{margin:0 22px 22px;font-size:16px;color:#334155;background:#fff;border-radius:10px;padding:12px 14px;border:1px solid #e2e8f0}
.search{margin:22px;background:#fff;border:2px solid #f97316;border-radius:12px;padding:14px;font-size:18px}
.kb{padding:0 22px 22px}.art{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px}.art b{font-size:18px;display:block}.art small{font-size:15px;color:#64748b}
.pend{margin:0 22px 22px;background:#fff;border:2px solid #f97316;border-radius:14px;padding:16px;font-size:16px}.pend b{display:block;margin-bottom:10px;font-size:18px}.pend div{padding:8px 0;border-top:1px solid #f1f5f9}
.ap,.dn,.x{display:inline-block;font-size:14px;font-weight:700;border-radius:8px;padding:6px 10px;margin-left:8px}.ap{background:#16a34a;color:#fff}.dn{background:#fee2e2;color:#991b1b}.x{border:1px solid #cbd5e1}
.modal{margin:40px auto;width:82%;background:#fff;border-radius:18px;box-shadow:0 30px 60px -20px rgba(0,0,0,.4);border:2px solid #0f2148;overflow:hidden}
.mh{background:#0f2148;color:#fff;font-weight:800;font-size:21px;padding:16px 20px}.mr{display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid #f1f5f9}
.mr div{flex:1;font-size:18px}.mr small{display:block;color:#64748b;font-size:14px}.mf{padding:14px 20px;font-weight:700;color:#c2410c}
.tbl{width:calc(100% - 44px);margin:22px;border-collapse:collapse;background:#fff;font-size:16px}.tbl th{text-align:left;background:#eef1f6;padding:11px}.tbl td{padding:11px;border-top:1px solid #f1f5f9}
.tbl tr.warn td{background:#fff7ed}.st{font-weight:700;border-radius:999px;padding:4px 10px;font-size:14px}.st.ok{background:#dcfce7;color:#166534}.st.wait{background:#fef3c7;color:#92400e}.st.done{background:#dbeafe;color:#1e40af}.st.sus{background:#e2e8f0;color:#334155}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:22px}.tile{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;font-size:30px;display:flex;align-items:center;gap:12px}.tile b{font-size:18px}.tile small{margin-left:auto;font-size:14px;color:#c2410c;font-weight:700}
.ptabs{display:flex;gap:8px;padding:18px 22px 0}.ptabs span{padding:9px 14px;border-radius:999px;background:#fff;border:1px solid #e2e8f0;font-weight:700;font-size:15px}.ptabs .on{background:#0f2148;color:#fff}
.pb{display:inline-block;width:80px;height:9px;background:#e2e8f0;border-radius:9px;margin-right:8px;vertical-align:middle}.pb i{display:block;height:100%;background:#f97316;border-radius:9px}
.att{padding:22px}.sel{font-size:18px;margin-bottom:16px}.ar{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin-bottom:10px;font-size:18px}
.ar span:first-child{flex:1;font-weight:600}.p{border:1px solid #cbd5e1;border-radius:8px;padding:6px 12px;font-size:15px}.p.on{background:#16a34a;color:#fff}.p.on2{background:#f59e0b;color:#fff}.p.on3{background:#dc2626;color:#fff}
.days{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:22px}.dy{background:#fff;border:1px dashed #94a3b8;border-radius:12px;padding:18px;font-weight:700;font-size:16px}.dy.on{border:1px solid #16a34a;color:#166534}.dy u{color:#c2410c}
.fb{margin:0 22px;background:#fff;border-radius:14px;padding:18px;border-left:6px solid #f97316;font-size:17px;line-height:1.7}.fb b{font-size:19px}
.arch{zoom:1.35;width:100%;display:flex;flex-direction:column;gap:30px;align-items:center}
.node{background:#fff;border:1px solid rgba(15,33,72,.14);border-radius:14px;padding:18px 20px;font-size:20px;font-weight:700;text-align:center;box-shadow:0 10px 24px -16px rgba(15,33,72,.4)}
.node.hub{background:#0f2148;color:#fff;font-size:30px;padding:26px 50px}.node.hub small{display:block;font-size:16px;color:#c9d3ea;font-weight:500;margin-top:6px}
.node.alt{background:#fff7ed;border-color:#fed7aa}.row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:980px}
.flow{zoom:1.1;flex-direction:column;display:flex;align-items:center;gap:14px}.fs{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px 18px;font-size:21px;font-weight:800;text-align:center;width:460px;box-shadow:0 10px 24px -16px rgba(15,33,72,.4)}
.fs small{display:block;font-size:14px;color:#64748b;font-weight:500;margin-top:8px}.fs.red{background:#fee2e2;color:#991b1b}.ar2{font-size:34px;color:#f97316;font-weight:900}
/* title / section */
.hero{position:absolute;inset:0;background:linear-gradient(135deg,#081226 0%,#0f2148 55%,#132a5c 100%);color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 140px}
.hero .lg{background:#fff;border-radius:16px;padding:16px 26px;display:inline-block;margin-bottom:46px;align-self:flex-start}.hero .lg img{height:70px;display:block}
.hero h1{font-size:130px;margin-bottom:14px}.hero h2{font-size:44px;font-weight:600;color:#fb923c;margin-bottom:46px}
.tags{display:flex;gap:16px}.tags span{border:2px solid rgba(255,255,255,.35);border-radius:999px;padding:12px 26px;font-size:24px;font-weight:700}
.hero.sec h1{font-size:96px}.hero .band{position:absolute;left:0;top:0;bottom:0;width:22px;background:#f97316}
/* split / three / grid / steps */
.full{position:absolute;top:84px;bottom:10px;left:0;right:0;padding:56px 72px}
.full h1{margin-bottom:40px}
.cols{display:flex;gap:36px}.col{flex:1;background:#fff;border-radius:20px;padding:34px;border:1px solid rgba(15,33,72,.1);box-shadow:0 20px 40px -28px rgba(15,33,72,.45)}
.col h3{font-size:36px;margin-bottom:24px}.col.navy{background:#0f2148;color:#fff}.col.navy li{color:#e8ebf5}
.col li{font-size:26px}
.cols.three .col h3{font-size:30px}.cols.three li{font-size:22px;padding-left:36px}.cols.three li:before{width:16px;height:16px;top:9px}
.cells{display:grid;grid-template-columns:1fr 1fr;gap:28px}.cell{background:#fff;border-radius:20px;padding:34px;border:1px solid rgba(15,33,72,.1);border-left:10px solid #f97316}
.cell h3{font-size:32px;margin-bottom:12px}.cell p{font-size:25px;line-height:1.45;color:#334155}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.step{background:#fff;border-radius:18px;padding:28px;border:1px solid rgba(15,33,72,.1);display:flex;gap:20px;align-items:center;font-size:26px;font-weight:700}
.step span{flex:0 0 64px;height:64px;border-radius:14px;background:#f97316;color:#081226;font-size:32px;font-weight:900;display:flex;align-items:center;justify-content:center}
.sfoot{margin-top:36px;font-size:24px;color:#334155;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:20px 26px}
`;

const top = (s, i) => `<div class="top"><img src="${logo}"><div class="sec ${s.section === 'Trainer View' ? 'tr' : ''}">${s.section}</div></div>`;
const foot = i => `<div class="foot"><i style="width:${((i + 1) / scenes.length * 100).toFixed(2)}%"></i></div>`;
const lis = a => `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>`;

function html(s, i) {
    let body;
    if (s.type === 'title') body = `<div class="hero"><div class="band"></div><div class="lg"><img src="${logo}"></div><h1>${s.title}</h1><h2>${s.sub}</h2><div class="tags">${s.tags.map(t => `<span>${t}</span>`).join('')}</div></div>`;
    else if (s.type === 'section') body = `<div class="hero sec"><div class="band"></div><div class="lg"><img src="${logo}"></div><h1>${s.title}</h1><h2>${s.sub}</h2></div>`;
    else {
        let inner;
        const head = `<div class="kick">${s.kicker}</div><h1>${s.title}</h1>`;
        if (s.type === 'split') inner = `${head}<div class="cols"><div class="col"><h3>${s.left.h}</h3>${lis(s.left.items)}</div><div class="col navy"><h3>${s.right.h}</h3>${lis(s.right.items)}</div></div>`;
        else if (s.type === 'three') inner = `${head}<div class="cols three">${s.cols.map(c => `<div class="col"><h3>${c.h}</h3>${lis(c.items)}</div>`).join('')}</div>`;
        else if (s.type === 'grid') inner = `${head}<div class="cells">${s.cells.map(c => `<div class="cell"><h3>${c.h}</h3><p>${c.t}</p></div>`).join('')}</div>`;
        else if (s.type === 'steps') inner = `${head}<div class="steps">${s.steps.map((t, k) => `<div class="step"><span>${k + 1}</span>${t}</div>`).join('')}</div><div class="sfoot">${s.foot}</div>`;
        if (inner) body = `${top(s)}<div class="full">${inner}</div><div class="num">${i} / ${scenes.length - 1}</div>`;
        else body = `${top(s)}<div class="wrap"><div class="txt">${head}${lis(s.points)}</div><div class="vis">${s.mock}</div></div><div class="num">${i} / ${scenes.length - 1}</div>`;
    }
    return `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}${foot(i)}</body></html>`;
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    for (const [i, s] of scenes.entries()) {
        await page.setContent(html(s, i), { waitUntil: 'networkidle' }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(FR, `${String(i).padStart(2, '0')}-${s.id}.png`) });
    }
    await browser.close();

    // One clip per scene with a fade in/out, then concatenate.
    const clips = [];
    scenes.forEach((s, i) => {
        const png = path.join(FR, `${String(i).padStart(2, '0')}-${s.id}.png`), clip = path.join(FR, `c${String(i).padStart(2, '0')}.mp4`);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', String(s.dur), '-i', png,
            '-f', 'lavfi', '-t', String(s.dur), '-i', 'anullsrc=r=48000:cl=stereo',
            '-vf', `fade=t=in:st=0:d=${FADE},fade=t=out:st=${(s.dur - FADE).toFixed(2)}:d=${FADE},format=yuv420p`,
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '30', '-c:a', 'aac', '-shortest', clip]);
        clips.push(clip);
    });
    fs.writeFileSync(path.join(FR, 'list.txt'), clips.map(c => `file '${c}'`).join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(FR, 'list.txt'), '-c', 'copy', '-movflags', '+faststart', path.join(OUT, 'LSH_Nexus_Blueprint.mp4')]);

    // Voice-over script and captions, on the same timings.
    const ts = (t, sep) => { const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = Math.floor(t % 60), ms = Math.round((t % 1) * 1000);
        return sep === ',' ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}` : `${m}:${String(sec).padStart(2, '0')}`; };
    let t = 0, md = `# LSH Nexus Blueprint — voice-over script\n\nVideo: \`LSH_Nexus_Blueprint.mp4\` (1920×1080, silent track). Each slide is timed for the narration below at an easy pace (~150 words a minute). Read each block while its slide is on screen.\n\n`, srt = '';
    const plain = x => x.replace(/&amp;/g, '&').replace(/<[^>]+>/g, '');
    scenes.forEach((s, i) => {
        md += `## ${ts(t)} – ${ts(t + s.dur)} · Slide ${i}: ${plain(s.title)}${s.section ? ` _(${s.section})_` : ''}\n\n${s.vo}\n\n`;
        srt += `${i + 1}\n${ts(t, ',')} --> ${ts(t + s.dur - 0.3, ',')}\n${s.vo}\n\n`;
        t += s.dur;
    });
    md += `---\nTotal running time: ${ts(t)}\n`;
    fs.writeFileSync(path.join(OUT, 'VOICEOVER_SCRIPT.md'), md);
    fs.writeFileSync(path.join(OUT, 'LSH_Nexus_Blueprint.srt'), srt);
    console.log('done', scenes.length, 'scenes,', t.toFixed(1), 's');
})();
