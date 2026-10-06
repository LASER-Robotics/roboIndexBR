/* ---------------------------------------------------------------------------
   RoboIndexBR — institutions
   ---------------------------------------------------------------------------
   The table consolidates institutions, distinct authors and distinct papers
   from the author and paper lists of each area.
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

  function escapeHTML(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Same rule as create_slug() in rundepts.py: it names the generated pages. */
  function nameToSlug(name) {
    return String(name).normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function loadCSV(file) {
    return $.get(file).then(function (text) {
      return $.csv.toArrays(text, { onParseValue: $.csv.hooks.castToScalar })
        .filter(hasContent);
    });
  }

  function showMessage(state, title, body) {
    clear(target);
    var box = document.createElement('div');
    box.className = 'rbr-state';

    var msg = document.createElement('div');
    msg.className = 'rbr-message rbr-message--' + state;

    var msgTitle = document.createElement('p');
    msgTitle.className = 'rbr-message__title';
    msgTitle.textContent = title;
    msg.appendChild(msgTitle);

    var msgBody = document.createElement('p');
    msgBody.className = 'rbr-message__body';
    msgBody.textContent = body;
    msg.appendChild(msgBody);

    box.appendChild(msg);
    target.appendChild(box);
  }

  function showLoading() {
    clear(target);
    var box = document.createElement('div');
    box.className = 'rbr-state';

    var spinner = document.createElement('div');
    spinner.className = 'rbr-spinner';
    spinner.setAttribute('role', 'status');
    box.appendChild(spinner);

    var text = document.createElement('p');
    text.className = 'rbr-state__text';
    text.textContent = 'Loading institutions…';
    box.appendChild(text);

    target.appendChild(box);
  }

  function institutionKey(institution) {
    return institution.trim().toLowerCase();
  }

  function authorKey(name) {
    return name.trim().toLowerCase();
  }

  function paperKey(row) {
    var doi = String(row[5] || '').trim().toLowerCase();
    return doi && doi !== 'null'
      ? doi
      : String(row[0]).trim() + '|' + String(row[2]).trim().toLowerCase();
  }

  function getInstitution(records, institution) {
    var key = institutionKey(institution);
    if (!records[key]) {
      records[key] = {
        name: institution.trim(),
        authors: {},
        papers: {}
      };
    }
    return records[key];
  }

  function consolidateArea(records, area) {
    var data = dataByArea[area];

    data.scores.forEach(function (row) {
      var institution = String(row[0] || '').trim();
      if (!institution) { return; }
      getInstitution(records, institution);
    });

    data.profs.forEach(function (row) {
      var author = String(row[0] || '').trim();
      var institution = String(row[1] || '').trim();
      if (!author || !institution) { return; }

      var record = getInstitution(records, institution);
      record.authors[authorKey(author)] = true;
    });

    data.papers.forEach(function (row) {
      var institutions = String(row[3] || '').split(/\s*;\s*/);
      institutions.forEach(function (institution) {
        if (!institution) { return; }
        var record = getInstitution(records, institution);
        record.papers[paperKey(row)] = true;
      });
    });
  }

  function count(keys) {
    return Object.keys(keys).length;
  }

  function buildRows(records) {
    var rows = Object.keys(records).map(function (key) {
      var record = records[key];
      var link = '<a href="departments/' + nameToSlug(record.name) + '">' +
        escapeHTML(record.name) + '</a>';
      return [{ html: link, order: record.name }, count(record.authors), count(record.papers)];
    });

    var papersIndex = 1;
    rows.sort(function (a, b) {
      return b[papersIndex + 1] - a[papersIndex + 1] ||
        b[papersIndex] - a[papersIndex] ||
        a[0].order.localeCompare(b[0].order, 'en');
    });
    return rows;
  }

  function render(area) {
    var records = Object.create(null);
    var areas = area === 'all' ? Object.keys(AREAS) : [area];
    areas.forEach(function (id) { consolidateArea(records, id); });
    var rows = buildRows(records);

    if (!rows.length) {
      showMessage('info', 'No institution data yet',
        area === 'all'
          ? 'There are no authors or papers associated with institutions yet.'
          : 'The collection for ' + AREAS[area] + ' has not produced institution data yet.');
      return;
    }

    clear(target);
    var columns = [
      { label: 'Institution', type: 'text' },
      { label: 'Authors', type: 'number' },
      { label: 'Papers', type: 'number' }
    ];

    RoboIndexRender.table(
      { target: target, width: target.clientWidth || 800 },
      columns,
      rows,
      { sortBy: 2, descending: true }
    );
  }

  function loadAllAreas() {
    showLoading();
    var areas = Object.keys(AREAS);
    var requests = [];

    areas.forEach(function (area) {
      requests.push(loadCSV('data/' + area + '-out-scores.csv'));
      requests.push(loadCSV('data/' + area + '-out-profs-list.csv'));
      requests.push(loadCSV('data/' + area + '-out-papers.csv'));
    });

    $.when.apply($, requests)
      .done(function () {
        var responses = Array.prototype.slice.call(arguments);
        areas.forEach(function (area, index) {
          dataByArea[area] = {
            scores: responses[index * 3],
            profs: responses[index * 3 + 1],
            papers: responses[index * 3 + 2]
          };
        });
        render(currentArea);
      })
      .fail(function () {
        showMessage('danger', 'Could not load the data',
          'Failed to read the institution files.');
      });
  }

  function setArea(area) {
    if ((area !== 'all' && !AREAS[area]) || area === currentArea) { return; }
    currentArea = area;
    if (window.history && history.replaceState) {
      history.replaceState(null, '',
        window.location.pathname + (area === 'all' ? '' : '?area=' + encodeURIComponent(area)));
    }
    render(area);
  }

  function readArea() {
    var match = /[?&]area=([^&]*)/.exec(window.location.search);
    var area = match ? decodeURIComponent(match[1]) : 'all';
    return AREAS[area] ? area : 'all';
  }

  function init() {
    target = document.querySelector('#departments-table');
    if (!target) { return; }

    currentArea = readArea();
    var select = document.querySelector('select[data-area-select]');
    if (select) {
      select.value = currentArea;
      select.addEventListener('change', function () { setArea(select.value); });
    }

    loadAllAreas();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
