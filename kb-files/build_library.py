#!/usr/bin/env python3
"""Builds kb-files/library.json from the official SOPs and resources in kb-files/sops/.

Each SOP is a Markdown page, sops/<slug>.md, that starts with a header:

    ---
    title: Medical Records Request SOP
    category: Medical Records & Billing      (one of the Knowledge Base categories)
    type: SOP                                (SOP, Guide, Resource, Template, Checklist or Policy)
    summary: One or two sentences on what it covers.
    tags: medical records, HIPAA, follow-up
    owner: Case Management team
    contributors: Ana Lopez, Jordan Link      (optional: people who wrote or improved it)
    version: 2.1
    updated: 2026-09-25
    file: Medical_Records_Request_SOP.pdf    (optional: the original, in sops/)
    ---
    The SOP text in Markdown…

Run from the repository root after adding or changing a page:  python3 kb-files/build_library.py
The Knowledge Base search uses the text written into library.json.
"""
import json, os, re, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
SOPS = os.path.join(HERE, "sops")
CATEGORIES = ['Case Management', 'EA / PA', 'Intake & Client Communication', 'Medical Records & Billing', 'Demands & Negotiation',
              'Liens & Subrogation', 'Litigation & Discovery', 'Calendaring & Docketing', 'Mass Tort', 'Family Law', 'Immigration Law',
              'Estate Planning', 'Business Law', 'Real Estate & Property', 'Tools & Systems', 'Productivity & Soft Skills', 'General']
TYPES = ['SOP', 'Guide', 'Resource', 'Template', 'Checklist', 'Policy']

def plain(md):
    md = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", md)
    md = re.sub(r"^[#>\s|-]+|\*\*|__|`|\|", " ", md, flags=re.M)
    return re.sub(r"\s+", " ", md).strip()

items, problems = [], []
for name in sorted(os.listdir(SOPS)):
    if not name.endswith(".md"):
        continue
    slug = name[:-3]
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", slug):
        problems.append(f"{name}: file names must be lowercase letters, numbers and dashes"); continue
    text = open(os.path.join(SOPS, name), encoding="utf8").read()
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    if not m:
        problems.append(f"{name}: missing the --- header"); continue
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1); meta[k.strip().lower()] = v.strip()
    body = text[m.end():]
    if meta.get("category") not in CATEGORIES:
        problems.append(f"{name}: category must be one of: {', '.join(CATEGORIES)}"); continue
    if meta.get("type", "SOP") not in TYPES:
        problems.append(f"{name}: type must be one of: {', '.join(TYPES)}"); continue
    f = meta.get("file")
    if f and not os.path.exists(os.path.join(SOPS, f)):
        problems.append(f"{name}: file {f} isn't in kb-files/sops/"); continue
    items.append({
        "id": slug, "title": meta.get("title") or slug, "category": meta["category"], "type": meta.get("type", "SOP"),
        "summary": meta.get("summary", ""), "tags": [t.strip().lower() for t in meta.get("tags", "").split(",") if t.strip()],
        "owner": meta.get("owner", "LSH"),
        "contributors": [c.strip() for c in meta.get("contributors", "").split(",") if c.strip()], "version": meta.get("version", ""), "updated": meta.get("updated", ""),
        "page": f"/kb-files/sops/{name}", "file": f"/kb-files/sops/{f}" if f else None, "fileName": f or None,
        "text": plain(body)[:20000]
    })

if problems:
    print("Not built:\n  " + "\n  ".join(problems)); sys.exit(1)
json.dump({"generatedAt": datetime.datetime.utcnow().isoformat() + "Z", "items": items},
          open(os.path.join(HERE, "library.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"library.json: {len(items)} item(s)")
