/* ---------------------------------------------------------------------------
   RoboIndexBR — application core
   ---------------------------------------------------------------------------
   Each area declares which tabs it has; each tab declares where its data comes
   from and who draws it. Switching area reloads nothing — it only redraws.

   Depends on: jQuery, jquery.csv and js/render.js.
   --------------------------------------------------------------------------- */

/* global RoboIndexRender */

window.RoboIndex = (function () {
  'use strict';

  /* --- Configuration ------------------------------------------------------- */

  /* Indexed time window. Source of truth in the backend:
     FIRST_YEAR / LAST_YEAR in data/scripts/DBLP/search.py. When changing it there,
     change it here — and only here, because the pages read from this object
     instead of repeating the text. */
  var YEAR_WINDOW = { from: 2021, to: 2026 };

  /* Tab order = display order. An area only shows the tabs it lists, which is
     why "mech" does not show Conferences instead of showing an empty state. */
  var AREAS = {
    robotics: {
      label: 'Robotics (general)',
      tabs: ['confs', 'journals', 'depts', 'profs', 'papersC', 'papersJ', 'statsC', 'statsJ']
    },
    cs: {
      label: 'Computer Science',
      tabs: ['journals', 'depts', 'profs', 'papersJ', 'statsJ']
    },
    control: {
      label: 'Electrical and Control Systems',
      tabs: ['journals', 'depts', 'profs', 'papersJ', 'statsJ']
    },
    mech: {
      label: 'Mechanical Design and Mechatronics',
      tabs: ['journals', 'depts', 'profs', 'papersJ', 'statsJ']
    }
  };

  var DEFAULT_AREA = 'robotics';

  /* Visual grouping of the tabs in the side menu. It only organizes the
     display — the list of tabs per area still comes from AREAS.tabs; a group
     with no tab present in the current area simply does not appear. */
  var GROUPS = [
    { id: 'geral', label: 'Overview', tabs: ['profs', 'depts'] },
    { id: 'pub', label: 'Publications', tabs: ['confs', 'journals', 'papersC', 'papersJ'] },
    { id: 'stats', label: 'Statistics', tabs: ['statsC', 'statsJ'] }
  ];

  /* Each tab: where the CSV comes from, who draws it, and what the missing
     data is called when it is missing (used in the empty-state message). */
  var TABS = {
    confs: {
      label: 'Conferences',
      file: function (a) { return 'data/' + a + '-out-confs.csv'; },
      noun: 'conferences',
      draw: function (ctx) { return RoboIndexRender.conferences(ctx); }
    },
    journals: {
      label: 'Journals',
      file: function (a) { return 'data/' + a + '-out-journals.csv'; },
      noun: 'journals',
      draw: function (ctx) { return RoboIndexRender.journals(ctx); }
    },
    depts: {
      label: 'Departments',
      file: function (a) { return 'data/' + a + '-out-scores.csv'; },
      noun: 'departments',
      draw: function (ctx) { return RoboIndexRender.departments(ctx); }
    },
    profs: {
      label: 'Authors',
      file: function (a) { return 'data/' + a + '-out-profs-list.csv'; },
      noun: 'authors',
      table: true,
      draw: function (ctx) { return RoboIndexRender.authors(ctx); }
    },
    papersC: {
      label: 'Papers (conf.)',
      file: function (a) { return 'data/' + a + '-out-papers.csv'; },
      noun: 'conference papers',
      table: true,
      draw: function (ctx) { return RoboIndexRender.papers(ctx, 'C'); }
    },
    papersJ: {
      label: 'Papers (jour.)',
      file: function (a) { return 'data/' + a + '-out-papers.csv'; },
      noun: 'journal papers',
      table: true,
      draw: function (ctx) { return RoboIndexRender.papers(ctx, 'J'); }
    },
    /* The statistics CSVs do not come out of the pipeline: they are curated by
       hand and came from CSIndex (aserg-ufmg/CSIndex, data/robotics-out-stats*.csv),
       with 2017 numbers. The note makes that explicit instead of letting the
       table look as current as the other tabs. */
    statsC: {
      label: 'Statistics (conf.)',
      file: function (a) { return 'data/' + a + '-out-stats.csv'; },
      noun: 'conference statistics',
      table: true,
      note: 'Reference data curated by hand, inherited from CSIndexbr: ' +
        'submitted, accepted and rate refer to 2017; h5 from Google Scholar Metrics. ' +
        'Not updated by the DBLP collection.',
      draw: function (ctx) { return RoboIndexRender.conferenceStats(ctx); }
    },
    statsJ: {
      label: 'Statistics (jour.)',
      file: function (a) { return 'data/' + a + '-out-stats-journals.csv'; },
      noun: 'journal statistics',
      table: true,
      note: 'Reference data curated by hand, inherited from CSIndexbr: ' +
        'the Published column refers to 2017; h5 from Google Scholar Metrics. ' +
        'Not updated by the DBLP collection and only available for curated areas.',
      draw: function (ctx) { return RoboIndexRender.journalStats(ctx); }
    }
  };

  /* --- State --------------------------------------------------------------- */

  var currentArea = DEFAULT_AREA;
  var currentTab = null;
  /* Names of authors that have a generated page in authors/. Loaded once.
     Without it, linking everyone would produce a 404 for the ~17 names without a page. */
  var authorPages = null;
  var elNav = null;
  var elPanels = null;

  /* --- State helpers (loading / empty / error) ------------------------------ */

  function clear(el) {
    while (el.firstChild) { el.removeChild(el.firstChild); }
  }

  function showLoading(el, label) {
    clear(el);
    var box = document.createElement('div');
    box.className = 'rbr-state';

    var spinner = document.createElement('div');
    spinner.className = 'rbr-spinner';
    spinner.setAttribute('role', 'status');
    box.appendChild(spinner);

    var text = document.createElement('p');
    text.className = 'rbr-state__text';
    text.textContent = 'Loading ' + label + '…';
    box.appendChild(text);

    el.appendChild(box);
  }

  function showMessage(el, state, title, body, action) {
    clear(el);
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

    if (action) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'rbr-btn rbr-btn--secondary';
      button.textContent = action.label;
      button.addEventListener('click', action.onClick);
      box.appendChild(button);
    }

    el.appendChild(box);
  }

  /* One text for any absence of data: missing file, empty file or no rows for
     this slice. It does not state the cause — whoever has specific context
     (e.g. hand-curated data) says so in the tab note, not here. */
  function showEmpty(el, tab, area) {
    showMessage(
      el,
      'info',
      'No data available',
      'There are no ' + tab.noun + ' for ' + AREAS[area].label + ' at the moment.'
    );
  }

  function showError(el, tab, area, onRetry) {
    showMessage(
      el,
      'danger',
      'Could not load the data',
      'Failed to read the file of ' + tab.noun + ' for ' + AREAS[area].label + '.',
      { label: 'Try again', onClick: onRetry }
    );
  }

  /* --- CSV reading ---------------------------------------------------------- */

  /* A row "with content" needs at least one value that is neither empty NOR
     zero. This matters: mech-out-confs.csv is not empty, it is filled with
     "ICRA,0 / IROS,0 / RSS,0". Without this filter the chart would draw three
     zero-height bars — which the user reads as a bug, not as missing data. */
  function hasContent(row) {
    if (!row || row.length === 0) { return false; }
    return row.some(function (cell) {
      return cell !== '' && cell !== 0 && cell !== null && cell !== undefined;
    });
  }

  function loadCSV(file) {
    return $.get(file).then(function (text) {
      return $.csv.toArrays(text, { onParseValue: $.csv.hooks.castToScalar })
        .filter(hasContent);
    });
  }

  /* --- Rendering a tab ------------------------------------------------------ */

  function availableWidth(el) {
    /* clientWidth of the active panel. An inactive br-tab-item gets hidden, and a
       hidden element measures 0 — which is why we only draw the active tab.
       The 320 floor avoids degenerate charts if the measurement comes back zero. */
    return Math.max(320, el.clientWidth || el.parentElement.clientWidth || 800);
  }

  function renderTab(tabId, area) {
    var tab = TABS[tabId];
    var panel = document.getElementById('panel-' + tabId);
    if (!tab || !panel) { return; }

    var target = panel.querySelector('.rbr-chart');
    if (!target) { return; }

    var file = tab.file(area);
    showLoading(target, tab.label.toLowerCase());

    loadCSV(file)
      .done(function (rows) {
        if (!rows.length) {
          showEmpty(target, tab, area);
          return;
        }
        clear(target);
        try {
          /* false = "read the file, but there is nothing for this slice" (e.g. the
             Papers (conf.) tab in an area that only has journal papers). */
          var drew = tab.draw({
            rows: rows,
            target: target,
            area: area,
            width: availableWidth(target),
            authorPages: authorPages
          });
          if (drew === false) { showEmpty(target, tab, area); }
        } catch (e) {
          /* A CSV with missing columns breaks the drawing code. Better an honest
             message than a blank panel and a console error. */
          if (window.console) { console.error('Failed to draw ' + tabId, e); }
          showMessage(target, 'danger', 'Could not display the data',
            'The file ' + file + ' was read, but it is not in the expected format.');
        }
      })
      .fail(function (xhr) {
        /* 404 = the area does not have this file, which is missing data, not a
           failure. "Try again" would make no sense. */
        if (xhr && xhr.status === 404) {
          showEmpty(target, tab, area);
          return;
        }
        showError(target, tab, area, function () { renderTab(tabId, area); });
      });
  }

  /* Redraws only the visible tab. The others are redrawn when activated —
     there is deliberately no cache: the CSVs are local and the area may have changed. */
  function renderCurrent() {
    if (currentTab) { renderTab(currentTab, currentArea); }
  }

  /* --- Building the tabs ---------------------------------------------------- */

  function activateTab(tabId) {
    currentTab = tabId;

    elNav.querySelectorAll('.rbr-nav__item').forEach(function (item) {
      item.setAttribute('aria-current', item.getAttribute('data-tab-id') === tabId ? 'true' : 'false');
    });

    elPanels.querySelectorAll('.rbr-panel-tab').forEach(function (panel) {
      panel.classList.toggle('rbr-panel-tab--active', panel.id === 'panel-' + tabId);
    });
  }

  function buildTabs(area) {
    if (!elNav || !elPanels) { return; }
    clear(elNav);
    clear(elPanels);

    var tabs = AREAS[area].tabs;
    /* Keeps the current tab when switching area, if it exists in the new area.
       Switching area and losing the context of what you were looking at is annoying. */
    var ativa = tabs.indexOf(currentTab) !== -1 ? currentTab : tabs[0];

    GROUPS.forEach(function (group) {
      /* Only shows tabs of the group that the current area actually has — and
         only creates the group if at least one is left. */
      var groupTabs = group.tabs.filter(function (id) { return tabs.indexOf(id) !== -1; });
      if (!groupTabs.length) { return; }

      var section = document.createElement('div');
      section.className = 'rbr-nav__group';

      var label = document.createElement('p');
      label.className = 'rbr-nav__group-label';
      label.textContent = group.label;
      section.appendChild(label);

      if (groupTabs.length) {
        var list = document.createElement('ul');
        list.className = 'rbr-nav__list';

        groupTabs.forEach(function (tabId) {
          var li = document.createElement('li');
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'rbr-nav__item';
          button.setAttribute('data-tab-id', tabId);
          button.setAttribute('aria-current', tabId === ativa ? 'true' : 'false');
          button.textContent = TABS[tabId].label;
          button.addEventListener('click', function () {
            if (tabId === currentTab) { return; }
            activateTab(tabId);
            renderTab(tabId, currentArea);
          });
          li.appendChild(button);
          list.appendChild(li);
        });

        section.appendChild(list);
      }
      elNav.appendChild(section);
    });

    tabs.forEach(function (tabId) {
      var panel = document.createElement('div');
      panel.id = 'panel-' + tabId;
      panel.className = 'rbr-panel-tab' + (tabId === ativa ? ' rbr-panel-tab--active' : '');

      var title = document.createElement('h2');
      title.className = 'rbr-panel-tab__title';
      title.textContent = TABS[tabId].label;
      panel.appendChild(title);

      var chart = document.createElement('div');
      chart.className = 'rbr-chart' + (TABS[tabId].table ? ' rbr-chart--table' : '');
      panel.appendChild(chart);

      /* Panel footnote: sits below the content (or the empty state) and outside
         .rbr-chart, which is cleared on every redraw. */
      if (TABS[tabId].note) {
        var note = document.createElement('p');
        note.className = 'rbr-note';
        note.textContent = TABS[tabId].note;
        panel.appendChild(note);
      }

      elPanels.appendChild(panel);
    });

    currentTab = ativa;
  }

  /* --- Home key numbers ----------------------------------------------------- */

  /* Fills the cards. Each one falls back to "—" if the data does not exist,
     instead of showing 0 — zero claims "we measured and got zero", a dash
     admits "we do not know". */
  function updateMetrics(area) {
    var targets = document.querySelectorAll('[data-metric]');
    if (!targets.length) { return; }

    targets.forEach(function (el) { el.textContent = '—'; });

    function define(key, value) {
      var el = document.querySelector('[data-metric="' + key + '"]');
      if (el) { el.textContent = value; }
    }

    define('period', YEAR_WINDOW.from + '–' + YEAR_WINDOW.to);

    loadCSV('data/' + area + '-out-profs-list.csv').done(function (rows) {
      define('authors', rows.length.toLocaleString('en-US'));
      var depts = {};
      rows.forEach(function (l) { if (l[1]) { depts[l[1]] = true; } });
      define('departments', Object.keys(depts).length.toLocaleString('en-US'));
    });

    loadCSV('data/' + area + '-out-papers.csv').done(function (rows) {
      define('papers', rows.length.toLocaleString('en-US'));
    });
  }

  /* --- Switching area ------------------------------------------------------- */

  function setArea(area) {
    if (!AREAS[area] || area === currentArea) { return; }
    currentArea = area;
    sessionStorage.setItem('corebr_area_prefix', area);
    syncControls(area);
    buildTabs(area);
    updateMetrics(area);
    renderCurrent();
  }

  /* Radios (desktop) and select (mobile) represent the same choice; each
     mirrors the other so they do not diverge when the window is resized. */
  function syncControls(area) {
    document.querySelectorAll('input[data-area]').forEach(function (r) {
      r.checked = r.getAttribute('data-area') === area;
    });

    var select = document.querySelector('select[data-area-select]');
    if (select && select.value !== area) { select.value = area; }
  }

  /* --- Redraw on resize ----------------------------------------------------- */

  /* The bar SVG is generated with pixel dimensions (see render.js), so it
     changes size by redrawing, not by stretching. Debounced because the resize
     event fires dozens of times per drag. */
  function bindResize() {
    var timer = null;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(renderCurrent, 200);
    });
  }

  /* --- Initialization ------------------------------------------------------- */

  function bindControls() {
    document.querySelectorAll('input[data-area]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) { setArea(radio.getAttribute('data-area')); }
      });
    });

    var select = document.querySelector('select[data-area-select]');
    if (select) {
      select.addEventListener('change', function () { setArea(select.value); });
    }
  }

  function init() {
    elNav = document.querySelector('nav[data-nav]');
    elPanels = document.querySelector('[data-panels]');

    var saved = sessionStorage.getItem('corebr_area_prefix');
    currentArea = AREAS[saved] ? saved : DEFAULT_AREA;

    /* The window's end year feeds the institutional texts of both homes, so the
       period is not hand-written on every page. */
    document.querySelectorAll('[data-window]').forEach(function (el) {
      el.textContent = YEAR_WINDOW.from + '–' + YEAR_WINDOW.to;
    });

    syncControls(currentArea);
    buildTabs(currentArea);
    updateMetrics(currentArea);
    bindControls();
    bindResize();

    /* The list of author pages is optional: if it is missing, the Authors tab
       still renders, just without links. So it does not block the first draw —
       it only repeats it when (and if) the list arrives. */
    $.get('data/configs/profs/pages.csv')
      .done(function (text) {
        authorPages = {};
        text.split(/\r?\n/).forEach(function (name) {
          if (name.trim()) { authorPages[name.trim()] = true; }
        });
        if (currentTab === 'profs') { renderCurrent(); }
      });

    renderCurrent();
  }

  return {
    init: init,
    YEAR_WINDOW: YEAR_WINDOW,
    AREAS: AREAS
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  window.RoboIndex.init();
});
