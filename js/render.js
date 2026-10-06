/* ---------------------------------------------------------------------------
   RoboIndexBR — chart and table rendering
   ---------------------------------------------------------------------------
   Tables are br-table (real HTML, from the Brazilian government design system)
   and charts are inline SVG, with no dependency on external charting
   libraries. The data volume justifies it — at most 239 rows and 16 bars.
   --------------------------------------------------------------------------- */

window.RoboIndexRender = (function () {
  'use strict';

  /* --- DOM helpers ---------------------------------------------------------- */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }

  function svgEl(tag, attrs, text) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }

  function formatNumber(v) {
    return typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US') : '—';
  }

  /* --- Bar chart ------------------------------------------------------------ */

  /* HORIZONTAL bars, not vertical as in the original. Conference and department
     names are long; vertically they became text rotated 45 degrees, which is
     the worst of both worlds for reading. Horizontally they fit whole. */
  function bars(ctx, opts) {
    var rows = ctx.rows
      .map(function (r) { return [String(r[0]), Number(r[1]) || 0]; })
      .sort(function (a, b) { return b[1] - a[1]; });

    if (opts.limit) { rows = rows.slice(0, opts.limit); }

    var maxValue = Math.max.apply(null, rows.map(function (r) { return r[1]; }));
    if (maxValue <= 0) { return false; }

    var width = ctx.width;
    /* Space reserved for the labels: proportional, with a ceiling so it does not
       swallow the bar on wide screens nor vanish on narrow ones. */
    var labelColumn = Math.min(280, Math.max(110, Math.round(width * 0.32)));
    var valueColumn = 56;
    var rowHeight = 30;
    var topMargin = 8;
    var barWidth = Math.max(40, width - labelColumn - valueColumn - 16);
    var height = topMargin * 2 + rows.length * rowHeight;

    var figure = el('figure', { class: 'rbr-figure' });

    /* Dimensions in px, matching the viewBox, rather than width="100%": with a
       percentage width the browser preserves the aspect ratio and ALSO scales
       the text, which becomes tiny on a narrow screen. Redrawing on resize
       (app.js) handles the adaptation, and it is cheap now because no network
       is involved. */
    var svg = svgEl('svg', {
      class: 'rbr-bars',
      viewBox: '0 0 ' + width + ' ' + height,
      width: width,
      height: height,
      role: 'img',
      'aria-label': opts.accessibleSummary || opts.title
    });

    rows.forEach(function (row, i) {
      var y = topMargin + i * rowHeight;
      var middle = y + rowHeight / 2;
      var length = Math.max(1, Math.round((row[1] / maxValue) * barWidth));

      var label = svgEl('text', {
        x: 8,
        y: middle,
        class: 'rbr-bars__label',
        'text-anchor': 'start',
        'dominant-baseline': 'central'
      }, row[0]);
      /* The title preserves the full name when the visible label is truncated. */
      label.appendChild(svgEl('title', null, row[0]));
      svg.appendChild(label);

      svg.appendChild(svgEl('rect', {
        x: labelColumn,
        y: y + 5,
        width: length,
        height: rowHeight - 10,
        rx: 2,
        class: 'rbr-bars__bar'
      }));

      svg.appendChild(svgEl('text', {
        x: labelColumn + length + 8,
        y: middle,
        class: 'rbr-bars__value',
        'dominant-baseline': 'central'
      }, formatNumber(row[1])));
    });

    figure.appendChild(svg);

    if (opts.title) {
      figure.appendChild(el('figcaption', { class: 'rbr-figure__caption' }, opts.title));
    }

    ctx.target.appendChild(figure);

    Array.prototype.forEach.call(svg.querySelectorAll('.rbr-bars__label'), function (label) {
      if (typeof label.getComputedTextLength !== 'function') { return; }

      var text = label.firstChild.nodeValue;
      var maxWidth = labelColumn - 16;
      if (label.getComputedTextLength() <= maxWidth) { return; }

      var low = 0;
      var high = text.length;
      while (low < high) {
        var mid = Math.ceil((low + high) / 2);
        label.firstChild.nodeValue = text.slice(0, mid) + '…';
        if (label.getComputedTextLength() <= maxWidth) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      label.firstChild.nodeValue = text.slice(0, low) + '…';
    });

    return true;
  }

  /* --- Column chart --------------------------------------------------------- */

  /* VERTICAL columns, for time series (papers per year): the label is short
     and the order is chronological, so the eye reads the trend from left to
     right. Not suitable for long names — for those, use bars(). */
  function columns(ctx, opts) {
    var rows = ctx.rows.map(function (r) { return [String(r[0]), Number(r[1]) || 0]; });
    var maxValue = Math.max.apply(null, rows.map(function (r) { return r[1]; }));
    if (!rows.length || maxValue <= 0) { return false; }

    var width = ctx.width;
    var topMargin = 24;
    var bottomMargin = 28;
    var plotHeight = 200;
    var height = topMargin + plotHeight + bottomMargin;
    var step = width / rows.length;
    var columnWidth = Math.max(12, Math.min(72, Math.round(step * 0.6)));

    var figure = el('figure', { class: 'rbr-figure' });
    var svg = svgEl('svg', {
      class: 'rbr-bars',
      viewBox: '0 0 ' + width + ' ' + height,
      width: width,
      height: height,
      role: 'img',
      'aria-label': opts.accessibleSummary || opts.title
    });

    rows.forEach(function (row, i) {
      var center = step * i + step / 2;
      var length = Math.max(1, Math.round((row[1] / maxValue) * plotHeight));
      var top = topMargin + plotHeight - length;

      svg.appendChild(svgEl('rect', {
        x: Math.round(center - columnWidth / 2),
        y: top,
        width: columnWidth,
        height: length,
        rx: 2,
        class: 'rbr-bars__bar'
      }));

      svg.appendChild(svgEl('text', {
        x: center,
        y: top - 6,
        class: 'rbr-bars__value',
        'text-anchor': 'middle'
      }, formatNumber(row[1])));

      svg.appendChild(svgEl('text', {
        x: center,
        y: topMargin + plotHeight + 18,
        class: 'rbr-bars__label',
        'text-anchor': 'middle'
      }, row[0]));
    });

    figure.appendChild(svg);
    if (opts.title) {
      figure.appendChild(el('figcaption', { class: 'rbr-figure__caption' }, opts.title));
    }
    ctx.target.appendChild(figure);
    return true;
  }

  /* --- Table ---------------------------------------------------------------- */

  /* cols: [{label, type:'text'|'number', sortable:false}]
     rows: matrix of cells; each cell is a plain value OR
           {html: '<a…>', order: valueForSorting} when it needs markup. */
  function table(ctx, cols, rows, opts) {
    opts = opts || {};

    var sorting = { column: opts.sortBy, desc: !!opts.descending };

    var tableEl = el('table', {
      class: opts.stacked ? 'rbr-table rbr-table--stacked' : 'rbr-table'
    });

    var thead = el('thead');
    var headerRow = el('tr');

    cols.forEach(function (col, index) {
      var cell = el('th');
      if (col.sortable === false) {
        cell.textContent = col.label;
      } else {
        var button = el('button', { type: 'button', class: 'rbr-sort' }, col.label);
        button.appendChild(el('span', { class: 'rbr-sort__arrow', 'aria-hidden': 'true' }, ''));
        button.addEventListener('click', function () {
          if (sorting.column === index) {
            sorting.desc = !sorting.desc;
          } else {
            sorting.column = index;
            sorting.desc = col.type === 'number';
          }
          redraw();
        });
        cell.appendChild(button);
      }
      headerRow.appendChild(cell);
    });

    thead.appendChild(headerRow);
    tableEl.appendChild(thead);

    var body = el('tbody');
    tableEl.appendChild(body);

    function sortValue(cell) {
      if (cell && typeof cell === 'object') { return cell.order; }
      return cell;
    }

    function redraw() {
      var sorted = rows.slice();

      if (sorting.column !== undefined && sorting.column !== null) {
        var type = cols[sorting.column].type;
        sorted.sort(function (a, b) {
          var va = sortValue(a[sorting.column]);
          var vb = sortValue(b[sorting.column]);
          var r;
          if (type === 'number') {
            r = (Number(va) || 0) - (Number(vb) || 0);
          } else {
            /* locale-aware compare: "Álvaro" sorts next to "Alvaro", not at the end. */
            r = String(va == null ? '' : va).localeCompare(String(vb == null ? '' : vb), 'en');
          }
          return sorting.desc ? -r : r;
        });
      }

      /* Marks the sorted column for screen readers and for the visual arrow. */
      Array.prototype.forEach.call(
        headerRow.querySelectorAll('th'),
        function (cell, i) {
          if (i === sorting.column) {
            cell.setAttribute('aria-sort', sorting.desc ? 'descending' : 'ascending');
            cell.setAttribute('data-sorted', sorting.desc ? 'desc' : 'asc');
          } else {
            cell.removeAttribute('aria-sort');
            cell.removeAttribute('data-sorted');
          }
        }
      );

      body.textContent = '';
      var fragment = document.createDocumentFragment();

      sorted.forEach(function (row) {
        var tr = el('tr');

        row.forEach(function (cell, index) {
          var td = el('td');
          /* On a narrow screen the stacked table shows the column name via CSS. */
          if (opts.stacked) { td.setAttribute('data-label', cols[index].label); }
          if (cols[index].type === 'number') {
            td.classList.add('rbr-col-number');
          }
          if (cell && typeof cell === 'object' && cell.html !== undefined) {
            /* The HTML comes from local data generated by the pipeline, not from
               user input — and even so, only the fields that need it (DOI/arXiv
               link and the top-venue badge) arrive as an object. */
            td.innerHTML = cell.html;
          } else if (cols[index].type === 'number') {
            td.textContent = formatNumber(cell);
          } else {
            td.textContent = cell == null ? '' : String(cell);
          }
          tr.appendChild(td);
        });

        fragment.appendChild(tr);
      });

      body.appendChild(fragment);
    }

    redraw();
    ctx.target.appendChild(tableEl);
    return true;
  }

  function escapeHTML(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* --- Chart tabs ----------------------------------------------------------- */

  function conferences(ctx) {
    return bars(ctx, {
      title: 'Full papers by Brazilian faculty in the monitored conferences',
      accessibleSummary: 'Bar chart with the number of papers per conference'
    });
  }

  function journals(ctx) {
    return bars(ctx, {
      title: 'Papers by Brazilian faculty in the monitored journals',
      accessibleSummary: 'Bar chart with the number of papers per journal'
    });
  }

  function departments(ctx) {
    return bars(ctx, {
      /* Cut to the 16 largest, as in the original: beyond that the axis becomes illegible. */
      limit: 16,
      title: 'Score = A + (0.40 × B) + (0.33 × C) — A: papers in top venues; ' +
        'B: papers in journals; C: papers in conferences or other journals',
      accessibleSummary: 'Bar chart with the department scores'
    });
  }

  /* --- Authors tab ---------------------------------------------------------- */

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

  function authors(ctx) {
    var rows = ctx.rows.map(function (row) {
      var name = row[0];
      var file = nameToFile(name);
      /* Only links authors that have a generated profile — not every author has a page. */
      var hasPage = ctx.authorPages && ctx.authorPages[file];
      var cell = hasPage
        ? { html: '<a href="authors/' + encodeURIComponent(nameToSlug(name)) + '">' + escapeHTML(name) + '</a>',
            order: name }
        : name;
      return [cell, row[1]];
    });

    return table(ctx,
      [{ label: 'Author', type: 'text' }, { label: 'Institution', type: 'text' }],
      rows,
      { sortBy: 0 });
  }

  /* --- Papers tab ----------------------------------------------------------- */

  /* CSV columns: 0 year, 1 venue, 2 title, 3 institutions, 4 authors,
     5 DOI, 6 top-venue badge, 7 type (C|J), 8 arXiv, 9 citations.
     Citations stay out of the display, as they already were in the original. */
  function papers(ctx, type) {
    var rows = ctx.rows
      .filter(function (r) { return r[7] === type; })
      .map(function (r) {
        var title = escapeHTML(r[2]);
        var badge = r[6];
        var markup = '';

        if (badge && badge !== 'null') {
          markup += '<img class="rbr-badge" src="images/' + encodeURIComponent(badge) +
            '.gif" alt="" aria-hidden="true"> ';
        }
        markup += title;
        if (r[5]) {
          markup += ' <a class="rbr-external-link" href="' + escapeHTML(r[5]) +
            '" target="_blank" rel="noopener">[doi]</a>';
        }
        if (r[8] && r[8] !== 'no_arxiv') {
          markup += ' <a class="rbr-external-link" href="' + escapeHTML(r[8]) +
            '" target="_blank" rel="noopener">[arxiv]</a>';
        }

        return [
          Number(r[0]) || null,
          r[1],
          { html: markup, order: r[2] },
          r[3],
          r[4]
        ];
      });

    /* The CSV has content, but nothing for this slice (e.g. conference tab in an
       area that only published in journals). Returning false asks for the empty
       state, instead of a zero-row table — which the user would read as a failure. */
    if (!rows.length) { return false; }

    return table(ctx, [
      { label: 'Year', type: 'number' },
      { label: 'Venue', type: 'text' },
      { label: 'Title', type: 'text' },
      { label: 'Institutions', type: 'text' },
      { label: 'Authors', type: 'text' }
    ], rows, { sortBy: 0, descending: true });
  }

  /* --- Statistics tabs ------------------------------------------------------ */

  function normalizedH5(h5, base) {
    if (!base || !h5) { return null; }
    return Math.round((h5 / base) * 100) / 100;
  }

  function conferenceStats(ctx) {
    var rows = ctx.rows.map(function (r) {
      return [r[0], r[1], r[2], r[3], r[4], r[5], normalizedH5(r[5], r[3]), r[6], r[7]];
    });

    return table(ctx, [
      { label: 'Conference', type: 'text' },
      { label: 'Organizer', type: 'text' },
      { label: 'Submitted', type: 'number' },
      { label: 'Accepted', type: 'number' },
      { label: 'Rate (%)', type: 'number' },
      { label: 'h5', type: 'number' },
      { label: 'h5 norm.', type: 'number' },
      { label: 'Ranking', type: 'text' },
      { label: 'Pages', type: 'number' }
    ], rows, { sortBy: 0 });
  }

  function journalStats(ctx) {
    var rows = ctx.rows.map(function (r) {
      return [r[0], r[1], r[2], r[3], normalizedH5(r[3], r[2]), r[4], r[5]];
    });

    return table(ctx, [
      { label: 'Journal', type: 'text' },
      { label: 'Publisher', type: 'text' },
      { label: 'Published', type: 'number' },
      { label: 'h5', type: 'number' },
      { label: 'h5 norm.', type: 'number' },
      { label: 'Type', type: 'text' },
      { label: 'Pages', type: 'number' }
    ], rows, { sortBy: 0 });
  }

  return {
    /* Primitives, reused by js/departments.js. */
    table: table,
    bars: bars,
    columns: columns,

    conferences: conferences,
    journals: journals,
    departments: departments,
    authors: authors,
    papers: papers,
    conferenceStats: conferenceStats,
    journalStats: journalStats
  };
})();
