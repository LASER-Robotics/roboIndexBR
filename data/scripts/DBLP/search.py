# Disables certain Pylint warnings to allow more flexibility in the code.
# pylint: disable=W0311,C0103,C0116,C0200,R1714

import csv          # Library for reading and writing CSV files.
import re           # Library for working with regular expressions.
import sys          # Library for accessing system variables and command-line arguments.
import glob         # Library for finding files matching name patterns.
import os           # Library for interacting with the operating system (e.g. accessing files).
import unicodedata  # Library for normalizing names with and without accents.
from difflib import SequenceMatcher  # Library for comparing string sequences.
import requests     # Library for making HTTP requests (e.g. accessing DBLP).
import xmltodict    # Library for converting XML to Python dictionaries.

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

# Defines the range of years for the papers to be processed.
# Same for all areas and same as CSIndex's (FIRST_YEAR/LAST_YEAR in
# csindexbr.py), since 'cs' mirrors the robotics area there.
FIRST_YEAR = 2021
LAST_YEAR = 2026

class Global:
    default_min_paper_size = 0  # Default minimum page count for papers
    black_list = {}             # Papers that must not be counted (e.g. papers in invalid tracks)
    white_list = {}             # Papers that must be counted (e.g. papers without a page count)
    conflist = []               # List of conferences in the research area
    journallist = []            # List of journals in the research area
    out = {}                    # Stores the papers already found
    score = {}                  # Stores the department scores
    confdata = {}               # Stores information about conferences
    profs = {}                  # Stores data about the professors
    profs_list = []             # List of professors
    arxiv_cache = {}            # Cache of arXiv links
    manual_journals = {}        # Manually classified journals
    manual_classification = {}  # Manual classification of URLs
    pid_papers = []             # List of processed papers
    # Research area prefix (such as 'cs' for Computer Science).
    # Always lowercase: the site builds file names in lowercase, and
    # running "search.py CS" once generated "CS-out-papers.csv" — which works on
    # Windows and gives a 404 on any Linux host (GitHub Pages included).
    area_prefix = sys.argv[1].lower()
    researchers_file = 'all-researchers.csv'  # Area's researcher list (data/configs/)
    multi_area_journal_list = []  # List of multi-area journals
    mc_failed_file = open('../../../data/configs/manual-classification-failed.csv', 'a')  # File recording manual classification failures

# Functions for handling manually classified journals

def init_manual_files():
    # Reads the manual journal classification files and stores the information
    with open('../../../data/configs/manual-journals.txt') as mf:
        Global.manual_journals = mf.read().splitlines()  # Loads the manually classified journals
    reader = csv.reader(open('../../../data/configs/manual-classification.csv', 'r'))
    for row in reader:
        m_area, _, _, _, m_url = row  # Extracts the area and the journal URL
        Global.manual_classification[m_url] = m_area  # Associates the URL with its area

# Records classification failures of multi-area journals
def output_mc_failed(year, dblp_venue, title, url):
    if url in Global.multi_area_journal_list:
        return  # If the URL is already in the list, do nothing
    Global.multi_area_journal_list.append(url)  # Adds the URL to the list
    file = Global.mc_failed_file
    # Writes the failure to the file
    file.write(",")
    file.write(str(year))
    file.write(",")
    file.write('"' + str(dblp_venue) + '"')
    file.write(",")
    file.write('"' + title + '"')
    file.write(",")
    file.write(str(url))
    file.write("\n")

# Prints a message and closes the failures file
def output_multi_area_journal():
    if Global.multi_area_journal_list:
        print('\033[94m' + "Found papers in MULTI-AREA journals" + '\033[0m')
    Global.mc_failed_file.close()

# arxiv-related functions

def init_arxiv_cache():
    # Initializes the arXiv URL cache from a CSV file
    fname = '../../../data/cache/arxiv/' + Global.area_prefix + '-arxiv-cache.csv'
    if os.path.exists(fname):
        reader = csv.reader(open(fname, 'r'))
        for line in reader:
            Global.arxiv_cache[line[0]] = line[1] # Stores the DOI and its corresponding link

def output_arxiv_cache():
    # Saves the arXiv cache to a CSV file
    if Global.arxiv_cache:
        f = open('../../../data/cache/arxiv/' + Global.area_prefix + '-arxiv-cache.csv', 'w', encoding="utf-8", newline='')
        for doi in Global.arxiv_cache:
            f.write(doi)
            f.write(',')
            f.write(Global.arxiv_cache[doi])
            f.write('\n')
        f.close()

def get_arxiv_url(doi, title):
    # Tries to get the arXiv URL from the paper's DOI and title
    if not isinstance(doi, str):
        return "no_arxiv"
    if doi in Global.arxiv_cache:
        return Global.arxiv_cache[doi]  # Returns the arXiv URL from the cache
    try:
        title = title[:-1]
        ti = '"' + title + '"'
        url = "http://export.arxiv.org/api/query"
        payload = {'search_query': ti, 'start': 0, 'max_results': 1}
        arxiv_xml = requests.get(url, params=payload).text  # Makes a request to arXiv
        arxiv = xmltodict.parse(arxiv_xml)
        arxiv = arxiv["feed"]
        arxiv_url = "no_arxiv"
        nb_results = int(arxiv["opensearch:totalResults"]["#text"])
        if nb_results == 1:
            arxiv = arxiv["entry"]
            arxiv_title = arxiv["title"]
            t1 = arxiv_title.lower()
            t2 = title.lower()
            if SequenceMatcher(None, t1, t2).ratio() >= 0.9:
                arxiv_url = arxiv["id"]
    except:
        arxiv_url = "no_arxiv"
    Global.arxiv_cache[doi] = arxiv_url # Updates the cache
    return arxiv_url

# Data output functions

def output_everything():
    # Calls several functions to generate the output files
    output_papers()
    output_scores()
    output_venues()
    output_profs_list()
    output_arxiv_cache()
    output_search_box_list()
    output_multi_area_journal()

def output_venues():
    # Splits conferences and journals
    confs = []
    journals = []
    for p in Global.out.items():
        if p[1][7] == "C":
            confs.append(p[1][1])
        else:
            journals.append(p[1][1])
    result1_temp = sorted([(c, confs.count(c)) for c in Global.conflist], key=lambda x: x[0])
    result1 = sorted(result1_temp, key=lambda x: x[1], reverse=True)
    result2_temp = sorted([(c, journals.count(c)) for c in Global.journallist], key=lambda x: x[0])
    result2 = sorted(result2_temp, key=lambda x: x[1], reverse=True)
    output_venues_confs(result1)
    output_venues_journals(result2)

# list of conferences and the number of papers in each
def output_venues_confs(result):
    if len(result) > 0:
        f = open("../../../data/" + Global.area_prefix + '-out-confs.csv', 'w', encoding="utf-8", newline='')
        for conf in result:
            # conference_name,count
            f.write(conf[0])
            f.write(',')
            f.write(str(conf[1]))
            f.write('\n')
        f.close()

# list of journals and the number of papers in each
def output_venues_journals(result):
    if len(result) > 0:
        f = open("../../../data/" + Global.area_prefix + '-out-journals.csv', 'w', encoding="utf-8", newline='')
        for journal in result:
            f.write(journal[0])
            f.write(',')
            f.write(str(journal[1]))
            f.write('\n')
        f.close()

# Writes the details of a paper to the file (as a CSV row)
def write_paper(f, is_prof_tab, paper):
    # f -> file to write to
    # is_prof_tab -> If True, includes the professor's department
    # paper -> List with the paper's fields
    f.write(str(paper[0]))      # Paper year
    f.write(',')
    f.write(str(paper[1]))      # Venue (conference/journal)
    f.write(',')
    f.write(str(paper[2]))      # Title
    f.write(',')
    if is_prof_tab:
        f.write(str(paper[3]))  # department
        f.write(',')
    authors = paper[4]
    for author in authors[:-1]:      # Author(s)
        f.write(str(author))
        f.write('; ')
    f.write(str(authors[-1]))       # Last author
    f.write(',')
    f.write(str(paper[5]))      # DOI
    f.write(',')
    f.write(str(paper[6]))      # Conference/journal tier
    f.write(',')
    f.write(str(paper[7]))      # Publication type (C/J)
    f.write(',')
    f.write(str(paper[8]))  # arXiv link
    f.write(',')
    if paper[9] != -1:
        f.write(str(paper[9]))  # Citations
    f.write('\n')


# Generates the output files for the papers
def output_papers():
    # Sorts the papers first by conference/journal and then by title (columns 1 and 2)
    out2 = sorted(Global.out.items(), key=lambda x: (x[1][1], x[1][2]))

    # Sorts the papers by publication date (column 0) in descending order
    sorted_papers = sorted(out2, key=lambda x: x[1][0], reverse=True)

    # Opens a CSV file to save the processed papers
    f = open("../../../data/" + Global.area_prefix + '-out-papers.csv', 'w', encoding="utf-8", newline='')
    for i in range(0, len(sorted_papers)):
        paper = sorted_papers[i][1]
        write_paper(f, True, paper)
    f.close()

# generates a CSV with all of a professor's papers in a given area
def output_prof_papers(prof):
    # Replaces spaces in the professor's name with hyphens to form the file name
    prof = prof.replace(" ", "-")

    # Opens a specific CSV file to store the professor's papers
    f = open("../../../data/configs/profs/papers/" + Global.area_prefix + "-" + prof + '-papers.csv', 'w', encoding="utf-8", newline='')

    # Writes all of the professor's papers using the 'pid_papers' identifier stored in Global
    for url in Global.pid_papers:
        paper = Global.out[url]
        write_paper(f, False, paper)
    f.close()

# CSV of the departments' performance scores
def write_scores(sorted_scores):
    f = open("../../../data/" + Global.area_prefix + '-out-scores.csv', 'w', encoding="utf-8", newline='')

    # Writes the department scores to the file
    for i in range(0, len(sorted_scores)):
        # DepartmentName,Score
        dept = sorted_scores[i][0]
        f.write(str(dept))
        f.write(',')
        s = round(sorted_scores[i][1], 2)   # Score rounded to 2 decimal places
        f.write(str(s))
        f.write('\n')
    f.close()

def output_scores():
    final_score = {}

    # Filters the departments that have a score greater than 0
    for dept in Global.score:
        s = Global.score[dept]
        if s > 0:
            final_score[dept] = s

    # Sorts the departments by name (ascending)
    sorted_scores_temp = sorted(final_score.items(), key=lambda x: x[0])
    # Sorts again by score, in descending order
    sorted_scores = sorted(sorted_scores_temp, key=lambda x: x[1], reverse=True)
    write_scores(sorted_scores)

def write_profs(sorted_profs):
    # Opens a CSV file to save the list of professors and their scores
    f = open("../../../data/" + Global.area_prefix + '-out-profs.csv', 'w', encoding="utf-8", newline='')

    # Writes the department name and the professor count to the file
    for i in range(0, len(sorted_profs)):
        dept = sorted_profs[i][0]
        f.write(str(dept))
        f.write(',')
        s = sorted_profs[i][1]
        f.write(str(s))
        f.write('\n')
    f.close()

def output_profs():
    final_profs = {}

    # Filters the departments that have a professor count greater than 0
    for dept in Global.profs:
        s = Global.profs[dept]
        if s > 0:
            final_profs[dept] = s

    # Sorts the departments by name (ascending)
    sorted_profs_temp = sorted(final_profs.items(), key=lambda x: x[0])

    # Sorts again by count, in descending order
    sorted_profs = sorted(sorted_profs_temp, key=lambda x: x[1], reverse=True)

    # Limits the list to the first 16 entries
    if len(sorted_profs) >= 16:
        sorted_profs = sorted_profs[:16]
    write_profs(sorted_profs)

def output_profs_list():
    # Sorts the list of professors alphabetically
    profs = Global.profs_list
    profs = sorted(profs, key=lambda x: x[0])

    # Opens a CSV file to save the list of professors
    f = open("../../../data/" + Global.area_prefix + '-out-profs-list.csv', 'w', encoding="utf-8", newline='')
    for i in range(0, len(profs)):
        f.write(str(profs[i][0]))   # Professor name
        f.write(',')
        f.write(str(profs[i][1]))   # Professor's department
        f.write('\n')
    f.close()

# merges all of a professor's paper CSV files into a single CSV
def merge_output_prof_papers(prof):
    # Changes the directory to where the professors' papers are stored
    os.chdir("../../../data/configs/profs/all-articles/")

    # Creates a list
    filenames = []

    # Replaces spaces with hyphens in the professor's name to build the file name
    prof = prof.replace(" ", "-")

    # Finds all files containing the professor's name and ending in "-papers.csv"
    for file in glob.glob("../papers/*" + prof + "-papers.csv"):
        filenames.append(file)

    # Sorts the files by name
    filenames.sort()

    # Opens an output file to store the merged papers
    outfile = open( prof + ".csv", 'w', encoding="utf-8", newline='')

    for fname in filenames:
        with open(fname, encoding="utf-8") as infile:
            outfile.write(infile.read())
    os.chdir(SCRIPT_DIR)

# Generates all-authors.csv with the names present in the per-author paper files.
def output_search_box_list():
    # Changes the directory to the folder where the professors' paper files are located
    os.chdir("../../../data/configs/profs/all-articles/")

    # Keeps one form per name, preferring the one that preserves accents.
    profs = {}

    # Finds all CSV files in the folder and adds them to the list
    for file in sorted(glob.glob("*.csv")):
        file = file.replace(".csv", "") # Removes the ".csv" extension
        file = file.replace("-", " ")   # Replaces hyphens with spaces
        if any(marker in file for marker in ("Ã", "Â", "â")):
            file = file.encode("cp1252").decode("utf-8")
        key = ''.join(
            char for char in unicodedata.normalize("NFD", file.casefold())
            if unicodedata.category(char) != "Mn"
        )
        accent_count = sum(
            1 for char in unicodedata.normalize("NFD", file)
            if unicodedata.category(char) == "Mn"
        )
        if key not in profs or accent_count > profs[key][1]:
            profs[key] = (file, accent_count)

    # Sorts the professors alphabetically
    names = sorted(item[0] for item in profs.values())

    # Generates the all-authors.csv file
    f = open("../all-authors.csv", 'w', encoding="utf-8", newline='')
    for p in names:
        f.write(p)
        f.write('\n')
    f.close()
    os.chdir(SCRIPT_DIR)


# dblp parsing auxiliary functions

def get_paper_score(weight):
    # Assigns a score based on the paper's weight (classification)
    if (weight == 1) or (weight == 4):
        return 1.0  # Papers in top conferences or journals
    if weight == 2:
        return 0.66  # Papers in intermediate-tier conferences
    if (weight == 3) or (weight == 6) or (weight == 7):
        return 0.33  # Papers in lower-tier conferences
    if weight == 5:
        return 0.4   # Papers in lower-tier journals
    return 0.0       # Papers with no defined score

def get_doi(doi):
    # Checks the type of the DOI and returns the correct value
    if isinstance(doi, list):
        doi = doi[0]
    if isinstance(doi, dict):
        doi = doi["#text"]
    return doi

def get_venue_tier(weight):
    # Returns the venue's "tier" based on the weight (classification)
    if (weight == 1) or (weight == 4):
        return "top"  # Top venues
    if weight == 2:
        return "near-top"  # Near-top venues
    return "null"  # Others

def get_venue_type(weight):
    # Returns the venue type (C for conference, J for journal)
    if weight <= 3:
        return "C"  # Conference
    return "J"  # Journal

def get_authors(author_list):
    authors = []
    if isinstance(author_list, dict): # single author paper
        author_list = author_list["#text"]
        authors.append(author_list)
    elif isinstance(author_list, str):  # single author paper
        if isinstance(author_list, dict):
            author_list = author_list["#text"]
        authors.append(author_list)
    else:
        for name in author_list:
            if isinstance(name, dict):
                name = name["#text"]
            authors.append(name)
    return authors

# Extracts the title of a paper, removing the quotation marks
def get_title(title):
    if isinstance(title, dict):
        return title["#text"]
    return title.replace("\"", "")  # Removes quotation marks from the title

## kept from the original
def get_min_paper_size(weight):
    if weight == 6:  # magazine
        return 6  # Magazine papers (weight 6) have a minimum size of 6 pages
    if (weight == 4) or (weight == 5) or (weight == 7):  # journals
        return 0   # For journal papers with weight 4, 5 or 7, the minimum size is 0 (Elsevier journals lack page numbers)
    return Global.default_min_paper_size  # For conferences, uses the default minimum size defined in the Global class

def as_int(i):
    try:
        return int(i)  # Tries to convert the value to an integer
    except:
        return 0  # If an error occurs (value is not a valid number), returns 0

def parse_paper_size(dblp_pages):
    page = re.split(r"-|:", dblp_pages)  # Splits the page range on "-" or ":"

    if len(page) == 2:
        p1 = as_int(page[0])  # First page
        p2 = as_int(page[1])  # Last page
        return p2 - p1 + 1  # Computes the total number of pages

    if len(page) == 4:
        p1 = as_int(page[1])  # First page
        p2 = as_int(page[3])  # Last page
        return int(p2) - int(p1) + 1  # Computes the total number of pages

    if len(page) == 3:
        p1 = as_int(page[1])  # First page
        p2 = as_int(page[2])  # Last page
        return int(p2) - int(p1) + 1  # Computes the total number of pages

    return 0  # If the format is not an expected one, returns 0

def get_paper_size(url, dblp, dblp_venue):
    if url in Global.white_list:  # If the URL is in the white list, the paper counts as 10 pages
        return 10

    if 'pages' in dblp:  # If the paper has a 'pages' field, calls the function that computes the page count
        return parse_paper_size(dblp['pages'])

    if (dblp_venue == "CoRR") or \
        (dblp_venue == "J. Intell. Robotic Syst.") or \
        (dblp_venue == "Robotics & Autonomous Syst.") or \
        (dblp_venue == "Robotica") or \
        (dblp_venue == "Mechatronics") or \
        (dblp_venue == "IEEE Robotics & Automation Mag."):  # For specific venues, the size is fixed at 10
        return 10  # Because some papers lack page fields
    return 0  # Returns 0 if there is not enough information about the paper size

def get_dblp_venue(dblp):
    if 'journal' in dblp:  # If the paper is in a journal
        if (dblp['journal'] == "PACMPL") or \
            (dblp['journal'] == "PACMHCI") or \
            (dblp['journal'] == "Proc. ACM Program. Lang.") or \
            (dblp['journal'] == "Proc. ACM Softw. Eng.") or \
            (dblp['journal'] == "Proc. ACM Hum. Comput. Interact."):  # If it is a specific conference/journal
            if 'number' in dblp:
                dblp_venue = dblp['number']  # Event number
            else:
                dblp_venue = dblp['journal']  # If there is no number, uses the journal name
        else:
            dblp_venue = dblp['journal']  # Default case, takes the journal name
    elif 'booktitle' in dblp:  # If the paper was published in a book
        dblp_venue = dblp['booktitle']
    else:
        print("Failed parsing DBLP")  # If it is neither a journal nor a book
        sys.exit(1)  # Terminates the program due to a parsing error
    return dblp_venue  # Returns the journal or book name

def has_dept(dept_str, dept):
    dept_list = dept_str.split(";")  # Splits the department string into a list
    for d in dept_list:
        d = d.replace(" ", "")  # Removes whitespace
        if d == dept:  # Checks whether the current department matches the one sought
            return True
    return False  # Returns False if the department is not found

# manual list?
def is_manual_journal(year, dblp_venue, title, url):
    # Checks whether the journal is in the manual list of classified journals
    if dblp_venue in Global.manual_journals:
        # If the journal's URL is in the manual classification, checks the area
        if url in Global.manual_classification:
            m_area = Global.manual_classification[url]  # Gets the journal's area
            if m_area != Global.area_prefix:  # If the area does not match the research area
                return True  # Returns True to indicate it is a manual journal
        else:
            # If the URL is not in the manual classification, records the failure
            output_mc_failed(year, dblp_venue, title, url)
            return True  # Returns True indicating it is a manual journal
    return False  # If it is not manual, returns False

# main dblp parse function

def is_paper_size_ok(url, dblp, dblp_venue, weight):
    # Gets the paper size (page count) from the given data
    size = get_paper_size(url, dblp, dblp_venue)
    # Gets the minimum paper size based on the paper's weight (classification)
    minimum_size = get_min_paper_size(weight)
    # Checks whether the paper size is greater than or equal to the minimum size
    return size >= minimum_size

def update_paper(paper, dept, url, weight):
    # Updates the paper's data in the `Global.out` dictionary
    Global.out[url] = (paper[0], paper[1], paper[2], paper[3] + "; " + dept,
                        paper[4], paper[5], paper[6], paper[7], paper[8],
                        paper[9])
    # Updates the score of the department associated with the paper
    Global.score[dept] += get_paper_score(weight)

def add_new_paper(weight, doi, title, dblp, url, year, venue, global_department):
    # Determines the conference/journal tier from the weight
    tier = get_venue_tier(weight)
    # Determines the venue type (conference or journal)
    venue_type = get_venue_type(weight)
    # Gets the arXiv link associated with the paper
    arxiv = get_arxiv_url(doi, title)
    # Initializes the number of citations to 0
    citations = 0
    # Gets the paper's list of authors
    authors = get_authors(dblp['author'])
    # Adds the paper to the global data
    Global.out[url] = (year, venue, '"' + title + '"', global_department, authors, doi,
                        tier, venue_type, arxiv, citations)
    # Updates the department score based on the paper's weight
    Global.score[global_department] += get_paper_score(weight)

# Checks whether the paper is indexable (has 'journal' or 'booktitle' and is within the allowed year range)
def is_paper_indexable(dblp):
    if not isinstance(dblp, dict):
        return False
    if ('journal' in dblp) or ('booktitle' in dblp):
        dblp_venue = get_dblp_venue(dblp)  # Gets the conference/journal venue
        year = int(dblp['year'])  # Gets the paper's year
        # Checks that the paper is within the year range and that the conference/journal is valid
        if (year >= FIRST_YEAR) and (year <= LAST_YEAR) and (dblp_venue in Global.confdata):
            _, weight = Global.confdata[dblp_venue]
            url = dblp['url']
            if url in Global.black_list:
                return False  # If the paper is in the black list, it is not indexable
            title = get_title(dblp['title'])
            # Checks whether the journal is manually classified and must not be indexed
            if is_manual_journal(year, dblp_venue, title, url):
                return False
            # Checks whether the paper has an adequate size
            return is_paper_size_ok(url, dblp, dblp_venue, weight)
    return False  # If the paper is not valid for indexing, returns False

def parse_dblp(_, dblp):
    global global_department, global_found_paper

    # Checks whether the paper can be indexed
    if is_paper_indexable(dblp):
        dblp_venue = get_dblp_venue(dblp)  # Gets the conference/journal venue
        year = int(dblp['year'])  # Gets the paper's year
        venue, weight = Global.confdata[dblp_venue]  # Gets the conference/journal name and its weight
        url = dblp['url']  # Paper URL
        doi = get_doi(dblp['ee'])  # Paper DOI
        title = get_title(dblp['title'])  # Paper title

        global_found_paper = True   # Marks that the paper was found
        Global.pid_papers.append(url)  # Adds the paper to the list of found papers

        if url in Global.out:  # If the paper was already processed
            paper = Global.out[url]
            # Checks whether the paper was already assigned to the department
            if has_dept(paper[3], global_department):
                return True  # If it was, does nothing
            update_paper(paper, global_department, url, weight)  # Updates the paper's data
            return True

        # Adds a new paper to the database
        add_new_paper(weight, doi, title, dblp, url, year, venue, global_department)

    return True   # Continues processing the next papers

# init functions

def init_black_list():
    # Reads the black list of papers that must not be counted
    black_list_file = "../../../data/" + Global.area_prefix + "-black-list.txt"
    if os.path.exists(black_list_file):
        with open(black_list_file) as blf:
            Global.black_list = blf.read().splitlines()  # Stores the URLs of the black-listed papers

def init_white_list():
    # Reads the white list of papers that must be counted
    white_list_file = "../../../data/" + Global.area_prefix + "-white-list.txt"
    if os.path.exists(white_list_file):
        with open(white_list_file) as wlf:
            Global.white_list = wlf.read().splitlines()  # Stores the URLs of the white-listed papers

def init_prof_cache():
    # Removes the professors' old cache files
    prof_cache_pattern = "../cache/profs/" + Global.area_prefix + "-*.csv"
    for f in glob.glob(prof_cache_pattern):
        os.remove(f)

def init_confs():
    # Reads the conference and journal data from a CSV file
    reader = csv.reader(open("../../../data/"+ Global.area_prefix + "-confs.csv", 'r'))
    for conf_row in reader:
        conf_dblp, conf_name, conf_weight = conf_row
        Global.confdata[conf_dblp] = conf_name, int(conf_weight)  # Stores the conference name and weight
        if int(conf_weight) <= 3:
            Global.conflist.append(conf_name)  # If the weight is low, it is a conference
        else:
            Global.journallist.append(conf_name)  #_
    Global.conflist = list(set(Global.conflist))  # removing duplicates
    Global.journallist = list(set(Global.journallist))  # removing duplicates

def init_min_paper_size():
    # Opens the "research-areas-config.csv" file to read the research area settings
    reader = csv.reader(open("../../../data/configs/research-areas-config.csv", 'r'))

    # Iterates over each row of the CSV file
    for area_tuple in reader:
        # Checks whether the research area prefix in the file equals the global area prefix
        if area_tuple[0] == Global.area_prefix:
            # If so, sets the minimum paper size based on the file's configuration
            Global.default_min_paper_size = int(area_tuple[1])
            # Column 3 (optional): the area's own researcher list.
            # 'cs' uses CSIndex's, to be identical to the cs area there.
            if len(area_tuple) >= 3:
                Global.researchers_file = area_tuple[2]
            break  # Leaves the loop after finding the matching area

def init_everything():
    # Initializes several settings, including the minimum paper size, conferences, manually classified lists, etc.
    init_min_paper_size()    # Initializes the minimum paper size
    init_confs()             # Initializes conference data
    init_black_list()        # Initializes the black list of papers to ignore
    init_white_list()        # Initializes the white list of papers to include
    init_manual_files()      # Initializes the manual classification files
    init_arxiv_cache()       # Initializes the arXiv link cache
    init_prof_cache()        # Initializes the professors' cache

# main loop that process each researcher

def read_dblp_file(pid, prof):
    # Replaces spaces in the professor's name with hyphens to form the file name
    prof = prof.replace(" ", "-")

    # Defines the path of the professor's cached XML file
    file = '../../../data/cache/dblp/' + prof + '.xml'

    # If the XML file already exists in the cache, opens it and reads its contents
    if os.path.exists(file):
        with open(file, encoding="utf-8") as f:
            dblp_xml = f.read()
    else:
        # Otherwise, makes a request to DBLP to get the XML file
        try:
            url = "http://dblp.org/pid/" + pid + ".xml"
            response = requests.get(url, timeout=180)
            # Fails instead of writing an empty or error response to the cache,
            # which would break every following run.
            response.raise_for_status()
            dblp_xml = response.text
            # Saves the XML file in the local cache
            with open(file, 'w', encoding="utf-8") as f:
                f.write(str(dblp_xml))
        except requests.exceptions.RequestException as e:
            print(e)
            sys.exit(1)  # Terminates the program if the request fails
    return dblp_xml  # Returns the contents of the XML file

def process_prof_with_paper(prof, dept):
    # Adds the professor and their department to the list of professors
    Global.profs_list.append((prof, dept))

    # Increments the professor count of the corresponding department
    Global.profs[dept] += 1

    # Calls the function that generates the file with the professor's papers
    output_prof_papers(prof)

    # Merges the professor's papers and saves them in a single CSV file
    merge_output_prof_papers(prof)

def process_department_data(dept):
    # If the department has no defined score, initializes it to 0
    if not dept in Global.score:
        Global.score[dept] = 0.0

    # If the department has not been registered, initializes the professor count
    if not dept in Global.profs:
        Global.profs[dept] = 0

def process_all_researchers():
    global global_department, global_found_paper

    # Reads the file with all the researchers
    all_researchers = csv.reader(open("../../../data/configs/" + Global.researchers_file, 'r', encoding="utf-8"))
    count = 1
    print("Research Area: " + Global.area_prefix)  # Prints the research area

    # Iterates over all the researchers
    for researcher in all_researchers:
        prof = researcher[0]   # Professor name
        global_department = researcher[1]   # Professor's department
        pid = researcher[2]    # Professor's DBLP ID

        # Processes the data of the professor's department
        process_department_data(global_department)

        # Reads the professor's DBLP XML file
        bibfile = read_dblp_file(pid, prof)

        # Resets the professor's paper list
        Global.pid_papers = []
        global_found_paper = False    # Global variable indicating whether a paper was found

        # Converts the XML to a dictionary and processes the papers
        xmltodict.parse(bibfile, item_depth=3, item_callback=parse_dblp)

        # If a paper was found, processes the professor and their papers
        if global_found_paper:
            process_prof_with_paper(prof, global_department)
            print(str(count) + " >> " + prof + ", " + global_department)  # Prints the progress

        count = count + 1  # Increments the counter of processed researchers

# main program

init_everything()
process_all_researchers()
output_everything()
