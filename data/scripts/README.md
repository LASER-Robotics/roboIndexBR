# Data scripts

This directory contains the scripts used to collect and build RoboIndexBR data.
Run commands from the repository root unless noted otherwise.

## DBLP pipeline

The scripts in `DBLP/` form the main data pipeline:

1. Download or validate the local DBLP XML cache:

   ```powershell
   python data/scripts/DBLP/dblp.py
   python data/scripts/DBLP/dblp.py -test
   ```

   The first command downloads researcher records. `-test` validates the
   existing cache without downloading it again.

2. Process one research area at a time:

   ```powershell
   python data/scripts/DBLP/search.py robotics
   ```

   Replace `robotics` with an area prefix configured in
   `data/configs/research-areas-config.csv`. This step reads the DBLP cache and
   writes the area's publication, researcher, venue, and score files under
   `data/` and `data/configs/`.

3. Generate author profiles and their manifests:

   ```powershell
   python data/scripts/DBLP/runprofs.py
   ```

   This reads the generated author/article data, writes profile pages to
   `authors/`, and updates `data/configs/profs/profs.csv` and
   `data/configs/profs/pages.csv`. The HTML fragments in `utils/` are its
   templates. Pages are linked without the `.html` extension, which GitHub Pages
   serves as-is.

   Then generate one page per institution:

   ```powershell
   python data/scripts/DBLP/rundepts.py
   ```

   This reads the area score and faculty files, writes `departments/<slug>.html`
   from `utils/_department_page.html` and removes pages of institutions that left
   the data.

4. Generate department summaries after the area data and profile metadata are
   up to date:

   ```powershell
   python data/scripts/DBLP/robdepts.py
   ```

   This writes department summaries under `data/configs/depts/`.

The collection and processing steps can update many tracked data files. Review
`git status` before committing their output.

Step 2 only rewrites files for researchers that still have papers. For a full
rebuild (e.g. after changing the year window or removing researchers), first
delete `data/configs/profs/papers/*.csv` and
`data/configs/profs/all-articles/*.csv`, then run step 2 for every area before
steps 3 and 4.

## Experiments

`experiments/scholar/` contains exploratory Semantic Scholar scripts. They are
not part of the DBLP pipeline and may make network requests or write cache and
CSV files. Run them only when intentionally testing that data source.

## Dependencies

The DBLP scripts require `requests` and `xmltodict`; the experimental Scholar
scripts require `requests`. Install missing packages in the Python environment
used to run the scripts.
