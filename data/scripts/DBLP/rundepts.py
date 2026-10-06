import csv
import glob
import html
import json
import os
import re
import unicodedata

# Run from the repository root: python data/scripts/DBLP/rundepts.py

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

OUT_DIR = "../../../depts"

# Same rule as nameToSlug() in js/departments.js, which builds the links.
def create_slug(name):
    normalized = unicodedata.normalize("NFKD", name)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")
    if not slug:
        raise ValueError(f"Institution name does not produce a valid slug: {name!r}")
    return slug

# Generates depts/<slug>.html (served as /depts/<slug>) from the template.
def create_page(inst_name, slug, template):
    # '<' is escaped so a name can never close the <script> block it is injected into.
    name_json = json.dumps(inst_name).replace("<", "\\u003c")
    page = (template
            .replace("INST_NAME_JSON", name_json)
            .replace("INST_NAME_HTML", html.escape(inst_name, quote=True))
            .replace("INST_SLUG", html.escape(slug, quote=True)))
    with open(os.path.join(OUT_DIR, slug + ".html"), 'w', encoding="utf-8") as out:
        out.write(page)

with open("../utils/_department_page.html", 'r', encoding="utf-8") as f:
    template = f.read()

areas = []
with open("../../../data/configs/research-areas-config.csv", 'r', encoding="utf-8") as f:
    for row in csv.reader(f):
        if row:
            areas.append(row[0])

# Institutions that appear in any area's scores or faculty list.
institutions = set()
for area in areas:
    with open("../../../data/" + area + "-out-scores.csv", 'r', encoding="utf-8") as f:
        for row in csv.reader(f):
            if row and row[0].strip():
                institutions.add(row[0].strip())
    with open("../../../data/" + area + "-out-profs-list.csv", 'r', encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) > 1 and row[1].strip():
                institutions.add(row[1].strip())

os.makedirs(OUT_DIR, exist_ok=True)
generated_slugs = {}

for inst in sorted(institutions):
    slug = create_slug(inst)
    if slug in generated_slugs:
        raise ValueError(
            f"Duplicate slug for {inst!r} and {generated_slugs[slug]!r}: {slug}"
        )
    generated_slugs[slug] = inst
    create_page(inst, slug, template)

# Removes pages of institutions that are no longer in the data; without this the
# old page would stay online. index.html is the department list, not an institution.
for page in glob.glob(OUT_DIR + "/*.html"):
    slug = os.path.basename(page)[:-len(".html")]
    if slug != "index" and slug not in generated_slugs:
        os.remove(page)

print(f"{len(generated_slugs)} department page(s) written to depts/")
