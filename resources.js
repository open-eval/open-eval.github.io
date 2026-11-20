/*
 * Renders resource collections from window.OEC_RESOURCES (resources-data.js).
 *
 *   <div data-resource-list="papers,tools"></div>  list with search + filters;
 *                                                   add data-resource-search="off" to drop search,
 *                                                   data-resource-filters="off" to drop topic chips,
 *                                                   data-resource-tags="off" to drop tags on cards;
 *                                                   several kinds add a type toggle
 *   <ul data-resource-recent="6"></ul>              newest additions across all kinds
 *   <span data-resource-count="papers,tools"></span> number of entries
 */
(function () {
  const data = window.OEC_RESOURCES || {};
  const KIND_LABEL = { papers: 'Paper', tools: 'Tool', blogs: 'Blog post', events: 'Event' };
  const KIND_PLURAL = { papers: 'Papers', tools: 'Tools & packages', blogs: 'Blog posts', events: 'Events' };
  const KIND_PAGE = { papers: 'tools-papers.html', tools: 'tools-papers.html', blogs: 'blog.html', events: 'events.html' };

  const kindsOf = attr => attr.split(',').map(kind => kind.trim()).filter(kind => kind in KIND_LABEL);
  const entriesOf = kinds => kinds.flatMap(kind => (data[kind] || []).map(item => ({ kind, item })));

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value == null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function sortEntries(list) {
    return [...list].sort((a, b) =>
      (b.item.featured ? 1 : 0) - (a.item.featured ? 1 : 0) ||
      (b.item.year || 0) - (a.item.year || 0) ||
      a.item.title.localeCompare(b.item.title));
  }

  function card({ kind, item }, showKind, showTags = true) {
    // Authors on one line; venue and year on the next.
    const where = [item.venue, item.year && !(item.venue || '').includes(String(item.year)) ? item.year : null]
      .filter(Boolean).join(', ');

    const facts = [];
    if (item.language) facts.push(el('span', { class: 'resource-fact', text: item.language }));
    if (item.license) facts.push(el('span', { class: 'resource-fact', text: item.license }));
    if (item.paper) {
      facts.push(el('a', { class: 'resource-fact resource-fact-link', href: item.paper, target: '_blank', rel: 'noopener', text: 'Paper ↗' }));
    }

    const tags = showTags ? item.tags || [] : [];

    const badges = [];
    if (showKind) badges.push(el('span', { class: 'resource-kind', text: KIND_LABEL[kind] }));

    return el('li', { class: 'resource-card' + (item.featured ? ' is-featured' : '') },
      badges.length ? el('div', { class: 'resource-badges' }, badges) : null,
      el('h3', { class: 'resource-title' },
        el('a', { href: item.url, target: '_blank', rel: 'noopener' }, item.title)),
      item.authors ? el('p', { class: 'resource-meta', text: item.authors }) : null,
      where ? el('p', { class: 'resource-meta resource-where', text: where }) : null,
      item.summary ? el('p', { class: 'resource-summary', text: item.summary }) : null,
      (facts.length || tags.length) ? el('div', { class: 'resource-foot' },
        facts,
        tags.map(tag => el('span', { class: 'resource-tag', text: tag }))) : null);
  }

  function chipGroup(label, options, active, onPick) {
    return el('div', { class: 'resource-chips', role: 'group', 'aria-label': label },
      options.map(({ value, text, count }) => el('button', {
        type: 'button', class: 'resource-chip',
        'aria-pressed': String(active === value),
        onclick: () => onPick(value),
      }, text, ' ', el('span', { class: 'resource-chip-count', text: count }))));
  }

  function renderList(root) {
    const kinds = kindsOf(root.dataset.resourceList);
    const entries = sortEntries(entriesOf(kinds));
    if (!entries.length) {
      root.replaceChildren(el('p', { class: 'resource-empty', text: 'This collection is being curated. Check back soon.' }));
      return;
    }
    // Only offer a type toggle when more than one kind actually has entries.
    const present = kinds.filter(kind => entries.some(entry => entry.kind === kind));
    const multiKind = present.length > 1;

    const params = new URLSearchParams(location.search);
    let activeKind = present.includes(params.get('type')) ? params.get('type') : null;
    let activeTag = params.get('tag');
    // data-resource-search="off" hides the search box (and its entry count).
    const searchable = root.dataset.resourceSearch !== 'off';
    let query = searchable ? params.get('q') || '' : '';
    // data-resource-filters="off" hides the topic chips; data-resource-tags="off" hides card tags.
    const filterable = root.dataset.resourceFilters !== 'off';
    const showTags = root.dataset.resourceTags !== 'off';
    if (!filterable) activeTag = null;

    const search = el('input', {
      type: 'search', class: 'resource-search', placeholder: 'Search titles, authors, topics…',
      'aria-label': 'Search this collection', value: query,
    });
    const status = el('p', { class: 'resource-status', role: 'status' });
    const filters = el('div', { class: 'resource-filters' });
    const list = el('ul', { class: 'resource-grid' });

    function syncUrl() {
      const next = new URLSearchParams();
      if (query) next.set('q', query);
      if (activeKind) next.set('type', activeKind);
      if (activeTag) next.set('tag', activeTag);
      const qs = next.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }

    function draw() {
      const ofKind = entries.filter(entry => !activeKind || entry.kind === activeKind);
      const tagCounts = new Map();
      for (const { item } of ofKind) for (const tag of item.tags || []) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      const tags = [...tagCounts.keys()].sort((a, b) => tagCounts.get(b) - tagCounts.get(a) || a.localeCompare(b));
      if (activeTag && !tagCounts.has(activeTag)) activeTag = null;

      const groups = [];
      if (multiKind) {
        groups.push(chipGroup('Filter by type', [
          { value: null, text: 'All', count: entries.length },
          ...present.map(kind => ({ value: kind, text: KIND_PLURAL[kind], count: entries.filter(e => e.kind === kind).length })),
        ], activeKind, value => { activeKind = value; draw(); syncUrl(); }));
        groups[0].classList.add('resource-type-toggle');
      }
      // Topic chips only help once there is more than one entry to narrow down.
      if (tags.length && filterable && ofKind.length > 1) {
        groups.push(chipGroup('Filter by topic', [
          { value: null, text: multiKind ? 'All topics' : 'All', count: ofKind.length },
          ...tags.map(tag => ({ value: tag, text: tag, count: tagCounts.get(tag) })),
        ], activeTag, value => { activeTag = value; draw(); syncUrl(); }));
      }
      filters.replaceChildren(...groups);

      const needle = query.trim().toLowerCase();
      const shown = ofKind.filter(({ item }) =>
        (!activeTag || (item.tags || []).includes(activeTag)) &&
        (!needle || [item.title, item.authors, item.venue, item.summary, ...(item.tags || [])]
          .filter(Boolean).join(' ').toLowerCase().includes(needle)));

      list.replaceChildren(...shown.map(entry => card(entry, multiKind, showTags)));
      status.textContent = shown.length === entries.length
        ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
        : `Showing ${shown.length} of ${entries.length}`;
      if (!shown.length) list.append(el('li', { class: 'resource-empty', text: 'Nothing matches yet. Try another search or filter.' }));
    }

    search.addEventListener('input', () => { query = search.value; draw(); syncUrl(); });
    root.replaceChildren(...(searchable ? [el('div', { class: 'resource-controls' }, search, status)] : []), filters, list);
    draw();
  }

  function renderRecent(root) {
    const limit = Number(root.dataset.resourceRecent) || 6;
    const all = entriesOf(Object.keys(KIND_LABEL));
    all.sort((a, b) => (b.item.added || '').localeCompare(a.item.added || '') ||
      (b.item.featured ? 1 : 0) - (a.item.featured ? 1 : 0) ||
      (b.item.year || 0) - (a.item.year || 0));
    // Interleave kinds so one collection does not crowd out the others.
    const byKind = Object.keys(KIND_LABEL).map(kind => all.filter(entry => entry.kind === kind));
    const picked = [];
    for (let i = 0; picked.length < limit && byKind.some(q => q.length > i); i++) {
      for (const queue of byKind) if (queue[i] && picked.length < limit) picked.push(queue[i]);
    }
    const block = root.closest('[data-resource-recent-block]');
    if (block) block.querySelectorAll('.recent-heading, .recent-list').forEach(node => { node.hidden = !picked.length; });
    root.replaceChildren(...picked.map(({ kind, item }) =>
      el('li', { class: 'recent-item' },
        el('a', { class: 'recent-kind', href: KIND_PAGE[kind] + '?type=' + kind, text: KIND_LABEL[kind] }),
        el('a', { class: 'recent-title', href: item.url, target: '_blank', rel: 'noopener', text: item.title }),
        el('span', { class: 'recent-meta', text: [item.authors, item.year].filter(Boolean).join(', ') }))));
  }

  document.querySelectorAll('[data-resource-list]').forEach(renderList);
  document.querySelectorAll('[data-resource-recent]').forEach(renderRecent);
  document.querySelectorAll('[data-resource-count]').forEach(node => {
    const count = entriesOf(kindsOf(node.dataset.resourceCount)).length;
    const label = node.closest('.resource-count-label');
    if (!count && label) label.textContent = 'Coming soon';
    else node.textContent = count;
  });
})();
