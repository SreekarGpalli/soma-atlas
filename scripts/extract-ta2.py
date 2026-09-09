"""
Terminologia Anatomica 2nd ed. (FIPAT 2019) PDF -> data/ta2-terms.json

TA2 is the international standard inventory of gross anatomy, and it is the
reference this atlas measures itself against. The PDF is a six-column table
(Latin | Latin synonym | UK English | US English | English synonym | Other)
laid out at fixed x positions, so rows are rebuilt by binding words to column
bands and joining wrapped lines onto the row above.

  python scripts/extract-ta2.py data/raw/ta2.pdf

Source: FIPAT. Terminologia Anatomica. 2nd ed. FIPAT.library.dal.ca, 2019.
CC BY-ND 4.0; the individual terms are public domain.
"""
import json, re, sys
from collections import defaultdict
from pathlib import Path

import fitz  # PyMuPDF

# Column bands, in PDF points. Every band starts just below the lowest word x0
# actually observed for that column, so indented child terms still land right.
BANDS = [(0, 90), (90, 210), (210, 322), (322, 436), (436, 549), (549, 662), (662, 900)]
KEYS = ["id", "latin", "latinSyn", "enUK", "enUS", "enSyn", "other"]
LATIN_X0 = 101.0   # x0 of a top-level Latin term; deeper terms are indented
INDENT_PT = 6.0

CHAP = re.compile(r"Chapter\s+(\d+):\s*([A-Z][A-Za-z ,\-]+)")
PART = re.compile(r"TA2,\s*Part\s+(\d+)")


def band_of(x):
    for i, (lo, hi) in enumerate(BANDS):
        if lo <= x < hi:
            return i
    return len(BANDS) - 1


def page_rows(page):
    """Words on one page, grouped into visual lines and split into column cells."""
    lines = defaultdict(list)
    for w in page.get_text("words"):
        if 40 < w[1] < 560:                    # drop running header and footer
            lines[round(w[1] / 4)].append(w)
    out = []
    for key in sorted(lines):
        ws = sorted(lines[key], key=lambda w: w[0])
        cells = ["" for _ in BANDS]
        indent = None
        for w in ws:
            b = band_of(w[0])
            cells[b] = (cells[b] + " " + w[4]).strip()
            if b == 1 and indent is None:
                indent = w[0]
        out.append((cells, indent))
    return out


def main(pdf_path, out_path):
    doc = fitz.open(pdf_path)
    rows, chapter, part = [], None, None

    for pno in range(doc.page_count):
        page = doc[pno]
        text = page.get_text()
        if m := PART.search(text):
            part = int(m.group(1))
        for m in CHAP.finditer(text):
            chapter = (int(m.group(1)), m.group(2).strip().title())

        lines = page_rows(page)
        # Only parse pages that really are the term table: front matter, part
        # title pages and endnote pages must not feed the continuation logic.
        starts = sum(
            1 for cells, _ in lines
            if re.fullmatch(r"\d{1,5}", cells[0]) and (cells[1] or cells[3])
        )
        if starts < 3:
            continue

        for cells, indent in lines:
            if re.fullmatch(r"\d{1,5}", cells[0]) and (cells[1] or cells[3]):
                rows.append({
                    **{k: cells[i] for i, k in enumerate(KEYS)},
                    "id": int(cells[0]),
                    "depth": max(0, round(((indent or LATIN_X0) - LATIN_X0) / INDENT_PT)),
                    "chapter": chapter[0] if chapter else None,
                    "chapterName": chapter[1] if chapter else None,
                    "part": part,
                    "page": pno + 1,
                })
            elif rows and not cells[0] and any(cells[1:]):
                prev = rows[-1]                 # wrapped continuation of the row above
                for i, k in enumerate(KEYS):
                    if i and cells[i]:
                        prev[k] = (prev[k] + " " + cells[i]).strip()

    # The last row of a chapter sits against the next chapter's header, so the
    # header words land in its cells. Strip them back off.
    header = re.compile(
        r"\s*\d+:\s*[A-Z][A-Z ,/-]*(?=\s|$)|\s*(?:US|UK) English\b|\s*Latin (?:term|synonym)\b"
        r"|\s*English synonym\b|\s*Chapter \d+\b|\s*Caput [IVXL]+\b|\s*\bEnglish\b"
    )   # no anatomical term contains "English", so the bare word is always header
    for r in rows:
        for k in KEYS[1:]:
            r[k] = re.sub(r"\s+", " ", header.sub(" ", r[k])).strip()

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    json.dump(rows, open(out_path, "w", encoding="utf8"), ensure_ascii=False,
              separators=(",", ":"))

    ids = [r["id"] for r in rows]
    gaps = sorted(set(range(min(ids), max(ids) + 1)) - set(ids))
    same = sum(1 for r in rows if r["enUK"] and r["enUK"] == r["enUS"])
    print(f"rows {len(rows)}  ids {min(ids)}-{max(ids)}  unique {len(set(ids))}")
    print(f"missing ids: {len(gaps)} {gaps[:20]}")
    print(f"UK==US English (parse sanity): {same}/{len(rows)} = {100*same//len(rows)}%")
    by = defaultdict(int)
    for r in rows:
        by[(r["chapter"], r["chapterName"])] += 1
    for k in sorted(by, key=lambda x: (x[0] is None, x[0])):
        print(f"  ch{k[0]:>3} {k[1]:<24} {by[k]}")
    print("wrote", out_path)


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "data/raw/ta2.pdf"
    dst = sys.argv[2] if len(sys.argv) > 2 else "data/ta2-terms.json"
    main(src, dst)
