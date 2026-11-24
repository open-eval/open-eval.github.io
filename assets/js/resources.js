/*
 * Renders resource collections from window.OEC_RESOURCES (resources-data.js).
 *
 *   <div data-resource-list="papers,tools"></div>  list with search + filters;
 *                                                   add data-resource-search="off" to drop search,
 *                                                   data-resource-filters="off" to drop topic chips,
 *                                                   data-resource-tags="off" to drop tags on cards;
 *                                                   several kinds add type filters
 *   <ul data-resource-recent="6"></ul>              newest additions across all kinds
 *   <span data-resource-count="papers,tools"></span> number of entries
 */
(function () {
  const data = window.OEC_RESOURCES || {};
  const toolsByPaper = new Map((data.tools || []).filter(tool => tool.paper).map(tool => [tool.paper, tool.url]));
  const KIND_LABEL = { papers: 'Paper', tools: 'Tool', blogs: 'Blog post', events: 'Event' };
  const KIND_PLURAL = { papers: 'Papers', tools: 'Tools & packages', blogs: 'Blog posts', events: 'Events' };
  const KIND_PAGE = { papers: 'research-tools.html', tools: 'research-tools.html', blogs: 'blog.html', events: 'events.html' };

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

  function resourceSearch(query, fuzzy) {
    const needle = query.trim().toLowerCase();
    if (!needle) return () => true;
    const matches = fuzzy && window.OEC_createFuzzyMatcher
      ? window.OEC_createFuzzyMatcher(needle)
      : text => text.toLowerCase().includes(needle);
    return item => matches([item.title, item.authors, item.venue, item.summary, ...(item.tags || [])]
      .filter(Boolean).join(' '));
  }

  function card({ kind, item }, showKind, showTags = true) {
    // Authors on one line; venue and year on the next.
    const where = [item.venue, item.year && !(item.venue || '').includes(String(item.year)) ? item.year : null]
      .filter(Boolean).join(', ');

    const facts = [];
    if (item.license) facts.push(el('span', { class: 'resource-fact', text: item.license }));
    const relatedUrl = kind === 'papers' ? toolsByPaper.get(item.url) : item.paper;
    let relatedLink = null;
    if (relatedUrl) {
      const label = kind === 'papers' ? 'Tool' : 'Paper';
      relatedLink = el('a', { class: 'resource-related-link', href: relatedUrl, target: '_blank', rel: 'noopener noreferrer' });
      relatedLink.innerHTML = label + ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 5h6v6m0-6-9 9"/><path d="M11 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5"/></svg>';
    }

    const tags = showTags ? item.tags || [] : [];

    const kindLabel = KIND_LABEL[kind];
    const kindBadge = showKind ? el('span', { class: 'resource-kind-slot' },
      el('span', { class: 'resource-kind', 'data-label': kindLabel },
        el('span', { class: 'resource-kind-label', text: kindLabel }))) : null;

    return el('li', { class: 'resource-card' + (item.featured ? ' is-featured' : '') },
      el('h3', { class: 'resource-title' },
        kindBadge,
        el('a', { href: item.url, target: '_blank', rel: 'noopener' }, item.title)),
      item.authors ? el('p', { class: 'resource-meta', text: item.authors }) : null,
      where ? el('p', { class: 'resource-meta resource-where', text: where }) : null,
      item.summary ? el('p', { class: 'resource-summary', text: item.summary }) : null,
      (facts.length || tags.length || relatedLink) ? el('div', { class: 'resource-foot' },
        facts,
        tags.map(tag => el('span', { class: 'resource-tag', text: tag })),
        relatedLink) : null);
  }

  function renderList(root) {
    const kinds = kindsOf(root.dataset.resourceList);
    const entries = sortEntries(entriesOf(kinds));
    if (!entries.length) {
      root.replaceChildren(el('p', { class: 'resource-empty', text: 'This collection is being curated. Check back soon.' }));
      return;
    }
    // Only offer type filters when more than one kind actually has entries.
    const present = kinds.filter(kind => entries.some(entry => entry.kind === kind));
    const multiKind = present.length > 1;

    const params = new URLSearchParams(location.search);
    const activeKinds = new Set(params.getAll('type').filter(kind => present.includes(kind)));
    // data-resource-search="off" hides the search box (and its entry count).
    const searchable = root.dataset.resourceSearch !== 'off';
    let query = searchable ? params.get('q') || '' : '';
    // data-resource-filters="off" hides the topic chips; data-resource-tags="off" hides card tags.
    const filterable = root.dataset.resourceFilters !== 'off';
    const showTags = root.dataset.resourceTags !== 'off';
    const tagCounts = new Map();
    if (filterable && entries.length > 1) {
      for (const { item } of entries) {
        for (const tag of new Set(item.tags || [])) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    const tags = [...tagCounts.keys()].sort((a, b) => tagCounts.get(b) - tagCounts.get(a) || a.localeCompare(b));
    const activeTags = new Set(params.getAll('tag').filter(tag => tagCounts.has(tag)));

    const search = el('input', {
      type: 'search', class: 'resource-search', placeholder: 'Search titles, authors, topics…',
      'aria-label': 'Search this collection', value: query,
    });
    const status = el('p', { class: 'resource-status', role: 'status' });
    const filters = el('div', { class: 'resource-chips', role: 'group', 'aria-label': 'Filter resources' });
    const list = el('ul', { class: 'resource-grid' });

    const chips = [];
    function addChip(text, count, isPressed, onPick) {
      const button = el('button', {
        type: 'button', class: 'resource-chip',
        onclick: () => { onPick(); draw(); syncUrl(); },
      }, text, ' ', el('span', { class: 'resource-chip-count', text: count }));
      chips.push({ button, isPressed });
      filters.append(button);
    }

    function addToggle(text, count, selected, value) {
      addChip(text, count, () => selected.has(value), () => {
        if (selected.has(value)) selected.delete(value);
        else selected.add(value);
      });
    }

    if (multiKind || tags.length) {
      addChip('All', entries.length, () => !activeKinds.size && !activeTags.size, () => {
        activeKinds.clear();
        activeTags.clear();
      });
      if (multiKind) {
        for (const kind of present) {
          addToggle(KIND_PLURAL[kind], entries.filter(entry => entry.kind === kind).length, activeKinds, kind);
        }
      }
      for (const tag of tags) addToggle(tag, tagCounts.get(tag), activeTags, tag);
    }

    function syncUrl() {
      const next = new URLSearchParams();
      if (query) next.set('q', query);
      for (const kind of activeKinds) next.append('type', kind);
      for (const tag of activeTags) next.append('tag', tag);
      const qs = next.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }

    function draw() {
      for (const { button, isPressed } of chips) button.setAttribute('aria-pressed', String(isPressed()));

      const matchesSearch = resourceSearch(query, root.classList.contains('research-tools-list'));
      const shown = entries.filter(({ kind, item }) =>
        (!activeKinds.size || activeKinds.has(kind)) &&
        (!activeTags.size || (item.tags || []).some(tag => activeTags.has(tag))) &&
        matchesSearch(item));

      list.replaceChildren(...shown.map(entry => card(entry, multiKind, showTags)));
      status.textContent = shown.length === entries.length
        ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
        : `Showing ${shown.length} of ${entries.length}`;
      if (!shown.length) list.append(el('li', { class: 'resource-empty', text: 'Nothing matches yet. Try another search or filter.' }));
    }

    search.addEventListener('input', () => { query = search.value; draw(); syncUrl(); });
    root.replaceChildren(...(searchable ? [el('div', { class: 'resource-controls' }, search, status)] : []),
      ...(chips.length ? [filters] : []), list);
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
