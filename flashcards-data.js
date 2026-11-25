// 🃏 Flash Cards: the decks and the day's pick, shared by the Flash Cards page (flashcards.html) and the Flash Cards
// card on the LSH Academy Index (programs.html), so both show the same card of the day. To add cards, add them to a
// deck below; the daily pick moves through each deck in order. Nothing here is saved anywhere.
(function () {
    const DECKS = [
        { id: 'rules', label: 'Rules', icon: '📏', cards: [
            ['Can a legal assistant tell a client whether their case is “worth it”?', 'No. Evaluating a case or predicting an outcome is legal advice. Take the question down word for word and pass it to the attorney.'],
            ['What is the first thing you do with a new deadline?', 'Calendar it the same day, with reminders ahead of it (for example 30, 14, 7 and 1 day), and note the source of the date (rule, order or letter).'],
            ['Who may you discuss a client’s case with?', 'Only the client, the firm’s team on the matter, and people the client authorized in writing. Confirm identity before you share anything.'],
            ['A client emails a document you can’t open. What do you do?', 'Tell the client you received it, ask for it again in a readable format (PDF or photo), and never guess at its contents in the file notes.'],
            ['What goes in every file note?', 'Date, time, who you spoke with, how (call, email, text), what was said or done, and the next step with its due date.'],
            ['Can you sign the attorney’s name on a letter?', 'Only if the attorney has authorized it for that kind of letter and the firm’s policy allows it. Otherwise it goes to the attorney for signature.'],
            ['A medical provider asks for the settlement amount. What do you say?', 'Nothing about the amount. Confirm the balance they claim and their lien or reduction request, and route it to the attorney or case manager.'],
            ['What is the rule on adjuster calls?', 'Be courteous, take notes, confirm the claim number, and don’t agree to recorded statements, settlement figures or releases. Those go to the attorney.'],
            ['When do you escalate a client complaint?', 'Right away, the same day, to your supervisor or the attorney, with the client’s exact words in the note.'],
            ['Can you change a date on the calendar without telling anyone?', 'No. Any change to a deadline or appointment is noted with who approved it, and everyone on the matter is told.']
        ] },
        { id: 'trivia', label: 'Trivia', icon: '💡', cards: [
            ['What does “PI” stand for in a firm’s practice areas?', 'Personal Injury: claims for harm to a person caused by someone else’s negligence or wrongdoing.'],
            ['What does the “UM” in UM/UIM coverage mean?', 'Uninsured Motorist. UIM is Underinsured Motorist: coverage when the at-fault driver has no insurance or not enough.'],
            ['What is the most common type of PI case?', 'Motor vehicle accidents (car, truck, motorcycle).'],
            ['What does “HIPAA” protect?', 'The privacy of a patient’s health information. Providers need a signed HIPAA authorization before they release records to the firm.'],
            ['What color highlighter do many firms use for deadlines on a printed calendar?', 'Trick question: it depends on the firm. Always follow your firm’s own color code.'],
            ['What does “ER” stand for in medical records, and why does it matter?', 'Emergency Room. Its records are often the first proof of injury right after the incident.'],
            ['Who usually pays a client’s medical bills first after a car accident in a no-fault state?', 'The client’s own PIP (Personal Injury Protection) coverage, up to its limit.'],
            ['What is a “policy limit”?', 'The most an insurance policy will pay for a covered claim. A demand often asks for it.'],
            ['What does “Esq.” after a name mean?', 'Esquire: a title used by attorneys.'],
            ['What is “discovery” in a lawsuit?', 'The stage where each side asks the other for information: interrogatories, requests for documents, admissions and depositions.']
        ] },
        { id: 'terms', label: 'Terminologies', icon: '📖', cards: [
            ['Statute of limitations', 'The deadline to file a lawsuit. Miss it and the claim is usually barred for good. It varies by state and by type of claim.'],
            ['Letter of Representation (LOR)', 'The letter telling an insurer or party that the firm now represents the client and that all contact goes through the firm.'],
            ['Subrogation', 'An insurer’s right to be paid back from the settlement for what it paid on the client’s behalf (health insurer, PIP, Medicare).'],
            ['Lien', 'A legal claim against the settlement by someone owed money for the client’s care, such as a hospital, provider, Medicare or Medicaid.'],
            ['MMI (Maximum Medical Improvement)', 'The point where the client’s condition is not expected to get better with more treatment. Demands are often sent after it.'],
            ['Medical specials (“specials”)', 'The total of the client’s medical bills and other money losses that can be added up, such as lost wages.'],
            ['Demand letter', 'The letter to the insurer setting out liability, injuries, treatment and damages, and asking for a settlement amount.'],
            ['Release', 'The document the client signs to settle: it ends the claim against the released parties in exchange for payment.'],
            ['Liability', 'Legal responsibility for the harm. In PI, whether and how much the other party is at fault.'],
            ['Comparative negligence', 'A rule that reduces the recovery by the client’s own share of fault (and in some states bars recovery past a set percentage).']
        ] },
        { id: 'process', label: 'Process', icon: '🔁', cards: [
            ['What are the main stages of a PI case?', 'Intake → investigation and treatment → records and bills → demand → negotiation → settlement (or lawsuit) → liens resolved → disbursement and closing.'],
            ['What happens right after a client signs up?', 'Open the file, run the conflict check, calendar the statute of limitations, send LORs to every insurer, and set up the first client check-in.'],
            ['How do you request medical records?', 'Send the provider a request with the client’s signed HIPAA authorization, track the date sent, and follow up on a schedule until they arrive.'],
            ['What goes into a demand package?', 'Demand letter, police report, photos, medical records and bills, wage loss proof, and a summary of injuries and treatment.'],
            ['What do you check before a settlement is disbursed?', 'Signed release, settlement funds cleared, every lien and bill confirmed and resolved, and the attorney-approved settlement statement signed by the client.'],
            ['How does a case close?', 'Final disbursement sent, liens paid, closing letter to the client, file reviewed and archived according to the firm’s retention rules.'],
            ['What is the follow-up rhythm with a treating client?', 'Regular check-ins (often every 2 to 4 weeks) on treatment, new providers, missed visits and how they are doing, each logged in the file.'],
            ['When do you send the first lien request?', 'Early: as soon as a possible lienholder is known, ask for their itemized lien so there are no surprises at settlement.'],
            ['What do you do when an adjuster makes an offer?', 'Log it with date and amount, send it to the attorney right away, and don’t comment on it to the adjuster.'],
            ['How do you hand off a file to another team member?', 'A short written summary: status, open tasks with due dates, upcoming deadlines, and who to contact. Then confirm they received it.']
        ] },
        { id: 'faqs', label: 'FAQs', icon: '❓', cards: [
            ['Client: “How long will my case take?”', 'Explain that it depends on treatment and negotiations, that the team will keep them updated, and offer to have the attorney go over the timeline.'],
            ['Client: “Should I talk to the other driver’s insurance?”', 'Ask them not to give statements and to send any calls or letters to the firm. The firm handles that contact.'],
            ['Client: “Can I post about the accident online?”', 'Recommend they don’t: posts and photos can be used against the claim. If they want details, the attorney can explain.'],
            ['Client: “Why do you need my medical records?”', 'They prove the injuries and treatment the claim is built on. The HIPAA authorization lets the firm request them on their behalf.'],
            ['Client: “Who pays my bills while the case is open?”', 'It depends on their coverage (PIP, MedPay, health insurance). Note what they are getting and let the case manager review it with them.'],
            ['Client: “How much is my case worth?”', 'You can’t give a value. Explain that the attorney evaluates it once treatment and records are complete.'],
            ['Client: “I missed a doctor’s appointment. Is that a problem?”', 'Gaps in treatment can hurt the claim. Encourage them to reschedule and log the missed visit in the file.'],
            ['Client: “Why is part of my settlement going to my health insurer?”', 'Their insurer may have a right to be repaid (subrogation or a lien). The attorney works to reduce it and will explain the numbers.'],
            ['Client: “Can I switch doctors?”', 'Usually yes, but let the firm know first so records and bills from the new provider are requested and tracked.'],
            ['Client: “When will I get my check?”', 'After the release is signed, funds clear and liens are resolved. Give them the current step and the next update date.']
        ] }
    ];
    // today, in the viewer's own time zone: the same card for everyone on the same day, so a batch can talk about it
    const day = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    // today's digest: one card from each deck
    const today = (d = day()) => DECKS.map((deck, i) => ({ deck, i: (d + i * 3) % deck.cards.length }));
    // the card of the day on the LSH Academy Index: one card, from the next deck in turn each day
    // (Rules, Trivia, Terminologies, Process, FAQs, then Rules again), the same card that deck shows in today's digest
    const one = (d = day()) => today(d)[d % DECKS.length];
    window.LSH_FLASHCARDS = { DECKS, day, today, one };
})();
