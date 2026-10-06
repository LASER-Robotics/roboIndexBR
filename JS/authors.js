/* ---------------------------------------------------------------------------
   RoboIndexBR — author list and search in authors.html
   ---------------------------------------------------------------------------
   Local list of authors filtered by name/institution, linking to
   authors/<slug>.html — the individual profiles.
   --------------------------------------------------------------------------- */

(function () {
  'use strict';

  var all = [];          /* known names and institutions */
  var withPage = {};     /* names that have a generated individual page */
  var field = null;
  var results = null;

  function clear(el) {
    while (el.firstChild) { el.removeChild(el.firstChild); }
  }

  function nameToFile(name) {
    return name.split(' ').join('-');
  }

  function nameToSlug(name) {
    return name.normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function showMessage(state, title, body) {
    clear(results);
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

    results.appendChild(msg);
  }

  /* Strips accents so that "goncalves" matches "Gonçalves". */
  function normalize(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function search(term) {
    var query = normalize(term.trim());
    var found = all.filter(function (author) {
      return !query ||
        normalize(author.name).indexOf(query) !== -1 ||
        normalize(author.institution).indexOf(query) !== -1;
    });

    if (!found.length) {
      showMessage('info', 'No authors found',
        'No name or institution contains “' + term.trim() + '”.');
      return;
    }

    clear(results);

    var heading = document.createElement('p');
    heading.className = 'rbr-results__heading';
    heading.textContent = found.length === 1
      ? '1 author found'
      : found.length + ' authors found';
    results.appendChild(heading);

    var list = document.createElement('ul');
    list.className = 'rbr-list-results';

    found.forEach(function (author) {
      var file = nameToFile(author.name);
      var li = document.createElement('li');
      var item;
      var hasPage = !!withPage[file];

      if (hasPage) {
        item = document.createElement('a');
        item.href = 'authors/' + nameToSlug(author.name) + '.html';
      } else {
        /* Without an individual profile, avoids offering a link that would 404. */
        item = document.createElement('span');
      }

      item.className = 'rbr-list-results__item' +
        (hasPage ? '' : ' rbr-list-results__item--disabled');

      var name = document.createElement('span');
      name.className = 'rbr-list-results__name';
      name.textContent = author.name;
      item.appendChild(name);

      if (author.institution) {
        var institution = document.createElement('span');
        institution.className = 'rbr-list-results__institution';
        institution.textContent = author.institution;
        item.appendChild(institution);
      }

      if (!hasPage) {
        var notice = document.createElement('span');
        notice.className = 'rbr-list-results__notice';
        notice.textContent = 'Individual profile unavailable';
        item.appendChild(notice);
      }

      li.appendChild(item);
      list.appendChild(li);
    });

    results.appendChild(list);
  }

  function init() {
    field = document.querySelector('#author-search');
    results = document.querySelector('#author-results');
    if (!field || !results) { return; }

    /* input fires on every keystroke; the debounce avoids redoing the filter and
       rebuilding the list on every character. */
    var timer = null;
    field.addEventListener('input', function () {
      clearTimeout(timer);
      var term = field.value;
      timer = setTimeout(function () { search(term || ''); }, 150);
    });

    $.when(
      $.get('data/configs/profs/all-authors.csv'),
      $.get('data/configs/profs/profs.csv'),
      $.get('data/configs/profs/pages.csv')
    )
      .done(function (authors, profs, pages) {
        var institutions = {};
        $.csv.toArrays(profs[0]).forEach(function (row) {
          if (row[0]) { institutions[row[0]] = row[1] || ''; }
        });

        all = $.csv.toArrays(authors[0])
          .map(function (row) {
            var name = (row[0] || '').trim();
            return {
              name: name,
              institution: institutions[name] || ''
            };
          })
          .filter(function (author) { return author.name; })
          .sort(function (a, b) { return a.name.localeCompare(b.name, 'en'); });

        pages[0].split(/\r?\n/).forEach(function (name) {
          if (name.trim()) { withPage[name.trim()] = true; }
        });

        search(field.value || '');
      })
      .fail(function () {
        showMessage('danger', 'Could not load the author list',
          'Failed to read the author files.');
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
