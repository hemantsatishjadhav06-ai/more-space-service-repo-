'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadPage } = require('./dom-adapter.cjs');
const contentDirectory = path.resolve(__dirname, '../content');
const readCatalog = name => JSON.parse(fs.readFileSync(path.join(contentDirectory, name + '.json'), 'utf8'));
const catalog = { tools: readCatalog('tools'), metrics: readCatalog('metric-library'), services: readCatalog('services'), routes: readCatalog('page-index') };
const namedCollaborationTools = ['jira', 'asana', 'slack', 'discord'];
function noErrors(page) { assert.deepEqual(page.errors, []); }
function detailTabs(page, id) { const owner = page.get(id).querySelector('[data-tabs]'); return { owner, buttons: owner.querySelectorAll('[data-tab-target]').filter(button => button.closest('[data-tabs]') === owner), panels: owner.querySelectorAll('[data-tab-panel]').filter(panel => panel.closest('[data-tabs]') === owner) }; }
test('actual tool page filters domain/family/tool coherently and switches all seven detail views', () => {
  const page = loadPage('tools.html'); noErrors(page);
  assert.deepEqual(page.get('tool-selector').querySelectorAll('[data-tool-id]').map(button => button.dataset.toolId), catalog.tools.map(tool => tool.id));
  page.click(page.document.querySelector('[data-tool-domain="software"]'));
  const family = page.get('tool-family-tabs').querySelectorAll('[data-tool-family]').find(button => button.dataset.toolFamily !== 'all');
  page.click(family);
  const choices = page.get('tool-selector').querySelectorAll('[data-tool-id]'); assert.ok(choices.length);
  const tabs = detailTabs(page, 'tool-workbench-detail'); assert.equal(tabs.buttons.length, 7);
  page.click(tabs.buttons.find(button => button.textContent === 'Implementation'));
  assert.equal(tabs.panels.filter(panel => !panel.hidden).length, 1); assert.match(tabs.panels.find(panel => !panel.hidden).textContent, /Inputs we need/);
  page.key(choices[0], 'End'); assert.equal(choices.at(-1).getAttribute('aria-selected'), 'true');
  assert.equal(page.document.querySelector('[data-tool-domain="software"]').getAttribute('aria-selected'), 'true');
  assert.equal(page.document.querySelectorAll('[data-tool-card]').filter(card => !card.hidden).length, choices.length);
  page.input(page.get('tool-search'), 'unlikely-query-no-platform-matches'); assert.equal(page.get('tool-empty').hidden, false); assert.equal(page.get('tool-selector').children.length, 0);
  page.input(page.get('tool-search'), ''); assert.equal(page.get('tool-empty').hidden, true);
});
test('actual shortlist enforces six tools and exports locally without active-connection claims', async () => {
  const page = loadPage('tools.html'); noErrors(page);
  const unique = [...new Map(page.document.querySelectorAll('[data-stack-add]').map(button => [button.dataset.stackAdd, button])).values()];
  for (const button of unique.slice(0, 6)) page.click(button);
  assert.equal(page.get('stack-selection').querySelectorAll('[data-stack-remove]').length, 6); assert.equal(unique[6].disabled, true);
  assert.equal(page.document.querySelector('[data-stack-count]').textContent, '6 / 6 selected');
  page.click(page.get('stack-export')); assert.equal(page.downloads[0].name, 'morespace-tool-shortlist.txt');
  const text = await page.blobs.get(page.downloads[0].href).text(); assert.match(text, /not a connected or live stack/); assert.match(text, /Potential outputs/);
  page.click(page.get('stack-clear')); assert.equal(page.get('stack-selection').querySelectorAll('[data-stack-remove]').length, 0); assert.equal(page.get('stack-export').disabled, true); assert.equal(unique[6].disabled, false);
});
test('actual explorer progresses through goal, service, capability and six detail tabs', () => {
  const page = loadPage('explore.html'); noErrors(page);
  page.click(page.document.querySelector('[data-goal-domain="ai-data"]'));
  page.click(page.get('explorer-service-tabs').querySelector('[data-explorer-service="data-analytics"]'));
  const choices = page.get('explorer-capability-tabs').querySelectorAll('[data-explorer-capability]'); assert.ok(choices.length >= 3);
  page.click(choices[1]); assert.equal(choices[1].getAttribute('aria-selected'), 'true');
  const tabs = detailTabs(page, 'explorer-detail'); assert.equal(tabs.buttons.length, 6);
  page.click(tabs.buttons.find(button => button.textContent === 'Metrics')); const panel = tabs.panels.find(panel => !panel.hidden); assert.ok(panel.querySelectorAll('a').length);
  page.click(tabs.buttons.find(button => button.textContent === 'Readiness')); assert.match(tabs.panels.find(panel => !panel.hidden).querySelector('a').getAttribute('href'), /project\.html\?service=data-analytics/);
  assert.match(page.get('explorer-trail').textContent, /AI & data/); assert.match(page.get('explorer-trail').textContent, /Data/);
  page.key(tabs.buttons.at(-1), 'Home'); assert.equal(tabs.buttons[0].getAttribute('aria-selected'), 'true'); assert.equal(choices[1].getAttribute('aria-selected'), 'true');
  page.click(page.document.querySelector('[data-goal-domain="software"]')); assert.equal(page.get('explorer-service-tabs').querySelector('[aria-selected="true"]').dataset.explorerService, 'saas-tools');
});
test('actual metric library exposes seven categories, worked arrays, analysis and references', () => {
  const page = loadPage('growth-lab.html', { search: '?metric=expansion-mrr' }); noErrors(page);
  const metrics = JSON.parse(page.get('metric-data').textContent); assert.deepEqual(metrics.map(metric => metric.id), catalog.metrics.map(metric => metric.id)); assert.equal(page.document.querySelectorAll('button[data-category]').length, new Set(catalog.metrics.map(metric => metric.category)).size);
  const tabs = detailTabs(page, 'metric-detail'); assert.equal(tabs.buttons.length, 4);
  page.click(tabs.buttons.find(button => button.textContent === 'Formula & example')); assert.match(tabs.panels.find(panel => !panel.hidden).textContent, /1,500; 2,500; 1,000/);
  page.click(tabs.buttons.find(button => button.textContent === 'Analysis & actions')); assert.match(tabs.panels.find(panel => !panel.hidden).textContent, /Ownership & cadence/); assert.ok(tabs.panels.find(panel => !panel.hidden).querySelectorAll('li').length >= 6);
  page.click(tabs.buttons.find(button => button.textContent === 'Limits & sources')); assert.ok(tabs.panels.find(panel => !panel.hidden).querySelectorAll('a').every(link => link.getAttribute('href').startsWith('https://')));
  page.click(page.document.querySelector('[data-category="ai-quality"]')); assert.equal(page.get('metric-list').querySelectorAll('[data-metric]').length, catalog.metrics.filter(metric => metric.category === 'ai-quality').length);
  page.input(page.get('metric-search'), 'no-metric-matches-this-query'); assert.equal(page.get('metric-empty').hidden, false);
});
test('actual currency calculators, CSV download, local brief and mobile menu work in isolation', async () => {
  const page = loadPage('calculators.html', { width: 390 }); noErrors(page);
  page.get('currency').value = 'EUR'; page.get('currency').dispatchEvent({ type: 'change' });
  assert.match(page.get('funnel-results').textContent, /€/); assert.equal(page.get('funnel-visual').querySelectorAll('.funnel-stage').length, 4);
  const form = page.get('funnel-form'); page.input(form.elements.namedItem('leadRate'), '101'); assert.equal(page.get('funnel-error').hidden, false);
  page.input(form.elements.namedItem('leadRate'), '8'); assert.equal(page.get('funnel-error').hidden, true);
  page.click(page.get('funnel-export')); const csv = await page.blobs.get(page.downloads[0].href).text(); assert.match(csv, /"Currency","EUR"/);
  const toggle = page.document.querySelector('[data-nav-toggle]'); page.click(toggle); assert.equal(toggle.getAttribute('aria-expanded'), 'true'); page.key(page.document, 'Escape'); assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  const brief = loadPage('project.html', { search: '?service=saas-tools' }); noErrors(brief); const briefForm = brief.get('brief-form');
  assert.equal(briefForm.querySelector('[data-service-id="saas-tools"]').checked, true);
  for (const [name, value] of Object.entries({ name: 'Hemant', email: 'test@example.com', company: 'Example', objective: 'Build a reporting workspace' })) brief.input(briefForm.elements.namedItem(name), value);
  briefForm.dispatchEvent({ type: 'submit' }); assert.equal(brief.downloads[0].name, 'morespace-project-brief.txt');
  const text = await brief.blobs.get(brief.downloads[0].href).text(); assert.match(text, /Build a reporting workspace/); assert.match(text, /has not been sent/);
  brief.click(brief.get('brief-copy')); await Promise.resolve(); assert.equal(brief.copied.length, 1);
  brief.input(briefForm.elements.namedItem('objective'), '   '); briefForm.dispatchEvent({ type: 'submit' }); assert.equal(brief.downloads.length, 1);
});
test('dynamic logos use the standalone preview asset resolver', () => {
  const resolved = []; const page = loadPage('tools.html', { search: '?tool=ollama', resolveAsset: src => { resolved.push(src); return 'data:image/svg+xml;base64,PHN2Zy8+'; } }); noErrors(page);
  assert.ok(resolved.some(src => src.includes('ollama'))); assert.equal(page.get('tool-workbench-detail').querySelector('img[data-logo]').getAttribute('src'), 'data:image/svg+xml;base64,PHN2Zy8+');
});
test('every generated page initializes without script errors and scopes its nested panel associations', () => {
  const directory = path.resolve(__dirname, '../dist'); const files = [];
  function walk(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, item.name); if (item.isDirectory()) walk(file); else if (item.name.endsWith('.html')) files.push(path.relative(directory, file)); } }
  walk(directory); assert.deepEqual(files.sort(), [...catalog.routes].sort(), 'every manifest route must be initialized, without stale generated pages');
  for (const file of files) {
    const page = loadPage(file); assert.deepEqual(page.errors, [], file);
    for (const owner of page.document.querySelectorAll('[data-tabs]')) {
      const buttons = owner.querySelectorAll('[data-tab-target]').filter(button => button.closest('[data-tabs]') === owner);
      const panels = owner.querySelectorAll('[data-tab-panel]').filter(panel => panel.closest('[data-tabs]') === owner);
      assert.equal(buttons.filter(button => button.getAttribute('aria-selected') === 'true').length, 1, file);
      assert.equal(panels.filter(panel => !panel.hidden).length, 1, file);
      for (const button of buttons) assert.ok(panels.some(panel => panel.id === button.getAttribute('aria-controls')), file + ': ' + button.id);
    }
  }
});

test('each requested collaboration platform opens its own tool, implementation and official references', () => {
  for (const id of namedCollaborationTools) {
    const expected = catalog.tools.find(tool => tool.id === id);
    assert.ok(expected, 'requested collaboration platform missing: ' + id);
    const page = loadPage('tools.html', { search: '?tool=' + id }); noErrors(page);
    assert.equal(page.get('tool-selector').querySelector('[aria-selected="true"]').dataset.toolId, id);
    assert.equal(page.document.querySelector('[data-tool-domain="' + expected.domain + '"]').getAttribute('aria-selected'), 'true');
    assert.equal(page.get('tool-family-tabs').querySelector('[aria-selected="true"]').dataset.toolFamily, expected.family);
    const tabs = detailTabs(page, 'tool-workbench-detail');
    page.click(tabs.buttons.find(button => button.textContent === 'Implementation'));
    const implementation = tabs.panels.find(panel => !panel.hidden);
    assert.match(implementation.textContent, /Inputs we need/);
    assert.ok(implementation.querySelectorAll('li').length >= expected.implementation.inputs.length + expected.implementation.steps.length);
    page.click(tabs.buttons.find(button => button.textContent === 'References'));
    assert.ok(tabs.panels.find(panel => !panel.hidden).querySelectorAll('a').some(link => link.getAttribute('href') === expected.docsUrl), id + ': documentation link missing');
    assert.ok(page.get('tool-workbench-detail').querySelector('img[data-logo]'), id + ': genuine logo missing from selected tool');
  }
});

test('team operations can be selected through the capability explorer and project-brief deep link', () => {
  const team = catalog.services.find(service => service.id === 'team-operations');
  assert.ok(team, 'team operations must exist in the service registry');
  const page = loadPage('explore.html', { search: '?service=team-operations' }); noErrors(page);
  assert.equal(page.document.querySelector('[data-goal-domain="software"]').getAttribute('aria-selected'), 'true');
  assert.equal(page.get('explorer-service-tabs').querySelector('[aria-selected="true"]').dataset.explorerService, team.id);
  const choices = page.get('explorer-capability-tabs').querySelectorAll('[data-explorer-capability]');
  assert.deepEqual(choices.map(button => button.dataset.explorerCapability), team.capabilityGroups.map(group => group.id));
  for (const choice of choices) {
    page.click(choice); assert.equal(choice.getAttribute('aria-selected'), 'true');
    const tabs = detailTabs(page, 'explorer-detail');
    page.click(tabs.buttons.find(button => button.textContent === 'Tool stack'));
    assert.ok(tabs.panels.find(panel => !panel.hidden).querySelectorAll('a').length, choice.dataset.explorerCapability + ': tool links missing');
    page.click(tabs.buttons.find(button => button.textContent === 'Readiness'));
    assert.match(tabs.panels.find(panel => !panel.hidden).querySelector('a').getAttribute('href'), /project\.html\?service=team-operations/);
  }
  const brief = loadPage('project.html', { search: '?service=team-operations' }); noErrors(brief);
  assert.equal(brief.get('brief-form').querySelector('[data-service-id="team-operations"]').checked, true);
});

test('actual company journey traverses all eight stages and four independent tab levels', () => {
  const lifecycle = readCatalog('company-lifecycle');
  const page = loadPage('company.html'); noErrors(page);
  const ownedTabs = name => {
    const owner = page.document.querySelector('[data-tabs="' + name + '"]');
    assert.ok(owner, 'tab hierarchy missing: ' + name);
    return { owner, buttons: owner.querySelectorAll('[data-tab-target]').filter(button => button.closest('[data-tabs]') === owner), panels: owner.querySelectorAll('[data-tab-panel]').filter(panel => panel.closest('[data-tabs]') === owner) };
  };
  const select = (name, id) => {
    const tabs = ownedTabs(name), button = tabs.buttons.find(button => button.dataset.tabTarget === 'panel-' + name + '-' + id);
    assert.ok(button, name + ': target missing: ' + id);
    page.click(button);
    assert.equal(button.getAttribute('aria-selected'), 'true');
    assert.equal(tabs.buttons.filter(button => button.getAttribute('aria-selected') === 'true').length, 1, name);
    assert.equal(tabs.panels.filter(panel => !panel.hidden).length, 1, name);
    assert.equal(tabs.panels.find(panel => !panel.hidden).id, button.dataset.tabTarget);
    return { tabs, button, panel: tabs.panels.find(panel => !panel.hidden) };
  };
  const phases = ownedTabs('company-journey');
  assert.deepEqual(phases.buttons.map(button => button.dataset.tabTarget), ['launch', 'operate', 'scale'].map(id => 'panel-company-journey-' + id));
  for (const stage of lifecycle) {
    const phase = select('company-journey', stage.phase);
    const stageView = select('company-phase-' + stage.phase, stage.id);
    assert.equal(stageView.tabs.buttons.length, lifecycle.filter(row => row.phase === stage.phase).length);
    const workName = 'stage-' + stage.id + '-work';
    const work = select(workName, 'deliver');
    assert.equal(work.tabs.buttons.length, 3);
    const delivery = select('stage-' + stage.id + '-delivery', 'workflow');
    assert.ok(delivery.panel.querySelectorAll('a').length, stage.id + ': workflow tools missing');
    assert.equal(work.button.getAttribute('aria-selected'), 'true');
    assert.equal(stageView.button.getAttribute('aria-selected'), 'true');
    assert.equal(phase.button.getAttribute('aria-selected'), 'true');
    page.key(delivery.button, 'Home');
    assert.equal(delivery.tabs.buttons[0].getAttribute('aria-selected'), 'true');
    assert.equal(work.button.getAttribute('aria-selected'), 'true', 'a fourth-level keyboard event must not switch its work-area parent');
    select(workName, 'operate');
    const tools = select('stage-' + stage.id + '-operating', 'tools');
    for (const id of stage.toolIds) assert.ok(tools.panel.querySelectorAll('a').some(link => /tools\/[a-z\d-]+\.html$/.test(link.getAttribute('href')) && link.getAttribute('href').endsWith('/' + id + '.html')), stage.id + ': tool link missing for ' + id);
    select('stage-' + stage.id + '-operating', 'inputs');
    select('stage-' + stage.id + '-operating', 'owners');
    select(workName, 'measure');
    const metrics = select('stage-' + stage.id + '-evidence', 'metrics');
    for (const id of stage.metricIds) assert.ok(metrics.panel.querySelectorAll('a').some(link => link.getAttribute('href').endsWith('metrics/' + id + '.html')), stage.id + ': metric link missing for ' + id);
    const acceptance = select('stage-' + stage.id + '-evidence', 'acceptance');
    assert.ok(acceptance.panel.querySelectorAll('li').length >= stage.exitCriteria.length, stage.id + ': acceptance checks missing');
    const scope = select('stage-' + stage.id + '-evidence', 'scope');
    assert.ok(scope.panel.querySelectorAll('li').length >= stage.scopeLimits.length, stage.id + ': scope boundaries missing');
    assert.equal(stageView.button.getAttribute('aria-selected'), 'true');
    assert.equal(phase.button.getAttribute('aria-selected'), 'true');
  }
  // Switching a top-level phase preserves each stage's selected child detail.
  const previous = lifecycle.at(-1), previousScope = page.get('tab-stage-' + previous.id + '-evidence-scope');
  select('company-journey', 'launch');
  assert.equal(previousScope.getAttribute('aria-selected'), 'true');
  select('company-journey', 'scale');
  assert.equal(previousScope.getAttribute('aria-selected'), 'true');
});

test('company-stage project links preselect the stage and export it in a local brief', async () => {
  const lifecycle = readCatalog('company-lifecycle'), company = loadPage('company.html'); noErrors(company);
  for (const stage of lifecycle) {
    const link = company.document.querySelectorAll('a').find(link => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('project.html?')) return false;
      const query = new URL(href, 'https://morespace.test/').searchParams;
      return query.get('stage') === stage.id && query.get('service') === stage.serviceIds[0];
    });
    assert.ok(link, stage.id + ': scoped project-brief link missing');
    const search = new URL(link.getAttribute('href'), 'https://morespace.test/').search;
    const page = loadPage('project.html', { search }); noErrors(page);
    const form = page.get('brief-form'), selectedStage = form.elements.namedItem('companyStage');
    assert.deepEqual(selectedStage.querySelectorAll('option[data-stage-id]').map(option => option.dataset.stageId), lifecycle.map(row => row.id));
    assert.equal(selectedStage.value, stage.title, stage.id + ': company-stage deep link did not select the correct title');
    assert.equal(form.querySelector('[data-service-id="' + stage.serviceIds[0] + '"]').checked, true);
    for (const [name, value] of Object.entries({ name: 'Hemant', email: 'test@example.com', company: 'Example', objective: 'Set up the business operations' })) page.input(form.elements.namedItem(name), value);
    form.dispatchEvent({ type: 'submit' });
    assert.equal(page.downloads.length, 1); assert.equal(page.downloads[0].name, 'morespace-project-brief.txt');
    const text = await page.blobs.get(page.downloads[0].href).text();
    assert.ok(text.includes('Company stage: ' + stage.title), stage.id + ': downloaded brief omitted the lifecycle stage');
    assert.match(text, /has not been sent/);
  }
  const invalid = loadPage('project.html', { search: '?stage=does-not-exist' }); noErrors(invalid);
  assert.equal(invalid.get('brief-form').elements.namedItem('companyStage').value, '', 'unknown lifecycle stage must leave the optional selector unselected');
});
