import csv
import glob
import os
import html
import re
import unicodedata

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

# Takes the file path and returns the number of lines
def file_size(file):
    try:
        with open(file, encoding="utf-8") as f:
            return sum(1 for line in f)
    except UnicodeDecodeError:
        with open(file, encoding="latin1") as f:
            return sum(1 for line in f)

# For each professor, checks the size of the files found
# Determines the area from the file with the largest number of lines
def get_area(prof):
    size = 0
    area = ""
    files = glob.glob("../../../data/configs/profs/papers/*" + prof + "-papers.csv")
    for file in files:
        size2 = file_size(file)
        if size2 > size:
            size = size2
            basename = os.path.basename(file)  # File name only
            area = basename[:basename.index('-')]  # Takes everything up to the first '-'
    return area.upper()

def create_slug(name):
    normalized = unicodedata.normalize("NFKD", name)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")
    if not slug:
        raise ValueError(f"Author name does not produce a valid slug: {name!r}")
    return slug

# Generates the profile at authors/<slug>.html (served as /authors/<slug>) from the template fragments.
def create_profile(prof_name, slug):
    canonical_slug = html.escape(slug, quote=True)
    canonical_name = "../../../authors/" + slug + '.html'
    line = '      var corebr_author = "' + prof_name + '"\n'
    os.makedirs("../../../authors", exist_ok=True)

    out = open(canonical_name, 'w', encoding="utf-8")
    file1 = open('../utils/_faculty_profile_start.html', 'r', encoding="utf-8")
    file2 = open('../utils/_faculty_profile_end.html', 'r', encoding="utf-8")

    out.write(file1.read().replace("AUTHOR_SLUG", canonical_slug))
    out.write(line)
    out.write(file2.read())

    out.close()
    file1.close()
    file2.close()

# Dictionary storing the institutional affiliation of each professor
inst = {}
reader1 = csv.reader(open("../../../data/configs/all-researchers.csv", 'r', encoding="utf-8"))
for p in reader1:
    prof = p[0]
    dept = p[1]
    inst[prof] = dept

# Generates the authors' metadata and the manifest of available profiles.
out2 = open('../../../data/configs/profs/profs.csv', 'w', encoding="utf-8")  # CSV file for the information

# Manifest of the generated pages. The site reads this file to know who has a
# page: not every name in all-authors.csv generates one, and linking them all
# would produce 404s. Written here so it never gets out of sync with the profiles.
out3 = open('../../../data/configs/profs/pages.csv', 'w', encoding="utf-8")

# Writes the CSV file header
# out2.write('Name,Institution,Area\n')

# Reads the names in all-authors.csv
reader2 = csv.reader(open("../../../data/configs/profs/all-authors.csv", 'r', encoding="utf-8"))
missing = []
generated_slugs = {}

for p in reader2:
    prof = p[0]
    p2 = prof.replace(" ", "-")
    slug = create_slug(prof)

    # Not every name in all-authors.csv has an entry in all-researchers.csv.
    # Skips those names and reports the absence without interrupting the other pages.
    if prof not in inst:
        missing.append(prof)
        continue

    dept = inst[prof]

    # Here we call get_area() to find the professor's area
    area = get_area(p2)

    if slug in generated_slugs:
        raise ValueError(
            f"Duplicate slug for {prof!r} and {generated_slugs[slug]!r}: {slug}"
        )
    generated_slugs[slug] = prof

    create_profile(p2, slug)
    out3.write(p2 + '\n')

    # Writes the information to the CSV file (name, institution, area)
    out2.write(f'{prof},{dept},{area}\n')

# Closes the files
out2.close()
out3.close()

# Removes profiles of authors that were not generated in this run (they left the
# list or have no papers); without this the old page would stay online.
# index.html is the author list itself, not a profile.
for page in glob.glob("../../../authors/*.html"):
    slug = os.path.basename(page)[:-len(".html")]
    if slug != "index" and slug not in generated_slugs:
        os.remove(page)

if missing:
    print(f"{len(missing)} name(s) in all-authors.csv without an entry in "
          f"all-researchers.csv — no page generated:")
    for name in missing:
        print("  -", name)