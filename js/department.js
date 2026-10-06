/* ---------------------------------------------------------------------------
   RoboIndexBR — institution detail page (dept.html?inst=<name>)
   ---------------------------------------------------------------------------
   Shows the institution's score in each research area and its faculty,
   from the same per-area CSVs used by departments.js.
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

  function key(text) {
    return String(text || '').trim().toLowerCase();
  }

  function escapeHTML(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function nameToFile(name) {
    return String(name).split(' ').join('-');
  }

  function nameToSlug(name) {
    return String(name).normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function showMessage(target, state, title, body) {
    target.textContent = '';
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

  function getInstitutionParam() {
    var match = /[?&]inst=([^&]*)/.exec(window.location.search);
    if (!match) { return ''; }
    try {
      return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
    } catch (e) {
      return '';
    }
  }

  function renderScores(target, scores) {
    var rows = scores.filter(function (s) { return s[1] > 0; });
    target.textContent = '';
    if (!rows.length) {
      showMessage(target, 'info', 'No score yet',
        'This institution has no score in any research area.');
      return;
    }
    RoboIndexRender.bars(
      { target: target, rows: rows, width: target.clientWidth || 800 },
      {
        title: 'Score = A + (0.40 × B) + (0.33 × C) — A: papers in top venues; ' +
          'B: papers in journals; C: papers in conferences or other journals',
        accessibleSummary: 'Bar chart with the institution score per research area'
      }
    );
  }

  function renderProfs(target, profs, pages) {
    target.textContent = '';
    if (!profs.length) {
      showMessage(target, 'info', 'No faculty listed',
        'No authors are associated with this institution yet.');
      return;
    }

    var rows = profs.map(function (p) {
      var cell = pages[nameToFile(p.name)]
        ? { html: '<a href="authors/' + encodeURIComponent(nameToSlug(p.name)) + '.html">' +
            escapeHTML(p.name) + '</a>', order: p.name }
        : p.name;
      return [cell, p.areas.join(', ')];
    });

    RoboIndexRender.table(
      { target: target, width: target.clientWidth || 800 },
      [
        { label: 'Author', type: 'text' },
        { label: 'Research areas', type: 'text' }
      ],
      rows,
      { sortBy: 0 }
    );
  }

  function init() {
    var scoresTarget = document.getElementById('dept-scores');
    var profsTarget = document.getElementById('dept-profs');
    if (!scoresTarget || !profsTarget) { return; }

    var param = getInstitutionParam();
    if (!param) {
      document.getElementById('dept-name').textContent = 'Institution not specified';
      scoresTarget.parentNode.removeChild(scoresTarget);
      showMessage(profsTarget, 'info', 'Choose an institution',
        'Open an institution from the Departments page.');
      return;
    }

    var wanted = key(param);
    var areas = Object.keys(AREAS);
    var requests = [$.get('data/configs/profs/pages.csv').then(null, function () {
      return $.Deferred().resolve('');
    })];
    areas.forEach(function (area) {
      requests.push(loadCSV('data/' + area + '-out-scores.csv'));
      requests.push(loadCSV('data/' + area + '-out-profs-list.csv'));
    });

    $.when.apply($, requests)
      .done(function () {
        var responses = Array.prototype.slice.call(arguments);
        var pagesText = Array.isArray(responses[0]) ? responses[0][0] : responses[0];
        var pages = {};
        String(pagesText || '').split(/\r?\n/).forEach(function (n) {
          if (n.trim()) { pages[n.trim()] = true; }
        });

        var name = param;
        var scores = [];
        var profMap = {};
        var profs = [];

        areas.forEach(function (area, i) {
          var scoreRows = responses[1 + i * 2];
          var profRows = responses[2 + i * 2];

          scoreRows.forEach(function (row) {
            if (key(row[0]) !== wanted) { return; }
            name = String(row[0]).trim();
            scores.push([AREAS[area], Number(row[1]) || 0]);
          });

          profRows.forEach(function (row) {
            var author = String(row[0] || '').trim();
            if (!author || key(row[1]) !== wanted) { return; }
            name = String(row[1]).trim();
            var k = key(author);
            if (!profMap[k]) {
              profMap[k] = { name: author, areas: [] };
              profs.push(profMap[k]);
            }
            profMap[k].areas.push(AREAS[area]);
          });
        });

        document.title = 'RoboIndexBR — ' + name;
        document.getElementById('dept-name').textContent = name;
        document.getElementById('dept-crumb').textContent = name;

        if (!scores.length && !profs.length) {
          document.getElementById('dept-summary').textContent =
            'No data found for this institution.';
          scoresTarget.textContent = '';
          profsTarget.textContent = '';
          return;
        }

        var summary = document.getElementById('dept-summary');
        summary.textContent =
          profs.length + (profs.length === 1 ? ' author' : ' authors') + ' indexed. ';
        var more = document.createElement('a');
        more.href = 'authors.html?q=' + encodeURIComponent(name);
        more.textContent = 'See in the authors list';
        summary.appendChild(more);

        renderScores(scoresTarget, scores);
        renderProfs(profsTarget, profs, pages);
      })
      .fail(function () {
        showMessage(scoresTarget, 'danger', 'Could not load the data',
          'Failed to read the institution files.');
        profsTarget.textContent = '';
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
