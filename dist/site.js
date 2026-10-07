(function (root) {
  'use strict';

  var unitFields = ['impressions', 'clicks', 'spend', 'leads', 'qualified', 'customers', 'revenue', 'variableCosts', 'acquisitionCosts', 'mrr', 'activeCustomers', 'churnRate'];
  var currencies = ['USD', 'EUR', 'GBP', 'INR'];

  function ratio(numerator, denominator) {
    return denominator === 0 ? null : numerator / denominator;
  }

  /** Inputs must use one currency and matched reporting populations. Churn is a monthly percentage. */
  function calculateUnits(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RangeError('Provide the complete set of numeric inputs.');
    unitFields.forEach(function (field) {
      if (typeof input[field] !== 'number' || !Number.isFinite(input[field]) || input[field] < 0) {
        throw new RangeError(field + ' must be a finite, nonnegative number.');
      }
    });
    if (input.churnRate > 100) throw new RangeError('Monthly churn must be between 0 and 100%.');
    var preMediaMargin = input.revenue - input.variableCosts;
    var arpa = ratio(input.mrr, input.activeCustomers);
    var result = {
      ctr: ratio(input.clicks * 100, input.impressions),
      cpc: ratio(input.spend, input.clicks),
      cpm: ratio(input.spend * 1000, input.impressions),
      cpl: ratio(input.spend, input.leads),
      cpql: ratio(input.spend, input.qualified),
      mediaCAC: ratio(input.spend, input.customers),
      fullCAC: ratio(input.acquisitionCosts, input.customers),
      ROAS: ratio(input.revenue, input.spend),
      contribution: preMediaMargin - input.spend,
      breakEvenROAS: input.revenue > 0 && preMediaMargin > 0 ? input.revenue / preMediaMargin : null,
      arpa: arpa,
      ltv: arpa === null || input.churnRate === 0 ? null : arpa / (input.churnRate / 100)
    };
    Object.keys(result).forEach(function (key) {
      if (result[key] !== null && !Number.isFinite(result[key])) throw new RangeError('The calculation exceeds the supported numeric range. Reduce the input amounts.');
    });
    return result;
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function csvCell(value) {
    return '"' + String(value == null ? 'Undefined' : value).replace(/"/g, '""') + '"';
  }

  var serviceDomains = {
    marketing: ['strategy-funnels', 'marketing-creative'],
    software: ['saas-tools', 'team-operations'],
    'ai-data': ['ai-automation', 'data-analytics']
  };
  var domainNames = { all: 'All areas', marketing: 'Marketing', software: 'Software', 'ai-data': 'AI & data' };
  function familyName(tool) { return tool.family || tool.category || 'Other'; }
  function selectToolView(tools, input) {
    input = input || {};
    var requested = tools.find(function (tool) { return tool.id === input.tool; });
    var domain = Object.prototype.hasOwnProperty.call(domainNames, input.domain) ? input.domain : 'all';
    if (!input.domain && requested && Object.prototype.hasOwnProperty.call(serviceDomains, requested.domain)) domain = requested.domain;
    var domainTools = tools.filter(function (tool) { return domain === 'all' || tool.domain === domain; });
    var families = Array.from(new Set(domainTools.map(familyName)));
    var family = families.includes(input.family) ? input.family : 'all';
    if (!input.family && requested && domainTools.includes(requested)) family = familyName(requested);
    var needle = String(input.q || '').trim().toLowerCase();
    var visible = domainTools.filter(function (tool) {
      var searchText = [tool.name, tool.tagline, tool.description, familyName(tool), JSON.stringify(tool.useCases || []), JSON.stringify(tool.workflows || []), JSON.stringify(tool.implementation || {})].join(' ').toLowerCase();
      return (family === 'all' || familyName(tool) === family) && (!needle || searchText.includes(needle));
    });
    var selected = visible.find(function (tool) { return tool.id === input.tool; }) || visible[0] || null;
    return { domain: domain, family: family, families: families, visible: visible, selected: selected, q: String(input.q || '') };
  }
  function selectCapabilityView(services, input) {
    input = input || {};
    var domain = Object.prototype.hasOwnProperty.call(serviceDomains, input.domain) ? input.domain : 'marketing';
    if (!input.domain && input.service) Object.keys(serviceDomains).forEach(function (key) { if (serviceDomains[key].includes(input.service)) domain = key; });
    var choices = services.filter(function (service) { return serviceDomains[domain].includes(service.id); });
    var selected = choices.find(function (service) { return service.id === input.service; }) || choices[0] || null;
    var capabilities = selected && Array.isArray(selected.capabilityGroups) ? selected.capabilityGroups : [];
    var capability = capabilities.find(function (group) { return group.id === input.capability; }) || capabilities[0] || null;
    return { domain: domain, services: choices, service: selected, capabilities: capabilities, capability: capability };
  }
  function stackBrief(records) {
    if (!Array.isArray(records) || records.length > 6) throw new RangeError('A shortlist can contain up to six tools.');
    var lines = ['MORESPACE SERVICES - PROPOSED TOOL SHORTLIST', 'Prepared locally. This is a planning shortlist; it is not a connected or live stack.', ''];
    records.forEach(function (tool, index) {
      lines.push((index + 1) + '. ' + (tool.name || tool.id));
      if (tool.description) lines.push('Purpose: ' + tool.description);
      if (tool.implementation && tool.implementation.outputs && tool.implementation.outputs.length) lines.push('Potential outputs: ' + tool.implementation.outputs.join('; '));
      if (tool.considerations && tool.considerations.length) lines.push('Requirements and caveats: ' + tool.considerations.join('; '));
      if (tool.officialUrl) lines.push('Official website: ' + tool.officialUrl);
      lines.push('');
    });
    lines.push('Next step: confirm the business goal, integration availability, licensing, access, data mapping, and human ownership before implementation.', 'This file has not been sent to MoreSpace Services.');
    return lines.join('\n');
  }

  var api = Object.freeze({ calculateUnits: calculateUnits, escapeHTML: escapeHTML, selectToolView: selectToolView, selectCapabilityView: selectCapabilityView, stackBrief: stackBrief });
  root.MoreSpaceLab = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root.document) return;

  var document = root.document;
  var currentCleanup = [];
  var categoryNames = {
    acquisition: 'Acquisition', pipeline: 'Pipeline', revenue: 'Revenue',
    product: 'Product', operations: 'Operations', 'data-quality': 'Data quality', 'ai-quality': 'AI quality'
  };

  function listen(element, type, handler, options) {
    if (!element) return;
    element.addEventListener(type, handler, options);
    currentCleanup.push(function () { element.removeEventListener(type, handler, options); });
  }

  function debounce(fn, delay) {
    var timer;
    currentCleanup.push(function () { root.clearTimeout(timer); });
    return function () {
      root.clearTimeout(timer);
      timer = root.setTimeout(fn, delay);
    };
  }

  function setStatus(id, message, error) {
    var element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.hidden = !message;
    element.classList.toggle('is-error', !!error);
  }

  function setActive(button, active) {
    button.classList.toggle('is-active', active);
    button.classList.toggle('active', active);
    if (button.getAttribute('role') === 'tab') {
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (button.hasAttribute('data-metric')) {
        if (active) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      }
    } else {
      button.setAttribute('aria-pressed', String(active));
    }
  }

  function keyboardTabs(container, selector, select) {
    listen(container, 'keydown', function (event) {
      var current = event.target.closest(selector);
      if (!current || !container.contains(current)) return;
      var buttons = Array.from(container.querySelectorAll(selector)).filter(function (button) { return !button.hidden && !button.disabled; });
      var index = buttons.indexOf(current);
      var next = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      if (!buttons.length) return;
      event.preventDefault();
      buttons[next].focus();
      select(buttons[next]);
    });
  }

  function updateQuery(values) {
    try {
      if (root.MoreSpacePreviewRoute && typeof root.MoreSpacePreviewUpdateQuery === 'function') {
        root.MoreSpacePreviewUpdateQuery(values);
        return;
      }
      var url = new URL(root.location.href);
      Object.keys(values).forEach(function (key) {
        if (values[key]) url.searchParams.set(key, values[key]);
        else url.searchParams.delete(key);
      });
      root.history.replaceState(root.history.state, '', url.href);
    } catch (error) { /* A downloaded preview may restrict history changes. */ }
  }

  function queryParams() {
    if (root.MoreSpacePreviewRoute && typeof root.MoreSpacePreviewRoute.search === 'string') {
      return new URLSearchParams(root.MoreSpacePreviewRoute.search);
    }
    try { return new URL(root.location.href).searchParams; }
    catch (error) { return new URLSearchParams(); }
  }

  var tabSequence = 0;
  var selectedStack = new Set();
  var toolCache = new Map();
  function relativeHref(path) {
    var current = root.MoreSpacePreviewRoute ? root.MoreSpacePreviewRoute.path : root.location.pathname;
    var parts = String(current || '').replace(/\\/g, '/').split('/').filter(Boolean);
    var leafDirectory = parts.length > 1 ? parts[parts.length - 2] : '';
    return (['services', 'solutions', 'tools', 'metrics'].includes(leafDirectory) ? '../' : '') + String(path).replace(/^\//, '');
  }
  function readJSON(id, fallback) {
    var element = document.getElementById(id);
    if (!element) return fallback;
    try { return JSON.parse(element.textContent); } catch (error) { return fallback; }
  }
  function ownTabs(owner, selector) {
    return Array.from(owner.querySelectorAll(selector)).filter(function (element) { return element.closest('[data-tabs]') === owner; });
  }
  function activateNestedTab(owner, target) {
    var buttons = ownTabs(owner, '[data-tab-target]');
    var panels = ownTabs(owner, '[data-tab-panel]');
    if (!buttons.includes(target) || !panels.some(function (panel) { return panel.id === target.dataset.tabTarget; })) return;
    buttons.forEach(function (button) {
      if (!button.id) button.id = 'generated-tab-' + (++tabSequence);
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', button.dataset.tabTarget);
      setActive(button, button === target);
    });
    panels.forEach(function (panel) {
      var button = buttons.find(function (item) { return item.dataset.tabTarget === panel.id; });
      panel.setAttribute('role', 'tabpanel');
      if (button) panel.setAttribute('aria-labelledby', button.id);
      panel.hidden = panel.id !== target.dataset.tabTarget;
    });
  }
  function prepareNestedTabs(scope) {
    var owners = [];
    if (scope.matches && scope.matches('[data-tabs]')) owners.push(scope);
    owners = owners.concat(Array.from(scope.querySelectorAll('[data-tabs]')));
    owners.forEach(function (owner) {
      ownTabs(owner, '[data-tab-list]').forEach(function (list) { list.setAttribute('role', 'tablist'); });
      var buttons = ownTabs(owner, '[data-tab-target]');
      var selected = buttons.find(function (button) { return button.getAttribute('aria-selected') === 'true'; }) || buttons[0];
      if (selected) activateNestedTab(owner, selected);
    });
  }
  function initNestedTabs() {
    prepareNestedTabs(document);
    listen(document, 'click', function (event) {
      var button = event.target.closest('[data-tab-target]');
      if (!button || button.disabled) return;
      var owner = button.closest('[data-tabs]'), list = button.closest('[data-tab-list]');
      if (owner && list && list.closest('[data-tabs]') === owner) activateNestedTab(owner, button);
    });
    listen(document, 'keydown', function (event) {
      var button = event.target.closest('[data-tab-target]');
      if (!button) return;
      var owner = button.closest('[data-tabs]'), list = button.closest('[data-tab-list]');
      if (!owner || !list || list.closest('[data-tabs]') !== owner) return;
      var buttons = ownTabs(owner, '[data-tab-target]').filter(function (item) { return !item.disabled && item.closest('[data-tab-list]') === list; });
      var index = buttons.indexOf(button), next = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      if (!buttons.length) return;
      event.preventDefault(); activateNestedTab(owner, buttons[next]); buttons[next].focus();
    });
    if (typeof root.MutationObserver === 'function') {
      var observer = new root.MutationObserver(function (changes) {
        changes.forEach(function (change) { change.addedNodes.forEach(function (node) { if (node.nodeType === 1) prepareNestedTabs(node); }); });
      });
      observer.observe(document.body, { childList: true, subtree: true });
      currentCleanup.push(function () { observer.disconnect(); });
    }
  }
  function tabsHTML(prefix, items, level) {
    return '<div class="tab-system" data-tabs="' + escapeHTML(prefix) + '" data-level="' + level + '"><div class="tab-level"><span>Level ' + level + '</span><span>Inspect the detail</span></div><div data-tab-list role="tablist" aria-label="Detail views">' + items.map(function (item, index) {
      return '<button type="button" role="tab" id="tab-' + escapeHTML(prefix + '-' + item.id) + '" data-tab-target="panel-' + escapeHTML(prefix + '-' + item.id) + '" aria-controls="panel-' + escapeHTML(prefix + '-' + item.id) + '" aria-selected="' + (index === 0) + '" tabindex="' + (index === 0 ? '0' : '-1') + '">' + escapeHTML(item.label) + '</button>';
    }).join('') + '</div>' + items.map(function (item, index) {
      return '<section class="tab-content" id="panel-' + escapeHTML(prefix + '-' + item.id) + '" data-tab-panel role="tabpanel" aria-labelledby="tab-' + escapeHTML(prefix + '-' + item.id) + '"' + (index ? ' hidden' : '') + '>' + item.content + '</section>';
    }).join('') + '</div>';
  }
  function listHTML(values, className) {
    values = Array.isArray(values) ? values : values ? [values] : [];
    return '<ul class="' + (className || 'check-list') + '">' + values.map(function (value) { return '<li>' + escapeHTML(value && typeof value === 'object' ? value.description || value.title || '' : value) + '</li>'; }).join('') + '</ul>';
  }
  function referencesHTML(urls) {
    return '<ul class="source-list">' + Array.from(new Set(urls || [])).map(function (value, index) {
      var url = safeLink(value); if (!url) return '';
      var label = new URL(url).hostname.replace(/^www\./, '');
      return '<li><a href="' + escapeHTML(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(label) + ' - Reference ' + (index + 1) + ' <span aria-hidden="true">&#8599;</span></a></li>';
    }).join('') + '</ul>';
  }
  function brandHTML(tool) {
    var src = tool.logoPath ? relativeHref(tool.logoPath) : safeLink(tool.logoUrl);
    if (src && typeof root.MoreSpacePreviewResolveAsset === 'function') src = root.MoreSpacePreviewResolveAsset(src);
    var initials = tool.name.split(' ').map(function (word) { return word[0]; }).slice(0, 2).join('');
    return '<span class="tool-logo' + (tool.logoTheme === 'dark' ? ' logo-dark' : '') + (!src ? ' logo-failed' : '') + '">' + (src ? '<img data-logo src="' + escapeHTML(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '<span class="logo-fallback" aria-hidden="true">' + escapeHTML(initials) + '</span></span>';
  }
  function toolLinksHTML(ids, tools) {
    return '<div class="tool-pills">' + Array.from(new Set(ids || [])).map(function (id) {
      var tool = tools.find(function (entry) { return entry.id === id; }); if (!tool) return '';
      var official = safeLink(tool.officialUrl);
      return '<span class="tool-pill">' + (official ? '<a class="official-logo-link" href="' + escapeHTML(official) + '" target="_blank" rel="noopener noreferrer" aria-label="Official ' + escapeHTML(tool.name) + ' website">' + brandHTML(tool) + '</a>' : '') + '<a href="' + escapeHTML(relativeHref('tools/' + tool.id + '.html')) + '">' + escapeHTML(tool.name) + '</a></span>';
    }).join('') + '</div>';
  }
  function metricLinksHTML(ids, metrics) {
    return '<div class="metric-links">' + (ids || []).map(function (id) {
      var metric = metrics.find(function (entry) { return entry.id === id; });
      return metric ? '<a href="' + escapeHTML(relativeHref('metrics/' + id + '.html')) + '"><span>' + escapeHTML(metric.name) + '</span><span aria-hidden="true">&#8599;</span></a>' : '';
    }).join('') + '</div>';
  }
  function logoFallback(img) {
    img.hidden = true; var wrapper = img.closest('.tool-logo');
    if (wrapper) { wrapper.classList.add('logo-failed'); var label = wrapper.querySelector('.logo-fallback'); if (label) label.hidden = false; }
  }
  function prepareLogos(scope) { scope.querySelectorAll('img[data-logo]').forEach(function (img) { if (img.complete && img.naturalWidth === 0) logoFallback(img); }); }
  function initLogos() {
    listen(document, 'error', function (event) { if (event.target.matches && event.target.matches('img[data-logo]')) logoFallback(event.target); }, true);
    prepareLogos(document);
  }
  function exampleValue(value) {
    if (Array.isArray(value)) return value.map(exampleValue).join('; ');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return typeof value === 'number' ? number(value, 6) : String(value == null ? '' : value);
  }
  function cacheTools(tools) { (Array.isArray(tools) ? tools : tools ? [tools] : []).forEach(function (tool) { if (tool && tool.id) toolCache.set(tool.id, Object.assign({}, toolCache.get(tool.id) || {}, tool)); }); }
  function analysisHTML(metric) {
    var analysis = metric.analysis || {};
    return '<div class="analysis-layout"><div><h3>Break the result down</h3>' + listHTML(analysis.dimensions, 'chip-list') + '<h3>Questions we investigate</h3>' + listHTML(analysis.diagnostics) + '<h3>Actions the evidence can support</h3>' + listHTML(analysis.actions) + '</div><aside class="note-card"><p class="eyebrow">The reporting contract</p><h3>Ownership &amp; cadence</h3><p>' + escapeHTML(analysis.owner || 'Metric owner agreed during discovery') + '<br>' + escapeHTML(analysis.cadence || 'Reporting cadence agreed with the team') + '</p><h3>Required data</h3>' + listHTML(analysis.dataRequirements) + '<p class="small-note">Targets and thresholds are set for your business, cohort, channel, and measurement window.</p></aside></div>';
  }

  function toolBodyHTML(tool) {
    var imp = tool.implementation || {};
    return tabsHTML('tool-active-' + tool.id, [
      { id: 'overview', label: 'Overview', content: '<p class="large-copy">' + escapeHTML(tool.description) + '</p><div class="two-grid"><div><h3>Useful outputs</h3>' + listHTML(imp.outputs) + '</div><div><h3>Where we can apply it</h3>' + listHTML(tool.workflows) + '</div></div>' },
      { id: 'capabilities', label: 'Capabilities', content: '<div class="info-grid">' + (tool.useCases || []).map(function (useCase, i) { return '<article class="info-card"><span class="step-index">' + String(i + 1).padStart(2, '0') + '</span><h3>Use case ' + (i + 1) + '</h3><p>' + escapeHTML(useCase) + '</p></article>'; }).join('') + '</div>' },
      { id: 'implementation', label: 'Implementation', content: '<div class="two-grid"><div><h3>Inputs we need</h3>' + listHTML(imp.inputs) + '<h3>The delivery sequence</h3>' + listHTML(imp.steps, 'ordered-list') + '</div><aside class="note-card"><h3>Expert review points</h3>' + listHTML(imp.reviewPoints) + '<p>People own the scope, accuracy, and release decisions. AI and automation work within the agreed boundaries.</p></aside></div>' },
      { id: 'connections', label: 'Connections', content: '<h3>A considered connection plan</h3><p>These are proposed native or API connection candidates. We confirm available integrations, plans, permissions, and data mapping before implementation.</p>' + listHTML(tool.connectsTo, 'chip-list') },
      { id: 'measurement', label: 'Measurement', content: '<h3>The signals we can make visible</h3>' + listHTML(tool.metrics, 'chip-list') + '<p>We agree the data source, numerator, denominator, reporting window, and decision behind each measure.</p><a class="button button-outline" href="' + escapeHTML(relativeHref('growth-lab.html')) + '">Explore the metric analysis library &#8599;</a>' },
      { id: 'requirements', label: 'Requirements', content: '<h3>Before the workflow goes live</h3>' + listHTML(tool.considerations) + '<p>Tool licensing, source access, implementation scope, and ongoing ownership are defined during discovery.</p>' },
      { id: 'references', label: 'References', content: referencesHTML(tool.sourceUrls || tool.sourceURLs) + '<p class="asset-credit">Brand asset source: ' + escapeHTML(tool.logoSource) + '</p>' + (safeLink(tool.docsUrl) ? '<a class="text-link" href="' + escapeHTML(safeLink(tool.docsUrl)) + '" target="_blank" rel="noopener noreferrer">Open the documentation &#8599;</a>' : '') }
    ], 4);
  }
  function initToolWorkbench() {
    var tools = readJSON('tool-data', null), families = document.getElementById('tool-family-tabs'), selector = document.getElementById('tool-selector'), panel = document.getElementById('tool-workbench-detail'), search = document.getElementById('tool-search');
    if (!Array.isArray(tools) || !tools.length || !families || !selector || !panel || !search) return;
    cacheTools(tools);
    var domains = Array.from(document.querySelectorAll('[data-tool-domain]')), cards = Array.from(document.querySelectorAll('[data-tool-card]')), params = queryParams();
    if (domains.length) { domains[0].parentElement.setAttribute('role', 'tablist'); domains[0].parentElement.setAttribute('aria-label', 'Tool business area'); }
    var state = selectToolView(tools, { domain: params.get('domain'), family: params.get('family'), tool: params.get('tool'), q: params.get('q') });
    search.value = state.q;
    families.setAttribute('role', 'tablist'); families.setAttribute('aria-label', 'Tool family');
    selector.setAttribute('role', 'tablist'); selector.setAttribute('aria-label', 'Tools in this family'); selector.setAttribute('aria-orientation', 'vertical'); panel.setAttribute('role', 'tabpanel');
    function renderTool(tool) {
      if (!tool) { panel.innerHTML = '<p class="empty-state">No tools match this view. Try another family or search term.</p>'; panel.removeAttribute('aria-labelledby'); return; }
      panel.setAttribute('aria-labelledby', 'tool-choice-' + tool.id);
      var official = safeLink(tool.officialUrl);
      panel.innerHTML = '<header class="workbench-detail-heading"><p class="eyebrow">' + escapeHTML(domainNames[tool.domain] || tool.domain) + ' / ' + escapeHTML(familyName(tool)) + '</p><div class="tool-workbench-title">' + (official ? '<a class="official-logo-link" href="' + escapeHTML(official) + '" target="_blank" rel="noopener noreferrer" aria-label="Official ' + escapeHTML(tool.name) + ' website">' + brandHTML(tool) + '</a>' : '') + '<h2>' + escapeHTML(tool.name) + '</h2></div><p>' + escapeHTML(tool.tagline || tool.description) + '</p><div class="button-row"><a class="text-link" href="' + escapeHTML(relativeHref('tools/' + tool.id + '.html')) + '">Open the complete tool page &#8599;</a><button type="button" class="stack-add" data-stack-add="' + escapeHTML(tool.id) + '" data-stack-name="' + escapeHTML(tool.name) + '">+ Add to your shortlist</button></div></header>' + toolBodyHTML(tool);
      prepareNestedTabs(panel); prepareLogos(panel); renderStack();
    }
    function renderFamilies() {
      families.innerHTML = ['all'].concat(state.families).map(function (family, i) {
        var count = tools.filter(function (tool) { return (state.domain === 'all' || tool.domain === state.domain) && (family === 'all' || familyName(tool) === family); }).length;
        return '<button type="button" role="tab" id="tool-family-' + i + '" data-tool-family="' + escapeHTML(family) + '" aria-controls="' + (document.getElementById('tool-family-panel') ? 'tool-family-panel' : 'tool-workbench-detail') + '"><span>' + escapeHTML(family === 'all' ? 'All families' : family) + '</span><small>' + count + '</small></button>';
      }).join('');
    }
    function render() {
      state = selectToolView(tools, { domain: state.domain, family: state.family, tool: state.selected ? state.selected.id : '', q: search.value });
      domains.forEach(function (button) { if (!button.id) button.id = 'tool-domain-' + button.dataset.toolDomain; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', document.getElementById('tool-domain-panel') ? 'tool-domain-panel' : 'tool-workbench-detail'); setActive(button, button.dataset.toolDomain === state.domain); });
      families.querySelectorAll('[data-tool-family]').forEach(function (button) { setActive(button, button.dataset.toolFamily === state.family); });
      var domainPanel = document.getElementById('tool-domain-panel'), familyPanel = document.getElementById('tool-family-panel'), activeDomain = domains.find(function (button) { return button.dataset.toolDomain === state.domain; }), activeFamily = families.querySelector('[aria-selected="true"]');
      if (domainPanel && activeDomain) domainPanel.setAttribute('aria-labelledby', activeDomain.id);
      if (familyPanel && activeFamily) familyPanel.setAttribute('aria-labelledby', activeFamily.id);
      selector.innerHTML = state.visible.map(function (tool, i) { return '<button type="button" role="tab" id="tool-choice-' + escapeHTML(tool.id) + '" data-tool-id="' + escapeHTML(tool.id) + '" aria-controls="tool-workbench-detail"><span class="selector-index">' + String(i + 1).padStart(2, '0') + '</span><span>' + escapeHTML(tool.name) + '</span></button>'; }).join('');
      selector.querySelectorAll('[data-tool-id]').forEach(function (button) { setActive(button, !!state.selected && button.dataset.toolId === state.selected.id); });
      var visibleIds = new Set(state.visible.map(function (tool) { return tool.id; }));
      cards.forEach(function (card) { var button = card.querySelector('[data-stack-add]'), id = card.dataset.toolId || (button ? button.dataset.stackAdd : ''); card.hidden = id ? !visibleIds.has(id) : !state.visible.some(function (tool) { return tool.name === card.dataset.name; }); });
      var count = document.getElementById('tool-count'); if (count) count.textContent = state.visible.length + ' ' + (state.visible.length === 1 ? 'tool' : 'tools') + ' in this view';
      var empty = document.getElementById('tool-empty'); if (empty) empty.hidden = state.visible.length !== 0;
      renderTool(state.selected);
      updateQuery({ domain: state.domain === 'all' ? '' : state.domain, family: state.family === 'all' ? '' : state.family, tool: state.selected ? state.selected.id : '', q: search.value.trim(), toolCategory: '' });
    }
    function chooseDomain(button) { state = selectToolView(tools, { domain: button.dataset.toolDomain, family: 'all', q: search.value }); renderFamilies(); render(); }
    domains.forEach(function (button) { listen(button, 'click', function () { chooseDomain(button); }); });
    if (domains.length) keyboardTabs(domains[0].parentElement, '[data-tool-domain]', chooseDomain);
    function chooseFamily(button) { state = selectToolView(tools, { domain: state.domain, family: button.dataset.toolFamily, q: search.value }); render(); }
    listen(families, 'click', function (event) { var button = event.target.closest('[data-tool-family]'); if (button) chooseFamily(button); }); keyboardTabs(families, '[data-tool-family]', chooseFamily);
    function chooseTool(button) {
      state.selected = state.visible.find(function (tool) { return tool.id === button.dataset.toolId; }) || state.selected;
      selector.querySelectorAll('[data-tool-id]').forEach(function (item) { setActive(item, !!state.selected && item.dataset.toolId === state.selected.id); }); renderTool(state.selected);
      updateQuery({ domain: state.domain === 'all' ? '' : state.domain, family: state.family === 'all' ? '' : state.family, tool: state.selected ? state.selected.id : '', q: search.value.trim() });
    }
    listen(selector, 'click', function (event) { var button = event.target.closest('[data-tool-id]'); if (button) chooseTool(button); }); keyboardTabs(selector, '[data-tool-id]', chooseTool);
    listen(search, 'input', debounce(render, 120)); renderFamilies(); render();
  }
  function renderStack() {
    document.querySelectorAll('[data-stack-add]').forEach(function (button) { var active = selectedStack.has(button.dataset.stackAdd); button.textContent = active ? 'Shortlisted - remove' : '+ Add to your shortlist'; button.setAttribute('aria-pressed', String(active)); button.disabled = !active && selectedStack.size >= 6; });
    document.querySelectorAll('[data-stack-count]').forEach(function (element) { element.textContent = selectedStack.size + ' / 6 selected'; });
    var selection = document.getElementById('stack-selection');
    if (selection) selection.innerHTML = selectedStack.size ? '<p class="small-note">' + selectedStack.size + ' of 6 tools selected. This is a proposed stack for discovery.</p><div class="stack-chips">' + Array.from(selectedStack).map(function (id) { var tool = toolCache.get(id) || { id: id, name: friendlyKey(id.replace(/-/g, ' ')) }; return '<span class="stack-chip"><a href="' + escapeHTML(relativeHref('tools/' + id + '.html')) + '">' + escapeHTML(tool.name) + '</a><button type="button" data-stack-remove="' + escapeHTML(id) + '" aria-label="Remove ' + escapeHTML(tool.name) + ' from shortlist">&times;</button></span>'; }).join('') + '</div>' : '<p class="small-note">Add up to six tools to prepare a stack conversation. Your shortlist stays in this page session and is not sent.</p>';
    var exportButton = document.getElementById('stack-export'); if (exportButton) exportButton.disabled = selectedStack.size === 0;
    var clearButton = document.getElementById('stack-clear'); if (clearButton) clearButton.disabled = selectedStack.size === 0;
  }
  function initStack() {
    var stackData = readJSON('stack-data', []); cacheTools(Array.isArray(stackData) ? stackData : [stackData]);
    document.querySelectorAll('[data-stack-add]').forEach(function (button) { var id = button.dataset.stackAdd, card = button.closest('[data-tool-card]'); if (!toolCache.has(id)) toolCache.set(id, { id: id, name: button.dataset.stackName || (card ? card.dataset.name : '') || friendlyKey(id.replace(/-/g, ' ')) }); });
    listen(document, 'click', function (event) {
      var add = event.target.closest('[data-stack-add]'), remove = event.target.closest('[data-stack-remove]');
      if (add && !add.disabled) { var id = add.dataset.stackAdd; if (!toolCache.has(id)) toolCache.set(id, { id: id, name: add.dataset.stackName || friendlyKey(id.replace(/-/g, ' ')) }); if (selectedStack.has(id)) selectedStack.delete(id); else if (selectedStack.size < 6) selectedStack.add(id); renderStack(); }
      else if (remove) { selectedStack.delete(remove.dataset.stackRemove); renderStack(); }
    });
    listen(document.getElementById('stack-export'), 'click', function () { if (!selectedStack.size) return; var records = Array.from(selectedStack).map(function (id) { return toolCache.get(id) || { id: id, name: id }; }); download('morespace-tool-shortlist.txt', stackBrief(records)); setStatus('stack-status', 'Your proposed tool shortlist is downloaded. It has not been sent or connected to any accounts.', false); });
    listen(document.getElementById('stack-clear'), 'click', function () { selectedStack.clear(); renderStack(); setStatus('stack-status', 'Shortlist cleared.', false); }); renderStack();
  }
  function capabilityBodyHTML(service, capability, data) {
    return tabsHTML('capability-active-' + service.id + '-' + capability.id, [
      { id: 'overview', label: 'Overview', content: '<p class="large-copy">' + escapeHTML(capability.summary) + '</p><h3>Where this can help</h3>' + listHTML(capability.useCases) + '<a class="text-link" href="' + escapeHTML(relativeHref('services/' + service.id + '.html')) + '">Explore the complete ' + escapeHTML(service.shortTitle || service.title) + ' service &#8599;</a>' },
      { id: 'deliverables', label: 'Deliverables', content: '<h3>What your team receives</h3>' + listHTML(capability.deliverables) + '<p class="small-note">The detailed scope and acceptance criteria are agreed before implementation.</p>' },
      { id: 'workflow', label: 'Workflow', content: '<div class="architecture">' + (capability.workflow || []).map(function (step, i) { return '<article><span class="step-index">' + String(i + 1).padStart(2, '0') + '</span><div><h3>' + escapeHTML(step.title) + '</h3><p>' + escapeHTML(step.description) + '</p>' + toolLinksHTML(step.toolIds, data.tools || []) + '</div></article>'; }).join('') + '</div>' },
      { id: 'tools', label: 'Tool stack', content: '<h3>Tools we can bring into the work</h3><p>The final stack follows your requirements, existing systems, licenses, available APIs, and source access.</p>' + toolLinksHTML(capability.toolIds, data.tools || []) + '<a class="button button-outline" href="' + escapeHTML(relativeHref('tools.html')) + '">Compare tools in the workbench &#8599;</a>' },
      { id: 'metrics', label: 'Metrics', content: '<h3>The signals we can connect to decisions</h3>' + metricLinksHTML(capability.metricIds, data.metrics || []) + '<p>Each measure gets a clear definition, owner, reporting window, data source, and decision context.</p><a class="text-link" href="' + escapeHTML(relativeHref('growth-lab.html')) + '">Inspect metric definitions and analysis &#8599;</a>' },
      { id: 'readiness', label: 'Readiness', content: '<h3>Before we start</h3>' + listHTML(capability.requirements) + '<h3>People and ownership</h3><p>We confirm an accountable business owner, the approval path, and how the team will review the output. AI and automation assist the agreed work with human review points.</p><a class="button" href="' + escapeHTML(relativeHref('project.html?service=' + service.id)) + '">Prepare this project brief &#8599;</a>' }
    ], 4);
  }
  function initCapabilityExplorer() {
    var data = readJSON('explorer-data', null), serviceTabs = document.getElementById('explorer-service-tabs'), capabilityTabs = document.getElementById('explorer-capability-tabs'), panel = document.getElementById('explorer-detail');
    if (!data || !Array.isArray(data.services) || !serviceTabs || !capabilityTabs || !panel) return;
    cacheTools(data.tools || []);
    var goals = Array.from(document.querySelectorAll('[data-goal-domain]')), params = queryParams();
    if (goals.length) { goals[0].parentElement.setAttribute('role', 'tablist'); goals[0].parentElement.setAttribute('aria-label', 'Business goal'); }
    var state = selectCapabilityView(data.services, { domain: params.get('goal'), service: params.get('service'), capability: params.get('capability') });
    serviceTabs.setAttribute('role', 'tablist'); serviceTabs.setAttribute('aria-label', 'Services for this goal'); capabilityTabs.setAttribute('role', 'tablist'); capabilityTabs.setAttribute('aria-label', 'Capabilities in this service'); panel.setAttribute('role', 'tabpanel');
    function renderDetail() {
      if (!state.service || !state.capability) { panel.innerHTML = '<p class="empty-state">Choose a service to explore its capabilities.</p>'; return; }
      panel.setAttribute('aria-labelledby', 'explorer-capability-' + state.capability.id);
      panel.innerHTML = '<header class="workbench-detail-heading"><p class="eyebrow">' + escapeHTML(state.service.title) + '</p><h2>' + escapeHTML(state.capability.title) + '</h2></header>' + capabilityBodyHTML(state.service, state.capability, data);
      prepareNestedTabs(panel); prepareLogos(panel);
      var trail = document.getElementById('explorer-trail'); if (trail) trail.textContent = (domainNames[state.domain] || state.domain) + ' / ' + state.service.title + ' / ' + state.capability.title;
      updateQuery({ goal: state.domain, service: state.service.id, capability: state.capability.id });
    }
    function renderCapabilities() {
      capabilityTabs.innerHTML = state.capabilities.map(function (capability) { return '<button type="button" role="tab" id="explorer-capability-' + escapeHTML(capability.id) + '" data-explorer-capability="' + escapeHTML(capability.id) + '" aria-controls="explorer-detail">' + escapeHTML(capability.title) + '</button>'; }).join('');
      capabilityTabs.querySelectorAll('[data-explorer-capability]').forEach(function (button) { setActive(button, !!state.capability && button.dataset.explorerCapability === state.capability.id); });
    }
    function renderServices() {
      serviceTabs.innerHTML = state.services.map(function (service) { return '<button type="button" role="tab" id="explorer-service-' + escapeHTML(service.id) + '" data-explorer-service="' + escapeHTML(service.id) + '" aria-controls="' + (document.getElementById('explorer-service-panel') ? 'explorer-service-panel' : 'explorer-detail') + '">' + escapeHTML(service.title) + '</button>'; }).join('');
      serviceTabs.querySelectorAll('[data-explorer-service]').forEach(function (button) { setActive(button, !!state.service && button.dataset.explorerService === state.service.id); });
    }
    function updateParents() {
      goals.forEach(function (button) { if (!button.id) button.id = 'explorer-goal-' + button.dataset.goalDomain; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', document.getElementById('explorer-goal-panel') ? 'explorer-goal-panel' : 'explorer-detail'); setActive(button, button.dataset.goalDomain === state.domain); });
      var goalPanel = document.getElementById('explorer-goal-panel'), servicePanel = document.getElementById('explorer-service-panel'), selectedGoal = goals.find(function (button) { return button.dataset.goalDomain === state.domain; });
      if (goalPanel && selectedGoal) goalPanel.setAttribute('aria-labelledby', selectedGoal.id);
      if (servicePanel && state.service) servicePanel.setAttribute('aria-labelledby', 'explorer-service-' + state.service.id);
    }
    function chooseGoal(button) { state = selectCapabilityView(data.services, { domain: button.dataset.goalDomain }); renderServices(); renderCapabilities(); updateParents(); renderDetail(); }
    goals.forEach(function (button) { listen(button, 'click', function () { chooseGoal(button); }); }); if (goals.length) keyboardTabs(goals[0].parentElement, '[data-goal-domain]', chooseGoal);
    function chooseService(button) { state = selectCapabilityView(data.services, { domain: state.domain, service: button.dataset.explorerService }); serviceTabs.querySelectorAll('[data-explorer-service]').forEach(function (item) { setActive(item, !!state.service && item.dataset.explorerService === state.service.id); }); renderCapabilities(); updateParents(); renderDetail(); }
    listen(serviceTabs, 'click', function (event) { var button = event.target.closest('[data-explorer-service]'); if (button) chooseService(button); }); keyboardTabs(serviceTabs, '[data-explorer-service]', chooseService);
    function chooseCapability(button) { state = selectCapabilityView(data.services, { domain: state.domain, service: state.service.id, capability: button.dataset.explorerCapability }); capabilityTabs.querySelectorAll('[data-explorer-capability]').forEach(function (item) { setActive(item, !!state.capability && item.dataset.explorerCapability === state.capability.id); }); renderDetail(); }
    listen(capabilityTabs, 'click', function (event) { var button = event.target.closest('[data-explorer-capability]'); if (button) chooseCapability(button); }); keyboardTabs(capabilityTabs, '[data-explorer-capability]', chooseCapability);
    renderServices(); renderCapabilities(); updateParents(); renderDetail();
  }

  function initNavigation() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.getElementById('primary-nav');
    if (!toggle || !nav) return;
    function close() {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
      nav.classList.remove('is-open', 'open');
    }
    listen(toggle, 'click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      nav.classList.toggle('is-open', open);
      nav.classList.toggle('open', open);
    });
    listen(nav, 'click', function (event) { if (event.target.closest('a')) close(); });
    listen(document, 'keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { close(); toggle.focus(); }
    });
    var media = root.matchMedia('(min-width: 961px)');
    function resize(event) { if (event.matches) close(); }
    media.addEventListener('change', resize);
    currentCleanup.push(function () { media.removeEventListener('change', resize); });
  }

  function initTools() {
    if (document.getElementById('tool-data')) return;
    var search = document.getElementById('tool-search');
    var cards = Array.from(document.querySelectorAll('[data-tool-card]'));
    if (!search || !cards.length) return;
    var buttons = Array.from(document.querySelectorAll('[data-tool-filter]'));
    var initial = queryParams();
    var category = initial.get('toolCategory') || 'all';
    if (!buttons.some(function (button) { return button.dataset.toolFilter === category; })) category = 'all';
    search.value = initial.get('q') || '';
    function render() {
      var needle = search.value.trim().toLowerCase();
      var count = 0;
      cards.forEach(function (card) {
        var categories = (card.dataset.categories || '').split('|');
        var text = [card.dataset.name || '', card.dataset.search || '', card.textContent].join(' ').toLowerCase();
        var show = (category === 'all' || categories.includes(category)) && (!needle || text.includes(needle));
        card.hidden = !show;
        if (show) count += 1;
      });
      buttons.forEach(function (button) { setActive(button, button.dataset.toolFilter === category); });
      var countElement = document.getElementById('tool-count');
      if (countElement) countElement.textContent = count + ' ' + (count === 1 ? 'tool' : 'tools');
      var empty = document.getElementById('tool-empty');
      if (empty) empty.hidden = count !== 0;
      updateQuery({ toolCategory: category === 'all' ? '' : category, q: search.value.trim() });
    }
    buttons.forEach(function (button) {
      listen(button, 'click', function () { category = button.dataset.toolFilter; render(); });
    });
    listen(search, 'input', debounce(render, 100));
    render();
  }

  function safeLink(value) {
    try { var url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; }
    catch (error) { return ''; }
  }

  function friendlyKey(key) { return String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'); }

  function initMetricLibrary() {
    var dataElement = document.getElementById('metric-data');
    var list = document.getElementById('metric-list');
    var panel = document.getElementById('metric-detail');
    var search = document.getElementById('metric-search');
    var subcategories = document.getElementById('subcategory-tabs');
    if (!dataElement || !list || !panel || !search || !subcategories) return;
    var metrics;
    try { metrics = JSON.parse(dataElement.textContent); }
    catch (error) { setStatus('metric-empty', 'The metric library could not be loaded. Open a metric detail page from the directory.', true); return; }
    if (!Array.isArray(metrics) || !metrics.length) return;
    var categoryButtons = Array.from(document.querySelectorAll('button[data-category]'));
    var params = queryParams();
    var selectedMetric = metrics.find(function (metric) { return metric.id === params.get('metric'); });
    var category = selectedMetric ? selectedMetric.category : params.get('category');
    if (!metrics.some(function (metric) { return metric.category === category; })) category = metrics[0].category;
    var subcategory = 'all';
    var selectedId = selectedMetric ? selectedMetric.id : null;
    search.value = params.get('q') || '';
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Metrics in this group');
    list.setAttribute('aria-orientation', 'vertical');
    panel.setAttribute('role', 'tabpanel');
    panel.tabIndex = 0;
    var subgroupPanel = list.closest('.metric-explorer');
    if (subgroupPanel) {
      subgroupPanel.id = 'metric-explorer';
      subgroupPanel.setAttribute('role', 'tabpanel');
    }

    function renderDetail(metric) {
      if (!metric) { panel.innerHTML = '<p class="empty-state">Choose another group or search term to explore a metric.</p>'; panel.removeAttribute('aria-labelledby'); return; }
      var example = metric.example || {};
      var inputs = example.inputs && typeof example.inputs === 'object' ? Object.keys(example.inputs).map(function (key) { return '<div><span>' + escapeHTML(friendlyKey(key)) + '</span><strong>' + escapeHTML(exampleValue(example.inputs[key])) + '</strong></div>'; }).join('') : '';
      panel.setAttribute('aria-labelledby', 'metric-tab-' + metric.id);
      panel.innerHTML = '<div class="metric-detail-heading"><p class="eyebrow">' + escapeHTML(categoryNames[metric.category] || metric.category) + ' / ' + escapeHTML(metric.subcategory) + '</p><span class="unit-badge">' + escapeHTML(metric.unit) + '</span><h2>' + escapeHTML(metric.name) + '</h2></div>' + tabsHTML('metric-active-' + metric.id, [
        { id: 'definition', label: 'Definition', content: '<p class="eyebrow">What it measures</p><p class="large-copy">' + escapeHTML(metric.definition) + '</p><h3>How we use it</h3><p>' + escapeHTML(metric.interpretation) + '</p>' },
        { id: 'calculation', label: 'Formula & example', content: '<div class="formula"><span>Transparent calculation</span><strong>' + escapeHTML(metric.formula) + '</strong></div>' + (inputs ? '<div class="example-inputs">' + inputs + '</div>' : '') + '<p class="example-result">' + escapeHTML(example.explanation) + '</p><p class="small-note">Illustrative calculation. This is not a client result or a universal benchmark.</p>' },
        { id: 'analysis', label: 'Analysis & actions', content: analysisHTML(metric) },
        { id: 'context', label: 'Limits & sources', content: '<h3>Read the measure with context</h3><p>' + escapeHTML(metric.limitations) + '</p><h3>Definitions &amp; supporting references</h3>' + referencesHTML(metric.sourceUrls || metric.sourceURLs) }
      ], 4);
      prepareNestedTabs(panel);
    }

    function renderSubcategories() {
      var labels = Array.from(new Set(metrics.filter(function (metric) { return metric.category === category; }).map(function (metric) { return metric.subcategory; })));
      if (subcategory !== 'all' && !labels.includes(subcategory)) subcategory = 'all';
      subcategories.setAttribute('role', 'tablist');
      subcategories.setAttribute('aria-label', 'Metric subgroups');
      subcategories.innerHTML = ['all'].concat(labels).map(function (label, index) {
        return '<button type="button" id="metric-subgroup-' + index + '" role="tab" aria-controls="' + (subgroupPanel ? 'metric-explorer' : 'metric-detail') + '" data-subcategory="' + escapeHTML(label) + '">' + escapeHTML(label === 'all' ? 'All in this group' : label) + '</button>';
      }).join('');
      subcategories.querySelectorAll('[data-subcategory]').forEach(function (button) { setActive(button, button.dataset.subcategory === subcategory); });
    }

    function render() {
      var needle = search.value.trim().toLowerCase();
      var filtered = metrics.filter(function (metric) {
        var text = [metric.name, metric.definition, metric.formula, metric.subcategory, metric.interpretation].join(' ').toLowerCase();
        return metric.category === category && (subcategory === 'all' || metric.subcategory === subcategory) && (!needle || text.includes(needle));
      });
      if (!filtered.some(function (metric) { return metric.id === selectedId; })) selectedId = filtered.length ? filtered[0].id : null;
      categoryButtons.forEach(function (button) { setActive(button, button.dataset.category === category); });
      var categoryPanel = document.getElementById('metric-panel');
      if (categoryPanel) categoryPanel.setAttribute('aria-labelledby', 'category-' + category);
      subcategories.querySelectorAll('[data-subcategory]').forEach(function (button) { setActive(button, button.dataset.subcategory === subcategory); });
      var activeSubcategory = subcategories.querySelector('[aria-selected="true"]');
      if (subgroupPanel && activeSubcategory) subgroupPanel.setAttribute('aria-labelledby', activeSubcategory.id);
      list.innerHTML = filtered.map(function (metric) {
        return '<button type="button" role="tab" id="metric-tab-' + escapeHTML(metric.id) + '" data-metric="' + escapeHTML(metric.id) + '" aria-controls="metric-detail"><span>' + escapeHTML(metric.name) + '</span><small>' + escapeHTML(metric.unit) + '</small></button>';
      }).join('');
      list.querySelectorAll('[data-metric]').forEach(function (button) { setActive(button, button.dataset.metric === selectedId); });
      renderDetail(filtered.find(function (metric) { return metric.id === selectedId; }));
      var count = document.getElementById('metric-count');
      if (count) count.textContent = filtered.length + ' ' + (filtered.length === 1 ? 'metric' : 'metrics') + ' in ' + (categoryNames[category] || category);
      var empty = document.getElementById('metric-empty');
      if (empty) empty.hidden = filtered.length !== 0;
      updateQuery({ category: category, metric: selectedId, q: search.value.trim() });
    }

    function chooseCategory(button) {
      category = button.dataset.category; subcategory = 'all'; selectedId = null;
      renderSubcategories(); render();
    }
    categoryButtons.forEach(function (button) { listen(button, 'click', function () { chooseCategory(button); }); });
    var categoryContainer = categoryButtons.length ? categoryButtons[0].parentElement : null;
    if (categoryContainer) keyboardTabs(categoryContainer, 'button[data-category]', chooseCategory);
    function chooseSubcategory(button) { subcategory = button.dataset.subcategory; selectedId = null; render(); }
    listen(subcategories, 'click', function (event) { var button = event.target.closest('[data-subcategory]'); if (button) chooseSubcategory(button); });
    keyboardTabs(subcategories, '[data-subcategory]', chooseSubcategory);
    function chooseMetric(button) {
      selectedId = button.dataset.metric;
      list.querySelectorAll('[data-metric]').forEach(function (item) { setActive(item, item.dataset.metric === selectedId); });
      renderDetail(metrics.find(function (metric) { return metric.id === selectedId; }));
      updateQuery({ category: category, metric: selectedId, q: search.value.trim() });
    }
    listen(list, 'click', function (event) { var button = event.target.closest('[data-metric]'); if (button) chooseMetric(button); });
    keyboardTabs(list, '[data-metric]', chooseMetric);
    listen(search, 'input', debounce(render, 100));
    renderSubcategories(); render();
  }

  function readNumbers(form, fields) {
    var result = {};
    fields.forEach(function (field) {
      var input = form.elements.namedItem(field);
      if (!input || !String(input.value).trim()) throw new RangeError('Complete every numeric input before calculating.');
      result[field] = Number(input.value);
    });
    return result;
  }

  function selectedCurrency() {
    var select = document.getElementById('currency');
    return select && currencies.includes(select.value) ? select.value : 'USD';
  }

  function number(value, maximumDigits) {
    if (value === null || !Number.isFinite(value)) return 'Undefined';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: maximumDigits == null ? 2 : maximumDigits }).format(value);
  }

  function money(value) {
    if (value === null || !Number.isFinite(value)) return 'Undefined';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedCurrency(), minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }

  function download(filename, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    root.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function resultCards(items, result) {
    return items.map(function (item) {
      var value = result[item[0]];
      var display = item[2] === 'money' ? money(value) : number(value) + (value === null ? '' : item[2] === 'percent' ? '%' : item[2] === 'ratio' ? '×' : '');
      return '<dl class="result-card' + (item[0] === 'contribution' && value < 0 ? ' is-negative' : '') + '"><dt>' + escapeHTML(item[1]) + '</dt><dd>' + escapeHTML(display) + '</dd></dl>';
    }).join('');
  }

  function exportCalculation(filename, inputs, result, notes) {
    var lines = [['MoreSpace Services', 'Metric worksheet'], ['Currency', selectedCurrency()], ['Note', notes], [], ['Input', 'Value']];
    Object.keys(inputs).forEach(function (key) { lines.push([key, inputs[key]]); });
    lines.push([], ['Metric', 'Value']);
    Object.keys(result).forEach(function (key) { lines.push([key, result[key]]); });
    download(filename, lines.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n'), 'text/csv;charset=utf-8');
  }

  function initFunnel() {
    var form = document.getElementById('funnel-form');
    var output = document.getElementById('funnel-results');
    if (!form || !output || !root.MoreSpaceMetrics) return;
    var fields = ['spend', 'cpc', 'leadRate', 'qualifiedRate', 'closeRate', 'orderValue', 'margin'];
    var lastInput, lastResult;
    var items = [['visitors', 'Expected visitors'], ['leads', 'Expected leads'], ['qualified', 'Expected qualified leads'], ['customers', 'Expected customers'], ['revenue', 'Attributed revenue', 'money'], ['grossProfit', 'Pre-media gross profit', 'money'], ['contribution', 'Contribution after media', 'money'], ['CPL', 'Media cost / lead', 'money'], ['CPQL', 'Media cost / qualified lead', 'money'], ['mediaCAC', 'Media cost / customer', 'money'], ['ROAS', 'Revenue / ad spend', 'ratio'], ['breakEvenROAS', 'Break-even ROAS', 'ratio']];
    function render(report) {
      try {
        lastInput = readNumbers(form, fields);
        lastResult = root.MoreSpaceMetrics.calculate(lastInput);
        Object.values(lastResult).forEach(function (value) { if (value !== null && !Number.isFinite(value)) throw new RangeError('The forecast exceeds the supported numeric range. Reduce the input amounts.'); });
        output.innerHTML = resultCards(items, lastResult);
        var visual = document.getElementById('funnel-visual');
        if (visual) {
          var stages = [['visitors', 'Visitors'], ['leads', 'Leads'], ['qualified', 'Qualified'], ['customers', 'Customers']];
          visual.innerHTML = stages.map(function (stage) {
            var width = lastResult.visitors ? lastResult[stage[0]] / lastResult.visitors * 100 : 0;
            return '<div class="funnel-stage"><div class="funnel-stage-header"><span>' + stage[1] + '</span><strong>' + number(lastResult[stage[0]]) + '</strong></div><div class="funnel-stage-bar"><div class="funnel-stage-fill" style="width:' + Math.max(0, Math.min(100, width)) + '%;' + (lastResult[stage[0]] === 0 ? 'min-width:0;' : '') + '"></div></div></div>';
          }).join('');
        }
        setStatus('funnel-error', '', false);
        setStatus('funnel-status', 'Forecast updated in ' + selectedCurrency() + '. Fractional counts are expected values, not promised customers.', false);
        return true;
      } catch (error) {
        lastResult = null;
        output.innerHTML = '<p class="empty-state">Complete valid inputs to see the forecast.</p>';
        var visual = document.getElementById('funnel-visual'); if (visual) visual.innerHTML = '';
        setStatus('funnel-error', error.message, true);
        setStatus('funnel-status', '', false);
        if (report) form.reportValidity();
        return false;
      }
    }
    listen(form, 'submit', function (event) { event.preventDefault(); render(true); });
    listen(form, 'input', debounce(function () { render(false); }, 180));
    listen(form, 'reset', function () { root.setTimeout(function () { render(false); }, 0); });
    listen(document.getElementById('currency'), 'change', function () { render(false); });
    listen(document.getElementById('funnel-export'), 'click', function () {
      if (!render(true)) return;
      exportCalculation('morespace-funnel-forecast.csv', lastInput, lastResult, 'Illustrative forecast. Fractional expected counts. CPC > 0; percentage inputs use 0–100. CPL, CPQL and CAC include media only. Contribution excludes fixed overhead and taxes.');
      setStatus('funnel-status', 'Forecast worksheet downloaded. Your inputs have not been sent to MoreSpace.', false);
    });
    render(false);
  }

  function initUnitCalculator() {
    var form = document.getElementById('unit-form');
    var output = document.getElementById('unit-results');
    if (!form || !output) return;
    var lastInput, lastResult;
    var items = [['ctr', 'Click-through rate', 'percent'], ['cpc', 'Media cost / click', 'money'], ['cpm', 'Media cost / 1,000 impressions', 'money'], ['cpl', 'Media cost / lead', 'money'], ['cpql', 'Media cost / qualified lead', 'money'], ['mediaCAC', 'Media cost / new customer', 'money'], ['fullCAC', 'Fully loaded acquisition cost / customer', 'money'], ['ROAS', 'Revenue / ad spend', 'ratio'], ['contribution', 'Contribution after media', 'money'], ['breakEvenROAS', 'Break-even ROAS', 'ratio'], ['arpa', 'Monthly revenue / active customer', 'money'], ['ltv', 'Simple revenue LTV estimate', 'money']];
    function render(report) {
      try {
        lastInput = readNumbers(form, unitFields);
        lastResult = calculateUnits(lastInput);
        output.innerHTML = resultCards(items, lastResult);
        setStatus('unit-error', '', false);
        setStatus('unit-status', 'Worksheet updated in ' + selectedCurrency() + '. Undefined means the denominator or required margin is zero or invalid.', false);
        return true;
      } catch (error) {
        lastResult = null;
        output.innerHTML = '<p class="empty-state">Complete valid inputs to calculate your metrics.</p>';
        setStatus('unit-error', error.message, true);
        setStatus('unit-status', '', false);
        if (report) form.reportValidity();
        return false;
      }
    }
    listen(form, 'submit', function (event) { event.preventDefault(); render(true); });
    listen(form, 'input', debounce(function () { render(false); }, 180));
    listen(form, 'reset', function () { root.setTimeout(function () { render(false); }, 0); });
    listen(document.getElementById('currency'), 'change', function () { render(false); });
    listen(document.getElementById('unit-export'), 'click', function () {
      if (!render(true)) return;
      exportCalculation('morespace-metric-worksheet.csv', lastInput, lastResult, 'Use matched media cohorts for spend/revenue/new customers. Acquisition costs include the full cost scope, including media. Contribution = revenue − variable costs − media spend. LTV = monthly ARPA / monthly churn fraction, assumes stable churn and revenue, ignores margin and discounting. Active customers are distinct from newly acquired customers.');
      setStatus('unit-status', 'Metric worksheet downloaded. Your inputs have not been sent to MoreSpace.', false);
    });
    render(false);
  }

  function initBrief() {
    var form = document.getElementById('brief-form');
    if (!form) return;
    var output = document.getElementById('brief-output');
    var selectedService = queryParams().get('service');
    if (selectedService) form.querySelectorAll('input[name="services"]').forEach(function (input) {
      if (input.dataset.serviceId === selectedService) input.checked = true;
    });
    var selectedStage = queryParams().get('stage');
    var stageField = form.elements.namedItem('companyStage');
    if (selectedStage && stageField) stageField.querySelectorAll('option').forEach(function (option) {
      if (option.dataset.stageId === selectedStage) stageField.value = option.value;
    });
    var required = ['name', 'email', 'company', 'objective'];
    required.forEach(function (name) {
      var input = form.elements.namedItem(name);
      if (!input) return;
      listen(input, 'input', function () { input.setCustomValidity(''); });
    });
    function prepare() {
      required.forEach(function (name) {
        var input = form.elements.namedItem(name);
        if (input) input.setCustomValidity(String(input.value).trim() ? '' : 'Enter ' + (name === 'objective' ? 'your project objective' : 'your ' + name) + '.');
      });
      if (!form.reportValidity()) return null;
      function field(name) { var input = form.elements.namedItem(name); return input && typeof input.value === 'string' ? input.value.trim() : ''; }
      var services = Array.from(form.querySelectorAll('input[name="services"]:checked')).map(function (input) { return input.value; });
      var labels = [['name', 'Name'], ['email', 'Email'], ['company', 'Company'], ['companyStage', 'Company stage'], ['website', 'Website'], ['timezone', 'Time zone'], ['budget', 'Budget / commercial scope'], ['objective', 'Project objective'], ['notes', 'Additional context']];
      var text = 'MORESPACE SERVICES — PROJECT BRIEF\nPrepared locally. This brief has not been sent to MoreSpace Services.\n\n' + labels.map(function (item) { return item[1] + ': ' + (field(item[0]) || 'Not specified'); }).join('\n\n') + '\n\nServices of interest: ' + (services.length ? services.join(', ') : 'To be defined during discovery') + '\n\nNext step: share this brief with your MoreSpace contact once a contact address is confirmed.\n';
      if (output) {
        if ('value' in output) output.value = text; else output.textContent = text;
        output.hidden = false;
      }
      return text;
    }
    function save(event) {
      if (event) event.preventDefault();
      var text = prepare();
      if (!text) return;
      download('morespace-project-brief.txt', text);
      setStatus('brief-status', 'Your project brief is downloaded. It has not been sent; share it with your confirmed MoreSpace contact.', false);
    }
    listen(form, 'submit', save);
    var downloadButton = document.getElementById('brief-download');
    if (downloadButton && downloadButton.type !== 'submit') listen(downloadButton, 'click', save);
    listen(document.getElementById('brief-copy'), 'click', async function () {
      var text = prepare();
      if (!text) return;
      try {
        if (!root.navigator.clipboard || !root.navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
        await root.navigator.clipboard.writeText(text);
        setStatus('brief-status', 'Project brief copied. It has not been sent to MoreSpace.', false);
      } catch (error) {
        if (output) {
          output.focus();
          if (typeof output.select === 'function') output.select();
          else { var range = document.createRange(); range.selectNodeContents(output); var selection = root.getSelection(); selection.removeAllRanges(); selection.addRange(range); }
        }
        setStatus('brief-status', 'Your browser could not copy automatically. The prepared brief is selected below; copy it manually or download it.', false);
      }
    });
  }

  function init() {
    currentCleanup.forEach(function (cleanup) { cleanup(); });
    currentCleanup = [];
    initNavigation(); initLogos(); initNestedTabs(); initTools(); initMetricLibrary(); initToolWorkbench(); initCapabilityExplorer(); initStack(); initFunnel(); initUnitCalculator(); initBrief();
  }

  root.addEventListener('morespace:pagechange', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(typeof globalThis !== 'undefined' ? globalThis : this);
