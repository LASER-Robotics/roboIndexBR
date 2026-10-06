/* ---------------------------------------------------------------------------
   RoboIndexBR — statistics
   ---------------------------------------------------------------------------
   Equivalent to CSIndexbr's statistics.html page, but computed in the browser
   from each area's CSVs (nothing is pasted by hand): totals, papers per year
   and a comparison between areas.

   Columns of data/<area>-out-papers.csv: 0 year, 1 venue, 2 title,
   3 institutions, 4 authors, 5 DOI, 6 top-venue badge ('null' if it is not),
   7 type (C|J), 8 arXiv ('no_arxiv' if there is none).
   --------------------------------------------------------------------------- */

/* global RoboIndexRender */

(function () {
  'use strict';

  var AREAS = {
    robotics: 'Robotics (general)',
    cs: 'Computer Science',
    control: 'Electrical and Control Systems',
    mech: 'Mechanical Design and Mechatronics'
  };

  var currentArea = 'all';
  var dataByArea = {};
  var target = null;

  function clear(el) {
    while (el.firstChild) { el.removeChild(el.firstChild); }
  }

  function hasContent(row) {
    if (!row || row.length === 0) { return false; }
    return row.some(function (c) {
      return c !== '' && c !== 0 && c !== null && c !== undefined;
    });
  }

  function loadCSV(file) {
    return $.get(file).then(function (text) {
      return $.csv.toArrays(text, { onParseValue: $.csv.hooks.castToScalar })
        .filter(hasContent);
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function showMessage(state, title, body) {
    clear(target);
    var box = el('div', 'rbr-state');
    var msg = el('div', 'rbr-message rbr-message--' + state);
    msg.appendChild(el('p', 'rbr-message__title', title));
    msg.appendChild(el('p', 'rbr-message__body', body));
    box.appendChild(msg);
    target.appendChild(box);
  }

  function showLoading() {
    clear(target);
    var box = el('div', 'rbr-state');
    var spinner = el('div', 'rbr-spinner');
    spinner.setAttribute('role', 'status');
    box.appendChild(spinner);
    box.appendChild(el('p', 'rbr-state__text', 'Loading statistics…'));
    target.appendChild(box);
  }

  /* --- Computation ---------------------------------------------------------- */

  function paperKey(row) {
    var doi = String(row[5] || '').trim().toLowerCase();
    return doi && doi !== 'null'
      ? doi
      : String(row[0]).trim() + '|' + String(row[2]).trim().toLowerCase();
  }

  function isTop(row) {
    var badge = row[6];
    return !!badge && badge !== 'null';
  }

  function hasArxiv(row) {
    var arxiv = row[8];
    return !!arxiv && arxiv !== 'no_arxiv' && arxiv !== 'null';
  }

  function key(text) {
    return String(text).trim().toLowerCase();
  }

  /* Summary of a set of papers (already without duplicates). */
  function summarize(papers) {
    var s = { total: 0, confs: 0, journals: 0, top: 0, arxiv: 0, years: {}, venuesC: {}, venuesJ: {} };

    papers.forEach(function (r) {
      s.total++;
      var year = Number(r[0]) || 0;
      if (!s.years[year]) { s.years[year] = { total: 0, top: 0 }; }
      s.years[year].total++;

      if (r[7] === 'C') {
        s.confs++;
        s.venuesC[key(r[1])] = true;
      } else {
        s.journals++;
        s.venuesJ[key(r[1])] = true;
      }
      if (isTop(r)) { s.top++; s.years[year].top++; }
      if (hasArxiv(r)) { s.arxiv++; }
    });

    return s;
  }

  function uniquePapers(areas) {
    var seen = {};
    var list = [];
    areas.forEach(function (area) {
      dataByArea[area].papers.forEach(function (r) {
        var k = paperKey(r);
        if (seen[k]) { return; }
        seen[k] = true;
        list.push(r);
      });
    });
    return list;
  }

  function countAuthors(areas) {
    var seen = {};
    areas.forEach(function (area) {
      dataByArea[area].profs.forEach(function (r) { seen[key(r[0])] = true; });
    });
    return Object.keys(seen).length;
  }

  function countInstitutions(areas) {
    var seen = {};
    areas.forEach(function (area) {
      dataByArea[area].profs.forEach(function (r) {
        if (r[1]) { seen[key(r[1])] = true; }
      });
    });
    return Object.keys(seen).length;
  }

  function count(object) {
    return Object.keys(object).length;
  }

  function change(previous, current) {
    if (!previous) { return '—'; }
    var v = Math.round(((current - previous) / previous) * 100);
    return (v > 0 ? '+' : '') + v + '%';
  }

  /* --- Drawing -------------------------------------------------------------- */

  function section(title) {
    var block = el('section', 'rbr-stats-section');
    block.appendChild(el('h2', 'rbr-panel-tab__title', title));
    return block;
  }

  function cards(items) {
    var grid = el('div', 'rbr-metrics');
    items.forEach(function (item) {
      var card = el('div', 'rbr-metric');
      card.appendChild(el('span', 'rbr-metric__value', item[1].toLocaleString('en-US')));
      card.appendChild(el('span', 'rbr-metric__label', item[0]));
      grid.appendChild(card);
    });
    return grid;
  }

  /* The current year is still being collected, so its bar is not comparable
     with the closed years. */
  function yearLabel(year, partialYear) {
    return year === partialYear ? year + ' (partial)' : String(year);
  }

  function render(area) {
    var areas = area === 'all' ? Object.keys(AREAS) : [area];
    var papers = uniquePapers(areas);

    if (!papers.length) {
      showMessage('info', 'No paper data yet',
        area === 'all'
          ? 'There are no indexed papers yet.'
          : 'The collection for ' + AREAS[area] + ' has not produced papers yet.');
      return;
    }

    var s = summarize(papers);
    clear(target);

    target.appendChild(cards([
      ['Authors', countAuthors(areas)],
      ['Institutions', countInstitutions(areas)],
      ['Papers', s.total],
      ['Journal papers', s.journals],
      ['Conference papers', s.confs],
      ['Papers in top venues', s.top],
      ['Papers with an arXiv preprint', s.arxiv],
      ['Journals with papers', count(s.venuesJ)],
      ['Conferences with papers', count(s.venuesC)]
    ]));

    /* Per year */
    var years = Object.keys(s.years).map(Number).filter(Boolean).sort(function (a, b) { return a - b; });
    var partialYear = years[years.length - 1] >= new Date().getFullYear() ? years[years.length - 1] : null;

    var yearsBlock = section('Papers per year');
    var yearsChart = el('div', 'rbr-chart rbr-chart--table');
    yearsBlock.appendChild(yearsChart);
    target.appendChild(yearsBlock);

    RoboIndexRender.columns(
      { target: yearsChart, width: target.clientWidth || 800,
        rows: years.map(function (y) { return [yearLabel(y, partialYear), s.years[y].total]; }) },
      { title: partialYear
          ? partialYear + ' is still being collected; the partial bar is not comparable with the closed years.'
          : 'Total papers per publication year.',
        accessibleSummary: 'Bar chart with the number of papers per year' }
    );

    var yearsTable = el('div', 'rbr-chart rbr-chart--table');
    yearsBlock.appendChild(yearsTable);
    RoboIndexRender.table({ target: yearsTable }, [
      { label: 'Year', type: 'number', sortable: false },
      { label: 'Papers', type: 'number', sortable: false },
      { label: 'In top venues', type: 'number', sortable: false },
      { label: 'Change', type: 'text', sortable: false }
    ], years.map(function (y, i) {
      var previous = i ? s.years[years[i - 1]].total : 0;
      return [
        { html: yearLabel(y, partialYear), order: y },
        s.years[y].total,
        s.years[y].top,
        y === partialYear ? '—' : change(previous, s.years[y].total)
      ];
    }), { stacked: true });
    target.appendChild(yearsBlock);

    /* Per area: count for each area, without deduplicating across them. */
    var areasBlock = section('Papers per area');
    var areasTable = el('div', 'rbr-chart rbr-chart--table');
    areasBlock.appendChild(areasTable);
    target.appendChild(areasBlock);

    var areaRows = Object.keys(AREAS).map(function (id) {
      var sa = summarize(dataByArea[id].papers);
      return [AREAS[id], sa.total, sa.confs, sa.journals, sa.top];
    });
    RoboIndexRender.table({ target: areasTable }, [
      { label: 'Area', type: 'text' },
      { label: 'Papers', type: 'number' },
      { label: 'In conferences', type: 'number' },
      { label: 'In journals', type: 'number' },
      { label: 'In top venues', type: 'number' }
    ], areaRows, { sortBy: 1, descending: true, stacked: true });
    areasBlock.appendChild(el('p', 'rbr-note',
      'Areas with 0 papers have not had their data collected yet.'));
  }

  function loadAllAreas() {
    showLoading();
    var areas = Object.keys(AREAS);
    var requests = [];

    areas.forEach(function (area) {
      requests.push(loadCSV('data/' + area + '-out-profs-list.csv'));
      requests.push(loadCSV('data/' + area + '-out-papers.csv'));
    });

    $.when.apply($, requests)
      .done(function () {
        var responses = Array.prototype.slice.call(arguments);
        areas.forEach(function (area, i) {
          dataByArea[area] = { profs: responses[i * 2], papers: responses[i * 2 + 1] };
        });
        render(currentArea);
      })
      .fail(function () {
        showMessage('danger', 'Could not load the data',
          'Failed to read the statistics files.');
      });
  }

  function setArea(area) {
    if ((area !== 'all' && !AREAS[area]) || area === currentArea) { return; }
    currentArea = area;
    render(area);
  }

  function init() {
    target = document.querySelector('#stats-content');
    if (!target) { return; }

    var select = document.querySelector('select[data-area-select]');
    if (select) {
      select.value = currentArea;
      select.addEventListener('change', function () { setArea(select.value); });
    }

    loadAllAreas();

    var timer = null;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (dataByArea.robotics) { render(currentArea); }
      }, 150);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
