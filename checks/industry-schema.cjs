'use strict';
// Validates one industry website content file against the registry and the
// shared catalogues. Used by the build, the test suite and content authors:
//   node checks/industry-schema.cjs content/industries/hospitals.json
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJSON = name => JSON.parse(fs.readFileSync(path.join(root, 'content', name), 'utf8'));
const PHASES = ['Discover', 'Design', 'Build', 'Validate & launch', 'Operate & improve'];
const COMPLEXITY = ['Starter', 'Standard', 'Advanced'];
const RESERVED_PAGES = ['index', 'automations', 'journey', 'stack', 'how-we-work'];

function catalogues() {
  return {
    registry: readJSON('industries.json'),
    toolIds: new Set(readJSON('tools.json').map(x => x.id)),
    metricIds: new Set(readJSON('metric-library.json').map(x => x.id)),
    serviceIds: new Set(readJSON('services.json').map(x => x.id)),
    solutionIds: new Set(readJSON('solutions.json').map(x => x.id))
  };
}

function validateIndustry(data, known = catalogues()) {
  const errors = [];
  const fail = message => errors.push(message);
  const text = (value, where, max) => {
    if (typeof value !== 'string' || !value.trim()) return fail(where + ': required text is missing');
    if (max && value.length > max) fail(where + ': ' + value.length + ' characters exceeds ' + max);
    if (/lorem ipsum|\bTODO\b|\bTBD\b|\[insert/i.test(value)) fail(where + ': placeholder text');
    if (/guarantee|hipaa[- ]compliant|fully compliant|100% compliant|certified partner|official partner/i.test(value)) fail(where + ': unsupported guarantee, certification or compliance claim');
    if (/[<>]/.test(value)) fail(where + ': angle brackets are not allowed in content');
  };
  const noOutcomeNumbers = (value, where) => {
    if (typeof value === 'string' && /\d\s?%|\d+x\b|\b\d+\s?(?:times|percent)\b/i.test(value)) fail(where + ': quantified outcome claims are not allowed here; describe the outcome qualitatively');
  };
  const items = (value, where, min, max) => {
    if (!Array.isArray(value)) { fail(where + ': must be an array'); return []; }
    if (value.length < min || (max && value.length > max)) fail(where + ': expected ' + min + (max ? '–' + max : '+') + ' items, found ' + value.length);
    return value;
  };
  const strings = (value, where, min, max, limit = 220) => items(value, where, min, max).forEach((item, i) => text(item, where + '[' + i + ']', limit));
  const titled = (value, where, min, max) => items(value, where, min, max).forEach((item, i) => {
    text(item && item.title, where + '[' + i + '].title', 80);
    text(item && item.description, where + '[' + i + '].description', 420);
  });
  const refs = (value, set, where, min = 0) => items(value, where, min).forEach(id => { if (!set.has(id)) fail(where + ': unknown reference ' + id); });
  const slug = (value, where) => { if (typeof value !== 'string' || !/^[a-z][a-z\d-]*$/.test(value)) fail(where + ': invalid slug ' + value); };
  const https = (value, where) => { try { if (new URL(value).protocol !== 'https:') throw 0; } catch { fail(where + ': must be an https URL'); } };

  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['industry file must contain one JSON object'];
  const entry = known.registry.find(row => row.id === data.id);
  if (!entry) return ['unknown industry id ' + data.id];

  text(data.name, 'name', 80); text(data.shortName, 'shortName', 40);
  if (data.name !== entry.name) fail('name must equal the registry name "' + entry.name + '"');
  if (data.shortName !== entry.shortName) fail('shortName must equal the registry shortName "' + entry.shortName + '"');
  text(data.eyebrow, 'eyebrow', 90);
  text(data.headline, 'headline', 70); noOutcomeNumbers(data.headline, 'headline');
  text(data.summary, 'summary', 320); noOutcomeNumbers(data.summary, 'summary');
  text(data.shareText, 'shareText', 200);
  strings(data.audience, 'audience', 4, 6, 90);
  titled(data.challenges, 'challenges', 4, 6);
  (data.challenges || []).forEach((c, i) => noOutcomeNumbers(c && c.description, 'challenges[' + i + '].description'));

  const automations = items(data.automations, 'automations', 10, 14);
  const automationIds = new Set();
  const stageIds = new Set(((data.journey || {}).stages || []).map(s => s && s.id));
  const segmentIds = entry.segments.map(s => s[0]);

  const flagship = data.flagship || {};
  text(flagship.title, 'flagship.title', 80); text(flagship.summary, 'flagship.summary', 420);
  noOutcomeNumbers(flagship.summary, 'flagship.summary');
  items(flagship.steps, 'flagship.steps', 4, 6).forEach((step, i) => {
    text(step && step.title, 'flagship.steps[' + i + '].title', 60);
    text(step && step.description, 'flagship.steps[' + i + '].description', 320);
    refs(step && step.toolIds, known.toolIds, 'flagship.steps[' + i + '].toolIds', 1);
  });
  text(flagship.humanCheckpoint, 'flagship.humanCheckpoint', 320);
  strings(flagship.outcomes, 'flagship.outcomes', 3, 4, 200);
  (flagship.outcomes || []).forEach((o, i) => noOutcomeNumbers(o, 'flagship.outcomes[' + i + ']'));
  if (flagship.automationId !== undefined && !automations.some(a => a && a.id === flagship.automationId)) fail('flagship.automationId must reference an automation');

  automations.forEach((a, i) => {
    const where = 'automations[' + i + ']' + (a && a.id ? '(' + a.id + ')' : '');
    if (!a || typeof a !== 'object') return fail(where + ': must be an object');
    slug(a.id, where + '.id');
    if (automationIds.has(a.id)) fail(where + ': duplicate automation id');
    automationIds.add(a.id);
    text(a.title, where + '.title', 70); text(a.summary, where + '.summary', 300); noOutcomeNumbers(a.summary, where + '.summary');
    if (!stageIds.has(a.stage)) fail(where + '.stage: must be one of the journey stage ids');
    items(a.segmentIds, where + '.segmentIds', 1).forEach(id => { if (!segmentIds.includes(id)) fail(where + '.segmentIds: unknown segment ' + id); });
    text(a.problem, where + '.problem', 420); text(a.trigger, where + '.trigger', 260);
    strings(a.steps, where + '.steps', 3, 7, 260);
    text(a.humanCheckpoint, where + '.humanCheckpoint', 320);
    refs(a.toolIds, known.toolIds, where + '.toolIds', 2);
    strings(a.systems, where + '.systems', 1, 6, 80);
    text(a.data, where + '.data', 420);
    strings(a.kpis, where + '.kpis', 2, 5, 120);
    refs(a.metricIds || [], known.metricIds, where + '.metricIds');
    if (!COMPLEXITY.includes(a.complexity)) fail(where + '.complexity: must be one of ' + COMPLEXITY.join(', '));
    text(a.timeline, where + '.timeline', 40);
    if (typeof a.timeline === 'string' && !/week/i.test(a.timeline)) fail(where + '.timeline: express an indicative range in weeks');
    strings(a.outputs, where + '.outputs', 2, 5, 160);
  });

  const journey = data.journey || {};
  text(journey.label, 'journey.label', 50);
  if (journey.label !== entry.journeyLabel) fail('journey.label must equal the registry journeyLabel "' + entry.journeyLabel + '"');
  const usedInJourney = new Set();
  const seenStages = new Set();
  items(journey.stages, 'journey.stages', 5, 7).forEach((s, i) => {
    const where = 'journey.stages[' + i + ']';
    if (!s || typeof s !== 'object') return fail(where + ': must be an object');
    slug(s.id, where + '.id');
    if (seenStages.has(s.id)) fail(where + ': duplicate stage id'); seenStages.add(s.id);
    text(s.title, where + '.title', 50); text(s.description, where + '.description', 320);
    strings(s.touchpoints, where + '.touchpoints', 2, 6, 90);
    text(s.owner, where + '.owner', 90);
    items(s.automationIds, where + '.automationIds', 1).forEach(id => { if (!automationIds.has(id)) fail(where + '.automationIds: unknown automation ' + id); usedInJourney.add(id); });
  });
  for (const id of automationIds) if (!usedInJourney.has(id)) fail('automation ' + id + ' is not placed on any journey stage');
  for (const a of automations) if (a && a.stage && stageIds.has(a.stage)) {
    const stage = journey.stages.find(s => s && s.id === a.stage);
    if (stage && Array.isArray(stage.automationIds) && !stage.automationIds.includes(a.id)) fail('automation ' + a.id + ' declares stage ' + a.stage + ' but that stage does not list it');
  }

  const segments = items(data.segments, 'segments', entry.segments.length, entry.segments.length);
  if (JSON.stringify(segments.map(s => s && s.id)) !== JSON.stringify(segmentIds)) fail('segments must use the registry ids in order: ' + segmentIds.join(', '));
  segments.forEach((s, i) => {
    const where = 'segments[' + i + ']' + (s && s.id ? '(' + s.id + ')' : '');
    if (!s || typeof s !== 'object') return fail(where + ': must be an object');
    if (RESERVED_PAGES.includes(s.id)) fail(where + ': id collides with a reserved page name');
    if (entry.segments[i] && s.name !== entry.segments[i][1]) fail(where + '.name must equal the registry name "' + entry.segments[i][1] + '"');
    text(s.headline, where + '.headline', 80); text(s.summary, where + '.summary', 360); noOutcomeNumbers(s.summary, where + '.summary');
    strings(s.challenges, where + '.challenges', 3, 5, 260);
    titled(s.uses, where + '.uses', 4, 6);
    items(s.automationIds, where + '.automationIds', 3, 6).forEach(id => {
      const a = automations.find(x => x && x.id === id);
      if (!a) fail(where + '.automationIds: unknown automation ' + id);
      else if (!Array.isArray(a.segmentIds) || !a.segmentIds.includes(s.id)) fail(where + '.automationIds: ' + id + ' does not list this segment in its segmentIds');
    });
    strings(s.kpis, where + '.kpis', 4, 6, 120);
    strings(s.systems, where + '.systems', 2, 6, 80);
  });
  for (const id of segmentIds) if (!automations.some(a => a && Array.isArray(a.segmentIds) && a.segmentIds.includes(id))) fail('segment ' + id + ' has no automations');

  items(data.systems, 'systems', 4, 7).forEach((s, i) => {
    text(s && s.category, 'systems[' + i + '].category', 60);
    strings(s && s.examples, 'systems[' + i + '].examples', 2, 6, 60);
    text(s && s.role, 'systems[' + i + '].role', 260);
  });
  items(data.kpis, 'kpis', 6, 10).forEach((k, i) => {
    text(k && k.name, 'kpis[' + i + '].name', 60); text(k && k.definition, 'kpis[' + i + '].definition', 260); text(k && k.why, 'kpis[' + i + '].why', 260);
  });

  const how = data.howWeWork || {};
  const phases = items(how.phases, 'howWeWork.phases', 5, 5);
  if (JSON.stringify(phases.map(p => p && p.title)) !== JSON.stringify(PHASES)) fail('howWeWork.phases titles must be: ' + PHASES.join(', '));
  phases.forEach((p, i) => {
    const where = 'howWeWork.phases[' + i + ']';
    text(p && p.duration, where + '.duration', 40); text(p && p.description, where + '.description', 420);
    strings(p && p.deliverables, where + '.deliverables', 3, 6, 160); strings(p && p.clientInputs, where + '.clientInputs', 2, 5, 160);
  });
  const pilot = how.pilot || {};
  text(pilot.title, 'howWeWork.pilot.title', 80); text(pilot.description, 'howWeWork.pilot.description', 420); noOutcomeNumbers(pilot.description, 'howWeWork.pilot.description');
  strings(pilot.scope, 'howWeWork.pilot.scope', 3, 6, 200);
  strings(how.governance, 'howWeWork.governance', 4, 6, 260);

  items(data.compliance, 'compliance', 3, 6).forEach((c, i) => {
    text(c && c.title, 'compliance[' + i + '].title', 90); text(c && c.description, 'compliance[' + i + '].description', 480); https(c && c.sourceUrl, 'compliance[' + i + '].sourceUrl');
  });
  items(data.faqs, 'faqs', 5, 8).forEach((f, i) => { text(f && f.question, 'faqs[' + i + '].question', 160); text(f && f.answer, 'faqs[' + i + '].answer', 600); });
  refs(data.serviceIds, known.serviceIds, 'serviceIds', 2);
  refs(data.solutionIds, known.solutionIds, 'solutionIds', 1);
  refs(data.toolIds, known.toolIds, 'toolIds', 6);
  items(data.sources, 'sources', 3).forEach((url, i) => https(url, 'sources[' + i + ']'));
  if (Array.isArray(data.sources) && new Set(data.sources).size !== data.sources.length) fail('sources contain duplicates');

  const allowed = new Set(['id', 'name', 'shortName', 'eyebrow', 'headline', 'summary', 'shareText', 'audience', 'challenges', 'flagship', 'journey', 'segments', 'automations', 'systems', 'kpis', 'howWeWork', 'compliance', 'faqs', 'serviceIds', 'solutionIds', 'toolIds', 'sources']);
  for (const key of Object.keys(data)) if (!allowed.has(key)) fail('unexpected top-level field ' + key);
  return errors;
}

module.exports = { validateIndustry, catalogues, PHASES, COMPLEXITY, RESERVED_PAGES };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('Usage: node checks/industry-schema.cjs content/industries/<id>.json [...]'); process.exit(2); }
  const known = catalogues();
  let failed = 0;
  for (const file of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { console.log(file + ': invalid JSON: ' + error.message); failed++; continue; }
    const errors = validateIndustry(data, known);
    if (errors.length) { failed++; console.log(file + ': ' + errors.length + ' problem(s)\n  - ' + errors.join('\n  - ')); }
    else console.log(file + ': valid');
  }
  process.exit(failed ? 1 : 0);
}
