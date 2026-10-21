#!/usr/bin/env python3
"""Builds simulators/drafting-data.js from the firm's own Word templates in templates/.

The parser is the courses' one (Case-Management-Training and Foundational-Training,
build/drafting_docx.py + build/lor/make_lor_data.py), vendored here so the Portal's
shared Drafting tool reads the templates exactly the way the two courses did.

A letter is read block by block, exactly as Word has it, so the firm's wording carries
over untouched. The only thing treated specially is what the firm highlighted in yellow:
each highlighted run becomes a field the trainee fills in, numbered f1, f2 ... in
document order. That numbering is the contract with drafting.js, which fills the SAME
.docx by walking it the same way and writing each answer into its highlighted run —
so a download is the firm's document, letterhead and logo included, not a re-typeset copy.

Usage:
  python3 simulators/drafting/make-drafting-data.py
Re-run it whenever the trainers send new templates; never hand-edit the output.
"""
import json, os, re, sys, zipfile
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(HERE, "templates")
DEST = os.path.join(os.path.dirname(HERE), "drafting-data.js")

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
LONG_FIELD = 120          # a highlighted run longer than this is a textarea, not a one-line field


def body_of(path):
    with zipfile.ZipFile(path) as z:
        return ET.fromstring(z.read("word/document.xml")).find(W + "body")


def runs_of(p):
    """Every run of a paragraph, in document order — including runs Word wrapped in <w:sdt>."""
    out = []
    for r in p.iter(W + "r"):
        rPr = r.find(W + "rPr")
        hl = bold = False
        if rPr is not None:
            h = rPr.find(W + "highlight")
            hl = h is not None and (h.get(W + "val") or "none") != "none"
            bold = rPr.find(W + "b") is not None
        txt = ""
        for node in r:
            tag = node.tag.replace(W, "")
            if tag == "t": txt += node.text or ""
            elif tag == "tab": txt += "\t"
            elif tag == "br": txt += "\n"
            elif tag == "sym": txt += "☐"        # a Wingdings box → ☐
        if txt: out.append({"hl": hl, "b": bold, "x": txt})
    # Word splits a line into many runs as it is edited: join the neighbours that look the same,
    # so one highlighted phrase is one field rather than five.
    merged = []
    for r in out:
        if merged and merged[-1]["hl"] == r["hl"] and merged[-1]["b"] == r["b"]: merged[-1]["x"] += r["x"]
        else: merged.append(dict(r))
    return merged


def template(path, tid, title, naming, manual_prefix="SENT VIA"):
    blocks, n = [], 0
    for i, child in enumerate(body_of(path)):
        tag = child.tag.replace(W, "")
        if tag == "tbl":
            blocks.append({"t": "tbl", "rows": [
                [" ".join("".join(x["x"] for x in runs_of(p)) for p in tc.iter(W + "p")).strip()
                 for tc in tr.findall(W + "tc")] for tr in child.findall(W + "tr")]})
            continue
        if tag != "p": continue
        runs = []
        for r in runs_of(child):
            if not r["hl"]:
                runs.append({"x": r["x"], "b": True} if r["b"] else {"x": r["x"]})
                continue
            n += 1
            if i == 0: k = "date"
            elif r["x"].strip().upper().startswith(manual_prefix): k = "manual"
            elif len(r["x"]) > LONG_FIELD: k = "long"
            else: k = "field"
            runs.append({"f": "f%d" % n, "ph": r["x"], "k": k})
        blk = {"t": "p", "runs": runs}
        pPr = child.find(W + "pPr")
        if pPr is not None:
            if pPr.find(W + "numPr") is not None: blk["n"] = 1
            jc = pPr.find(W + "jc")
            if jc is not None and jc.get(W + "val") == "center": blk["c"] = 1
        blocks.append(blk)
    return {"id": tid, "title": title, "naming": naming, "file": os.path.basename(path), "blocks": blocks}


def cases(path):
    """The case notes: one case per "For 1P LOR Drafting" heading, with the 3P set that follows it."""
    out, cur, side = [], None, None
    for p in body_of(path).iter(W + "p"):
        line = re.sub(r"\s+", " ", "".join(t.text or "" for t in p.iter(W + "t"))).strip()
        m = re.match(r"^For (1P|3P) LOR Drafting$", line)
        if m:
            side = m.group(1)
            if side == "1P": cur = {"p1": {}, "p3": {}}; out.append(cur)
            continue
        if line.startswith("•") and cur and side and ":" in line:
            k, v = line[1:].split(":", 1)
            cur["p1" if side == "1P" else "p3"][k.strip()] = v.strip().rstrip(".")
    return out


def main():
    ts = [template(os.path.join(TPL, "1P_LOR.docx"), "lor1p",
                   "Letter of Representation (LOR) — 1P",
                   "INS – 1P Insurance Provider - LOR mm.dd.yyyy (VA's name)"),
          template(os.path.join(TPL, "3P_LOR_with_Affidavit.docx"), "lor3p",
                   "Letter of Representation (LOR) with Affidavit — 3P",
                   "INS – 3P Insurance Provider - LOR with Affidavit mm.dd.yyyy (VA's name)")]
    cs = cases(os.path.join(TPL, "Case_Notes_For_Drafting_Activity_SA_Demo.docx"))
    if not cs: sys.exit("No cases found in the case notes.")
    for t in ts:
        if not any(r.get("f") for b in t["blocks"] if b["t"] == "p" for r in b["runs"]):
            sys.exit("No highlighted fields in " + t["id"] + ": is the template still highlighted in yellow?")
    head = """/* ============================================================
   ✍ Drafting (shared) — the firm's letter templates, block by block.
   GENERATED by simulators/drafting/make-drafting-data.py from the .docx files in
   simulators/drafting/templates/ — the same files the courses use. Do not hand-edit:
   run the script again with new templates, so they stay exactly as the firm wrote them.
     • LSH_DRAFTING_TEMPLATES  each letter's blocks. A run the firm highlighted in yellow
                               is a field ({f, ph, k}); everything else is fixed wording.
                               k: "date" auto-generated · "manual" typed by hand ·
                                  "long" a textarea · "field" a one-line field.
                               f1, f2 … number the highlighted runs in document order: the
                               same order drafting.js walks when it fills the real .docx.
     • LSH_DRAFTING_CASES      the cases of "Case Notes For Drafting Activity (SA Demo)".
   ============================================================ */
"""
    js = (head + "window.LSH_DRAFTING_TEMPLATES = " + json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + ";\n"
          + "window.LSH_DRAFTING_CASES = " + json.dumps(cs, ensure_ascii=False, separators=(",", ":")) + ";\n")
    open(DEST, "w", encoding="utf8").write(js)
    print("%s: %d cases, %d fields" % (os.path.basename(DEST), len(cs),
          sum(1 for t in ts for b in t["blocks"] if b["t"] == "p" for r in b["runs"] if r.get("f"))))


if __name__ == "__main__":
    main()
