/* LSH Training Portal — state filing profiles, shared by the Court E-Filing and Appellate
   E-Filing simulators.

   Filing rules are state-specific: the provider you file through, what the trial and
   appellate courts are called, the first-paper fee, how long you have to appeal, how long a
   brief may be, and which rule governs redaction. The simulators run on GLOBAL defaults —
   the rules nearly every US court shares — and a state picked from the dropdown overlays the
   parts that state does differently. Anything a state doesn't set falls back to GLOBAL.

   Training figures: fees and deadlines are realistic but are teaching values, not a
   substitute for the current rule. Check the court's own rules before a real filing. */

const FS_GLOBAL = {
    code: '', name: 'Global (general US practice)',
    provider: 'Court E-Filing Service Provider',
    trialCourt: 'County Superior Court',
    appealsCourt: 'State Court of Appeals',
    highCourt: 'State Supreme Court',
    limitMB: 35,                      // per-file upload limit
    efspFee: 4.95,                    // provider's convenience fee
    firstPaper: { unlimited: 435, limited: 225, threshold: 35000 },
    redactionRule: 'the court\'s privacy rule (personal identifiers redacted to the year of birth and the last four digits)',
    noa: { days: 60, from: 'the notice of entry of judgment', rule: 'the state rule on the time to appeal' },
    noaFee: 775,                      // filing fee for the notice of appeal / record
    briefWords: { opening: 14000, answering: 14000, reply: 7000 },
    coverColors: { opening: 'blue', answering: 'red', reply: 'gray' },
    record: 'the appellate record',
    recordChoices: ['Clerk\'s transcript', 'Appendix prepared by the parties', 'Agreed statement'],
    note: 'General US practice. Pick the state you file in to see how that state does it.'
};

/* Only what the state does differently from GLOBAL. */
const FS_STATES = [
    { code: 'CA', name: 'California', provider: 'California e-filing service provider (GreenFiling, One Legal, File & ServeXpress)',
      trialCourt: 'Superior Court of California, County of —', appealsCourt: 'California Court of Appeal', highCourt: 'Supreme Court of California',
      limitMB: 25, firstPaper: { unlimited: 435, limited: 225, threshold: 35000 },
      redactionRule: 'Cal. Rules of Court, rule 1.201 (first name and last four digits only)',
      noa: { days: 60, from: 'the notice of entry of judgment (180 days if no notice is served)', rule: 'Cal. Rules of Court, rule 8.104' },
      noaFee: 775, briefWords: { opening: 14000, answering: 14000, reply: 7000 },
      coverColors: { opening: 'green', answering: 'yellow', reply: 'tan' },
      record: 'the record on appeal', recordChoices: ['Clerk\'s transcript (rule 8.122)', 'Appendix (rule 8.124)', 'Agreed statement (rule 8.134)', 'Reporter\'s transcript (rule 8.130)'],
      note: 'Unlimited civil is over $35,000. The notice of appeal is filed in the superior court, not the Court of Appeal.' },
    { code: 'TX', name: 'Texas', provider: 'eFileTexas.gov (through an EFSP)',
      trialCourt: 'District Court of — County, Texas', appealsCourt: 'Court of Appeals (Texas)', highCourt: 'Supreme Court of Texas',
      limitMB: 35, firstPaper: { unlimited: 350, limited: 54, threshold: 250000 },
      redactionRule: 'Tex. R. Civ. P. 21c (sensitive data redacted)',
      noa: { days: 30, from: 'the judgment is signed (90 days if a motion for new trial is filed)', rule: 'Tex. R. App. P. 26.1' },
      noaFee: 205, briefWords: { opening: 15000, answering: 15000, reply: 7500 },
      record: 'the appellate record (clerk\'s record and reporter\'s record)',
      recordChoices: ['Clerk\'s record', 'Reporter\'s record', 'Agreed statement of the case'],
      note: 'Texas calls it a notice of appeal filed in the trial court; the appellate record comes in two parts.' },
    { code: 'NY', name: 'New York', provider: 'NYSCEF (New York State Courts Electronic Filing)',
      trialCourt: 'Supreme Court of the State of New York, County of —', appealsCourt: 'Appellate Division', highCourt: 'New York Court of Appeals',
      limitMB: 100, firstPaper: { unlimited: 210, limited: 95, threshold: 50000 },
      redactionRule: 'N.Y. C.P.L.R. 2101(a) and 22 NYCRR 202.5(e) (confidential personal information omitted or redacted)',
      noa: { days: 30, from: 'service of the judgment or order with written notice of entry', rule: 'C.P.L.R. 5513(a)' },
      noaFee: 65, briefWords: { opening: 14000, answering: 14000, reply: 7000 },
      record: 'the record on appeal', recordChoices: ['Full reproduced record', 'Appendix method (C.P.L.R. 5528)', 'Agreed statement in lieu of record (C.P.L.R. 5527)'],
      note: 'In New York the trial court is called the Supreme Court; an appeal from it goes to the Appellate Division.' },
    { code: 'FL', name: 'Florida', provider: 'Florida Courts E-Filing Portal (myflcourtaccess.com)',
      trialCourt: 'Circuit Court of the — Judicial Circuit, Florida', appealsCourt: 'Florida District Court of Appeal', highCourt: 'Supreme Court of Florida',
      limitMB: 50, firstPaper: { unlimited: 401, limited: 300, threshold: 50000 },
      redactionRule: 'Fla. R. Gen. Prac. & Jud. Admin. 2.425 (minimization of sensitive information)',
      noa: { days: 30, from: 'rendition of the order being appealed', rule: 'Fla. R. App. P. 9.110(b)' },
      noaFee: 100, briefWords: { opening: 13000, answering: 13000, reply: 5000 },
      record: 'the record on appeal prepared by the clerk',
      note: 'The notice of appeal is filed with the clerk of the lower tribunal, with the appellate filing fee.' },
    { code: 'IL', name: 'Illinois', provider: 'eFileIL (through an EFSP)',
      trialCourt: 'Circuit Court of — County, Illinois', appealsCourt: 'Illinois Appellate Court', highCourt: 'Supreme Court of Illinois',
      limitMB: 50, firstPaper: { unlimited: 388, limited: 221, threshold: 50000 },
      redactionRule: 'Ill. S. Ct. R. 138 (personal identity information)',
      noa: { days: 30, from: 'entry of the final judgment', rule: 'Ill. S. Ct. R. 303(a)' },
      noaFee: 50, briefWords: { opening: 15000, answering: 15000, reply: 7000 },
      record: 'the record on appeal' },
    { code: 'GA', name: 'Georgia', provider: 'PeachCourt / Odyssey eFileGA',
      trialCourt: 'State Court of — County, Georgia', appealsCourt: 'Court of Appeals of Georgia', highCourt: 'Supreme Court of Georgia',
      limitMB: 35, firstPaper: { unlimited: 215, limited: 215, threshold: 15000 },
      redactionRule: 'O.C.G.A. § 9-11-7.1 (personal information redacted)',
      noa: { days: 30, from: 'entry of the appealable decision', rule: 'O.C.G.A. § 5-6-38(a)' },
      noaFee: 80, briefWords: { opening: 8400, answering: 8400, reply: 4200 },
      record: 'the record and transcript transmitted by the trial court clerk' },
    { code: 'AZ', name: 'Arizona', provider: 'AZTurboCourt', trialCourt: 'Superior Court of Arizona in — County',
      appealsCourt: 'Arizona Court of Appeals', highCourt: 'Arizona Supreme Court',
      firstPaper: { unlimited: 349, limited: 211, threshold: 10000 },
      noa: { days: 30, from: 'entry of the judgment', rule: 'Ariz. R. Civ. App. P. 9(a)' }, noaFee: 280,
      briefWords: { opening: 14000, answering: 14000, reply: 7000 } },
    { code: 'NV', name: 'Nevada', provider: 'Odyssey eFileNV / Clark County e-filing',
      trialCourt: 'Eighth Judicial District Court, Clark County, Nevada', appealsCourt: 'Nevada Court of Appeals', highCourt: 'Nevada Supreme Court',
      firstPaper: { unlimited: 270, limited: 101, threshold: 50000 },
      noa: { days: 30, from: 'service of written notice of entry of the judgment', rule: 'NRAP 4(a)' }, noaFee: 250,
      briefWords: { opening: 14000, answering: 14000, reply: 7000 },
      note: 'Nevada appeals start in the Supreme Court, which pushes cases down to the Court of Appeals.' },
    { code: 'WA', name: 'Washington', provider: 'Washington Courts e-filing (county portals)',
      trialCourt: 'Superior Court of Washington for — County', appealsCourt: 'Washington Court of Appeals', highCourt: 'Washington Supreme Court',
      firstPaper: { unlimited: 240, limited: 83, threshold: 100000 },
      noa: { days: 30, from: 'entry of the decision', rule: 'RAP 5.2(a)' }, noaFee: 350,
      briefWords: { opening: 12000, answering: 12000, reply: 6000 } },
    { code: 'OH', name: 'Ohio', provider: 'County clerk e-filing (CourtView / Odyssey)',
      trialCourt: 'Court of Common Pleas, — County, Ohio', appealsCourt: 'Ohio Court of Appeals', highCourt: 'Supreme Court of Ohio',
      firstPaper: { unlimited: 300, limited: 150, threshold: 15000 },
      noa: { days: 30, from: 'entry of the judgment', rule: 'Ohio App. R. 4(A)' }, noaFee: 125,
      briefWords: { opening: 8400, answering: 8400, reply: 4200 } },
    { code: 'PA', name: 'Pennsylvania', provider: 'PACFile / county e-filing',
      trialCourt: 'Court of Common Pleas of — County, Pennsylvania', appealsCourt: 'Superior Court of Pennsylvania', highCourt: 'Supreme Court of Pennsylvania',
      firstPaper: { unlimited: 331, limited: 190, threshold: 50000 },
      noa: { days: 30, from: 'entry of the order on the docket', rule: 'Pa. R.A.P. 903(a)' }, noaFee: 90,
      briefWords: { opening: 14000, answering: 14000, reply: 7000 },
      note: 'Pennsylvania\'s intermediate court for most civil appeals is the Superior Court.' },
    { code: 'NJ', name: 'New Jersey', provider: 'eCourts (New Jersey Judiciary)',
      trialCourt: 'Superior Court of New Jersey, Law Division, — County', appealsCourt: 'Appellate Division of the Superior Court', highCourt: 'New Jersey Supreme Court',
      firstPaper: { unlimited: 250, limited: 75, threshold: 20000 },
      noa: { days: 45, from: 'entry of the final judgment', rule: 'N.J. Ct. R. 2:4-1(a)' }, noaFee: 250,
      briefWords: { opening: 17500, answering: 17500, reply: 8750 } },
    { code: 'NC', name: 'North Carolina', provider: 'eCourts File & Serve (Odyssey)',
      trialCourt: 'General Court of Justice, Superior Court Division, — County, NC', appealsCourt: 'North Carolina Court of Appeals', highCourt: 'Supreme Court of North Carolina',
      firstPaper: { unlimited: 200, limited: 96, threshold: 25000 },
      noa: { days: 30, from: 'entry of the judgment', rule: 'N.C. R. App. P. 3(c)' }, noaFee: 15,
      briefWords: { opening: 8750, answering: 8750, reply: 3750 } }
];

const FilingStates = {
    KEY: 'LSH_FILING_STATE',
    all() { return [FS_GLOBAL].concat(FS_STATES); },
    /* A state profile with every GLOBAL default filled in behind it. */
    get(code) {
        const s = FS_STATES.find(x => x.code === String(code || '').toUpperCase());
        if (!s) return Object.assign({}, FS_GLOBAL);
        const p = Object.assign({}, FS_GLOBAL, s);
        ['firstPaper', 'noa', 'briefWords', 'coverColors'].forEach(k => { p[k] = Object.assign({}, FS_GLOBAL[k], s[k] || {}); });
        return p;
    },
    /* What the trainee last picked, so both simulators open on the same state. */
    current() { try { return localStorage.getItem(FilingStates.KEY) || ''; } catch (e) { return ''; } },
    set(code) { try { localStorage.setItem(FilingStates.KEY, code || ''); } catch (e) {} },
    /* <select> for the page header. onchange is the name of a global handler, e.g. 'EF.state'. */
    picker(onchange, cur) {
        const c = cur == null ? FilingStates.current() : cur;
        return `<label class="fs-pick"><span>State rules</span><select onchange="${onchange}(this.value)">
            ${FilingStates.all().map(s => `<option value="${s.code}" ${s.code === c ? 'selected' : ''}>${s.code ? s.code + ' — ' + s.name : s.name}</option>`).join('')}
        </select></label>`;
    },
    /* The one-line summary under the picker. */
    blurb(p) {
        const bits = [p.provider, p.trialCourt, `${p.limitMB} MB per file`, `appeal within ${p.noa.days} days of ${p.noa.from}`];
        return bits.join(' · ');
    },
    money(n) { return '$' + Number(n || 0).toFixed(2); }
};
