/* ---------------------------------------------------------------------------
   RoboIndexBR — individual author page (authors/<slug>.html)
   ---------------------------------------------------------------------------
   Reads `corebr_author`, defined by runprofs.py between the two halves of the
   template, and fills in the author's name, institution and output.
   --------------------------------------------------------------------------- */

/* global corebr_author, RoboIndexRender */

(function () {
  'use strict';

  var BASE = '../';

  if (!document.documentElement.hasAttribute('data-theme')) {
    var themeScript = document.createElement('script');
    themeScript.src = BASE + 'js/theme.js';
    themeScript.addEventListener('error', function (error) {
      if (window.console) { console.error('Could not load the theme control.', error); }
    });
    document.head.appendChild(themeScript);
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

  /* --- Author identification ------------------------------------------------ */

  function fillIdentification(name) {
    document.title = 'RoboIndexBR — ' + name;

    var description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content',
        'Scientific papers published by ' + name + ', indexed by RoboIndexBR.');
    }

    var heading = document.getElementById('author_name');
    if (heading) { heading.textContent = name; }

    $.get(BASE + 'data/configs/all-researchers.csv').done(function (csv) {
      var rows = $.csv.toArrays(csv);
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][0] !== name) { continue; }

        var institution = rows[i][1];
        var pid = rows[i][2];

        var elInstitution = document.getElementById('author_inst');
        if (elInstitution && institution) { elInstitution.textContent = institution; }

        var elDblp = document.getElementById('dblp_link');
        if (elDblp && pid) {
          elDblp.innerHTML = 'Full publication list on ' +
            '<a href="https://dblp.org/pid/' + escapeHTML(pid) +
            '" target="_blank" rel="noopener">DBLP</a>.';
        }
        return;
      }
    });
  }

  /* --- Papers --------------------------------------------------------------- */

  /* Columns: 0 year, 1 venue, 2 title, 3 authors, 4 DOI, 5 top badge,
     6 type (C|J), 7 arXiv, 8 citations. */
  function fillPapers(name) {
    var target = document.getElementById('author_chart_papers');
    var summary = document.getElementById('author_stats');
    if (!target) { return; }

    var alternativeName = name.normalize('NFD').replace(/[̀-ͯ]/g, '');

    function render(csv) {
        var rows = $.csv.toArrays(csv, { onParseValue: $.csv.hooks.castToScalar })
          .filter(hasContent);

        if (!rows.length) {
          if (summary) { summary.textContent = ''; }
          showMessage(target, 'info', 'No indexed papers',
            'There are no papers by ' + name + ' in the period covered by RoboIndexBR.');
          return;
        }

        /* The source CSV repeats rows (the same paper appears once per matched
           venue). Without deduplication, the summary count is inflated. */
        var seen = {};
        rows = rows.filter(function (r) {
          var key = r[0] + '|' + r[2];
          if (seen[key]) { return false; }
          seen[key] = true;
          return true;
        });

        var citations = 0;
        var top = 0;
        rows.forEach(function (r) {
          var c = parseInt(r[8], 10);
          if (!isNaN(c)) { citations += c; }
          if (r[5] === 'top') { top++; }
        });

        if (summary) {
          var parts = [rows.length === 1 ? '1 paper' : rows.length + ' papers'];
          if (top === 1) { parts.push('1 in a top venue'); }
          if (top > 1) { parts.push(top + ' in top venues'); }
          if (citations > 0) {
            parts.push(citations.toLocaleString('en-US') + ' citations');
            parts.push((citations / rows.length).toFixed(1) + ' citations per paper');
          }
          summary.textContent = parts.join(' · ');
        }

        var data = rows.map(function (r) {
          var markup = '';
          if (r[5] && r[5] !== 'null') {
            markup += '<img class="rbr-badge" src="' + BASE + 'images/' +
              encodeURIComponent(r[5]) + '.gif" alt="" aria-hidden="true"> ';
          }
          markup += escapeHTML(r[2]);
          if (r[4]) {
            markup += ' <a class="rbr-external-link" href="' + escapeHTML(r[4]) +
              '" target="_blank" rel="noopener">[doi]</a>';
          }
          if (r[7] && r[7] !== 'no_arxiv') {
            markup += ' <a class="rbr-external-link" href="' + escapeHTML(r[7]) +
              '" target="_blank" rel="noopener">[arxiv]</a>';
          }

          return [
            Number(r[0]) || null,
            r[1],
            { html: markup, order: r[2] },
            r[6] === 'J' ? 'Journal' : 'Conference',
            r[3]
          ];
        });

        target.textContent = '';
        RoboIndexRender.table(
          { target: target, width: target.clientWidth || 800 },
          [
            { label: 'Year', type: 'number' },
            { label: 'Venue', type: 'text' },
            { label: 'Title', type: 'text' },
            { label: 'Type', type: 'text' },
            { label: 'Authors', type: 'text' }
          ],
          data,
          { sortBy: 0, descending: true }
        );
    }

    function loadPapers(tryAlternative) {
      var file = tryAlternative ? alternativeName : name;
      $.get(BASE + 'data/configs/profs/all-articles/' + encodeURI(file) + '.csv')
        .done(render)
        .fail(function (xhr) {
          if (!tryAlternative && alternativeName !== name) {
            loadPapers(true);
            return;
          }

          if (xhr.status === 404) {
            if (summary) { summary.textContent = ''; }
            showMessage(target, 'info', 'No indexed papers',
              'There are no papers by ' + name.split('-').join(' ') +
              ' in the period covered by RoboIndexBR.');
            return;
          }

          var authorName = name.split('-').join(' ');
          showMessage(target, 'danger', 'Could not load the papers',
            'Failed to read the paper list of ' + authorName + '.');
        });
    }

    loadPapers(false);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof corebr_author !== 'string') { return; }
    var name = corebr_author.split('-').join(' ');
    fillIdentification(name);
    fillPapers(corebr_author);
  });
})();
