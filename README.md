# RoboIndexBR

RoboIndexBR gathers data on Brazilian scientific output in robotics, with
publications indexed from DBLP. The site presents the data by area,
department and author, along with individual profiles listing each author's papers.

## Running locally

The site is static and loads CSV files over HTTP. From the repository root,
start a local server:

```powershell
python -m http.server 8000
```

Open <http://localhost:8000>. Do not open `index.html` directly as a file,
because the browser blocks some of the local requests the pages rely on.

## Pages

- `index.html`: overview of the output by area.
- `authors.html`: author search and list.
- `depts.html`: department view.
- `stats.html`: totals, papers per year and per area, computed in the browser from the CSVs.
- `authors/`: individual profiles generated for the authors with available data.

## Layout

- `data/`: published CSVs, configuration and collection caches.
- `data/scripts/`: collection and generation scripts; see the
  [scripts guide](data/scripts/README.md) before updating data.
- `js/`: the interface's JavaScript and the libraries the site uses.
- `style/`: page styles.
- `images/`: icons and images used by the interface.

## Data

The time window currently displayed is 2021–2026.
Research areas and input data are configured in `data/configs/`. The scripts may make
external requests and update many files; review `git status` before
including the results in a commit.
