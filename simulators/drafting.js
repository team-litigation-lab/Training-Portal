/* ============================================================
   ✍ Drafting (shared) — the Letters of Representation, for every program.
   One tool instead of a copy per course: Standard Foundational Training and Case
   Management both open this page (the courses link to it with an SSO ticket, the
   way they already do for Email, Docket and Records), so the templates and the
   wording only ever live in one place — simulators/drafting/templates/.

   The page draws the letter block by block from drafting-data.js, which is
   generated from those .docx files: the firm's fixed wording is text, and the runs
   the firm highlighted in yellow are the fields. The download is not a re-typeset
   copy — drafting-docx.js writes the answers back into the original Word file, so
   the letterhead, logo, fonts and spacing are the firm's own and the document can
   be uploaded to SA as it is.

   Drafts are the trainee's own and stay in their browser (LSH_DRAFTING_V1); a
   finished letter is reported to their trainer through Sim.saveResult like every
   other simulator, so it counts in the Portal's per-module scores.
   ============================================================ */
(function () {
'use strict';
if (!window.LSH_DRAFTING_TEMPLATES) return;

const TEMPLATES = window.LSH_DRAFTING_TEMPLATES, CASES = window.LSH_DRAFTING_CASES || [];
const PROVIDERS = window.LSH_DRAFTING_PROVIDERS || [];
const KEY = 'LSH_DRAFTING_V1';
const esc = (v) => Sim.esc(String(v == null ? '' : v));
const app = () => document.getElementById('app');
// tab: a letter template's id, or 'prov' for the medical providers' letters, which are a letter
// per provider (their own address block is part of their own file) in two kinds.
const S = { tab: TEMPLATES[0].id, caseNo: 0, prov: 0, kind: 'medlor', answers: {}, savedAt: null };
const LETTER_KIND = { medlor: 'Medical LOR + Unsworn Declaration', lienbv: 'Lien Balance Verification' };

/* ---------- the trainee's own drafts, in their browser ---------- */
const slot = () => (Sim.who().name || 'practice').toLowerCase().replace(/\s+/g, ' ').trim();
function load() {
    try {
        const all = JSON.parse(localStorage.getItem(KEY) || '{}'), mine = all[slot()];
        if (mine) {
            S.answers = mine.answers || {}; S.caseNo = mine.caseNo || 0; S.savedAt = mine.savedAt || null;
            if (mine.prov != null) S.prov = mine.prov;
            if (mine.kind) S.kind = mine.kind;
        }
    } catch (e) { /* a first run, or storage turned off */ }
}
function save() {
    S.savedAt = new Date().toISOString();
    try {
        const all = JSON.parse(localStorage.getItem(KEY) || '{}');
        all[slot()] = { answers: S.answers, caseNo: S.caseNo, prov: S.prov, kind: S.kind, savedAt: S.savedAt };
        localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) { /* private window: the draft lives for this visit only */ }
}

/* ---------- the letter ---------- */
function provider() { return PROVIDERS[S.prov] || PROVIDERS[0] || null; }
function provLetter() {
    const p = provider(); if (!p) return null;
    return p.letters[S.kind] || p.letters.medlor || p.letters.lienbv || null;
}
// The letter on screen, with where its .docx lives and the id its answers are filed under
// (a provider's letters are per provider, so the id carries the provider and the kind).
function tpl() {
    if (S.tab === 'prov') {
        const p = provider(), t = provLetter();
        if (!t) return TEMPLATES[0];
        return Object.assign({}, t, { id: 'prov:' + p.id + ':' + t.id, dir: 'providers', provider: p.name });
    }
    const t = TEMPLATES.find(x => x.id === S.tab) || TEMPLATES[0];
    return Object.assign({}, t, { dir: 'templates' });
}
const srcOf = (t) => '/simulators/drafting/' + t.dir + '/' + t.file.split('/').map(encodeURIComponent).join('/');
const key = (tid, f) => tid + ':' + f;
const answer = (tid, f) => S.answers[key(tid, f)] || '';
// The letter's date is the day it is drafted, as a template editor fills it in.
const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
function fieldsOf(t) {
    const out = [];
    t.blocks.forEach(b => { if (b.t === 'p') b.runs.forEach(r => { if (r.f) out.push(r); }); });
    return out;
}
// What goes into the .docx: every field's answer, with the date filled in for them.
function answersFor(t) {
    const out = {};
    fieldsOf(t).forEach(r => {
        const v = r.k === 'date' ? today() : answer(t.id, r.f);
        if (String(v).trim()) out[r.f] = v;
    });
    return out;
}
// Fields the trainee is responsible for (the date writes itself).
const theirFields = (t) => fieldsOf(t).filter(r => r.k !== 'date');
const doneCount = (t) => theirFields(t).filter(r => String(answer(t.id, r.f)).trim()).length;

function runHtml(t, r) {
    if (!r.f) return esc(r.x).replace(/\n/g, '<br>') === '' ? '' : (r.b ? `<b>${esc(r.x).replace(/\n/g, '<br>')}</b>` : esc(r.x).replace(/\n/g, '<br>'));
    if (r.k === 'date') return `<span class="dr-auto" title="The date the letter is drafted — filled in for you, as a template editor does">${esc(today())}</span>`;
    const v = answer(t.id, r.f), filled = String(v).trim() ? ' filled' : '';
    const title = r.k === 'manual'
        ? 'The firm highlighted this line, but it is not a placeholder: type how the letter actually goes out.'
        : 'The firm highlighted this — fill it in.';
    if (r.k === 'long') {
        return `<textarea class="dr-f${filled}" data-f="${esc(r.f)}" rows="3" placeholder="${esc(r.ph)}" title="${esc(title)}"
            oninput="LSHDrafting.set('${esc(r.f)}', this.value)">${esc(v)}</textarea>`;
    }
    const size = Math.max(10, Math.min(70, (String(v) || r.ph).length + 2));
    return `<input class="dr-f${filled}" data-f="${esc(r.f)}" size="${size}" value="${esc(v)}" placeholder="${esc(r.ph)}"
        title="${esc(title)}" oninput="LSHDrafting.set('${esc(r.f)}', this.value)">`;
}
function paperHtml(t) {
    return t.blocks.map(b => {
        if (b.t === 'tbl') {
            return `<table class="dr-tbl"><tbody>${b.rows.map(row =>
                `<tr>${row.map(c => `<td>${esc(c).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        }
        const inner = b.runs.map(r => runHtml(t, r)).join('');
        return `<p class="${b.c ? 'c' : ''}${b.n ? ' n' : ''}">${inner || '&nbsp;'}</p>`;
    }).join('');
}

/* ---------- picking a provider and which of their two letters ---------- */
function providerBar() {
    const p = provider(); if (!p) return '';
    const kinds = Object.keys(p.letters);
    return `<div class="dr-bar">
        <select onchange="LSHDrafting.pickProvider(this.value)" aria-label="Medical provider"
            style="flex:1 1 320px;min-width:0;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:12.5px;">
            ${PROVIDERS.map((x, i) => `<option value="${i}" ${i === S.prov ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
        </select>
        ${kinds.map(k => `<button class="dr-tab ${k === S.kind ? 'on' : ''}" onclick="LSHDrafting.pickKind('${esc(k)}')">${esc(LETTER_KIND[k] || k)}</button>`).join('')}
    </div>`;
}

/* ---------- the case notes beside it ---------- */
function caseHtml() {
    if (S.tab === 'prov') {
        const p = provider(); if (!p) return '';
        return `<div class="dr-note">
            <h3>This provider</h3>
            <p style="margin:0 0 7px;"><b>${esc(p.name)}</b></p>
            <p style="margin:0;color:#64748b;">Their address block and the Unsworn Declaration of Custodian of Records are part of their own letter — the firm sent one file per provider, so nothing about them is typed in.</p>
        </div>`;
    }
    if (!CASES.length) return '';
    const c = CASES[S.caseNo] || CASES[0], side = S.tab === 'lor3p' ? c.p3 : c.p1;
    const rows = Object.keys(side || {}).map(k => `<dt>${esc(k)}</dt><dd>${esc(side[k])}</dd>`).join('');
    return `<div class="dr-note">
        <h3>Case notes · ${S.tab === 'lor3p' ? '3P' : '1P'}</h3>
        <select onchange="LSHDrafting.pickCase(this.value)" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;font:inherit;font-size:12px;margin-bottom:10px;">
            ${CASES.map((x, i) => `<option value="${i}" ${i === S.caseNo ? 'selected' : ''}>Case ${i + 1}${x.p1 && x.p1['Client Name'] ? ' · ' + esc(x.p1['Client Name']) : ''}</option>`).join('')}
        </select>
        ${rows ? `<dl>${rows}</dl>` : '<p style="margin:0;color:#64748b;">This case has no notes for this side.</p>'}
    </div>`;
}

/* ---------- the file name the trainers ask for ---------- */
function fileName(t) {
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    return t.naming
        .replace('mm.dd.yyyy', `${pad(d.getMonth() + 1)}.${pad(d.getDate())}.${d.getFullYear()}`)
        .replace("(VA's name)", `(${Sim.who().name || 'VA'})`)
        .replace(/[\\/:*?"<>|]/g, '');
}

function render() {
    const t = tpl(), done = doneCount(t), total = theirFields(t).length;
    app().innerHTML = `
        <div class="dr-bar">
            ${TEMPLATES.map(x => `<button class="dr-tab ${x.id === S.tab ? 'on' : ''}" onclick="LSHDrafting.tab('${esc(x.id)}')">${esc(x.title)}</button>`).join('')}
            ${PROVIDERS.length ? `<button class="dr-tab ${S.tab === 'prov' ? 'on' : ''}" onclick="LSHDrafting.tab('prov')">Medical provider letters</button>` : ''}
        </div>
        ${S.tab === 'prov' ? providerBar() : ''}
        <div class="dr-grid">
            <div class="dr-paper" id="dr-paper">${paperHtml(t)}</div>
            <div class="dr-side">
                <div class="dr-note">
                    <h3>This letter</h3>
                    <div class="dr-prog"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>
                    <div class="dr-saved">${done} of ${total} blanks filled${S.savedAt ? ` · saved ${new Date(S.savedAt).toLocaleTimeString()}` : ''}</div>
                    <div class="dr-actions" style="margin-top:12px;">
                        <button class="sim-btn orange" onclick="LSHDrafting.download()">⬇ Download the Word letter</button>
                        <button class="sim-btn ghost" onclick="LSHDrafting.submit()">✓ Send it to my trainer</button>
                        <a class="sim-btn ghost" href="${srcOf(t)}" download>⬇ The blank template</a>
                    </div>
                    <p style="margin:12px 0 4px;color:#64748b;">Saved as</p>
                    <div class="dr-name">${esc(fileName(t))}.docx</div>
                </div>
                ${caseHtml()}
                <div class="dr-note">
                    <h3>How this works</h3>
                    <p style="margin:0 0 7px;">The wording is the firm's and can't be changed. Only what the firm highlighted in yellow is yours to fill.</p>
                    <p style="margin:0 0 7px;">The date writes itself — it is the day you draft the letter.</p>
                    <p style="margin:0;">Your download is this very Word file with your answers written in, so the logo and the format are the firm's own. Upload that file to SA.</p>
                </div>
            </div>
        </div>`;
}

const API = {
    tab(id) { S.tab = id; render(); window.scrollTo(0, 0); },
    pickCase(i) { S.caseNo = Number(i) || 0; save(); render(); },
    pickProvider(i) {
        S.prov = Number(i) || 0;
        const p = provider();
        if (p && !p.letters[S.kind]) S.kind = Object.keys(p.letters)[0];   // not every provider sent both letters
        save(); render(); window.scrollTo(0, 0);
    },
    pickKind(k) { S.kind = k; save(); render(); window.scrollTo(0, 0); },
    set(f, v) {
        S.answers[key(S.tab, f)] = v;
        save();
        // Repaint only the counter: redrawing the paper would take the cursor out of the field.
        const t = tpl(), done = doneCount(t), total = theirFields(t).length;
        const bar = document.querySelector('.dr-prog i'), lbl = document.querySelector('.dr-saved');
        if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
        if (lbl) lbl.textContent = `${done} of ${total} blanks filled · saved ${new Date(S.savedAt).toLocaleTimeString()}`;
        const el = document.querySelector(`[data-f="${f}"]`);
        if (el) el.classList.toggle('filled', !!String(v).trim());
    },
    async download() {
        const t = tpl();
        try {
            const res = await fetch(srcOf(t), { credentials: 'include' });
            if (!res.ok) throw new Error('The template could not be loaded (' + res.status + ').');
            const out = await LSHDraftingDocx.fill(await res.arrayBuffer(), answersFor(t));
            const a = document.createElement('a');
            a.href = URL.createObjectURL(out.blob);
            a.download = fileName(t) + '.docx';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            // A blank left blank is still highlighted in the file, so say so rather than letting it go out quietly.
            alert(out.missing.length
                ? `Downloaded. ${out.filled} of ${out.total} blanks are filled — the ${out.missing.length} still empty stay highlighted in yellow in the letter.`
                : `Downloaded. All ${out.total} blanks are filled.`);
        } catch (e) {
            alert('The letter could not be built: ' + e.message);
        }
    },
    submit() {
        const t = tpl(), done = doneCount(t), total = theirFields(t).length;
        if (!total) return;
        if (done < total && !confirm(`${total - done} blank${total - done === 1 ? '' : 's'} still empty. Send it to your trainer anyway?`)) return;
        Sim.saveResult({
            simulator: S.tab === 'prov' ? 'Drafting — Medical Provider' : 'Drafting — LOR',
            scenario: S.tab === 'prov' ? `${t.title} · ${t.provider}` : t.title + (CASES.length ? ` · Case ${S.caseNo + 1}` : ''),
            score: total ? Math.round(done / total * 100) : 0,
            summary: `${done} of ${total} blanks filled`,
            details: { template: t.id, caseNo: S.tab === 'prov' ? null : S.caseNo + 1, provider: S.tab === 'prov' ? t.provider : null, answers: answersFor(t) }
        });
        alert('Sent to your trainer. Download the Word letter too if you need to upload it to SA.');
    }
};
window.LSHDrafting = API;

document.getElementById('topbar').innerHTML = Sim.topbar('drafting');
Sim.label('Drafting');
Sim.restore().then(() => { load(); render(); document.getElementById('topbar').innerHTML = Sim.topbar('drafting'); });
load(); render();
}());
