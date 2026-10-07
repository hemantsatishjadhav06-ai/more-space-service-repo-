'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const funnel = require('../dist/metrics.js');
const lab = require('../dist/site.js');
const scenario = { spend: 10000, cpc: 2, leadRate: 8, qualifiedRate: 50, closeRate: 20, orderValue: 500, margin: 60 };
const actuals = { impressions: 120000, clicks: 2400, spend: 6000, leads: 120, qualified: 30, customers: 12, revenue: 18000, variableCosts: 7200, acquisitionCosts: 9600, mrr: 24000, activeCustomers: 120, churnRate: 5 };
test('the funnel model retains stage denominators and reports contribution after media', () => {
  const result = funnel.calculate(scenario);
  assert.equal(result.visitors, 5000); assert.equal(result.leads, 400); assert.equal(result.qualified, 200); assert.equal(result.customers, 40);
  assert.equal(result.revenue, 20000); assert.equal(result.grossProfit, 12000); assert.equal(result.contribution, 2000); assert.equal(result.mediaCAC, 250); assert.equal(result.ROAS, 2);
  assert.ok(Math.abs(result.breakEvenROAS - 5 / 3) < 1e-12);
});
test('zero funnel denominators remain undefined and a failed funnel still incurs media cost', () => {
  const result = funnel.calculate({ ...scenario, leadRate: 0 });
  assert.equal(result.CPL, null); assert.equal(result.mediaCAC, null); assert.equal(result.ROAS, 0); assert.equal(result.contribution, -10000);
  assert.equal(funnel.calculate({ ...scenario, spend: 0 }).ROAS, null);
  assert.equal(funnel.calculate({ ...scenario, margin: 0 }).breakEvenROAS, null);
});
test('invalid funnel assumptions are rejected and fractional expected counts are preserved', () => {
  assert.throws(() => funnel.calculate({ ...scenario, cpc: 0 }), RangeError); assert.throws(() => funnel.calculate({ ...scenario, closeRate: 101 }), RangeError);
  assert.throws(() => funnel.calculate({ ...scenario, spend: NaN }), RangeError);
  const result = funnel.calculate({ ...scenario, spend: 10, cpc: 3, leadRate: 50, qualifiedRate: 50, closeRate: 50 });
  assert.ok(Math.abs(result.customers - 5 / 12) < 1e-12);
});
test('actual inputs distinguish fully loaded CAC from media CAC and acquired from active customers', () => {
  const result = lab.calculateUnits(actuals);
  assert.equal(result.ctr, 2); assert.equal(result.cpc, 2.5); assert.equal(result.cpm, 50); assert.equal(result.mediaCAC, 500); assert.equal(result.fullCAC, 800);
  assert.equal(result.contribution, 4800); assert.equal(result.arpa, 200); assert.equal(result.ltv, 4000);
  assert.equal(lab.calculateUnits({ ...actuals, customers: 24 }).ltv, 4000);
  assert.equal(lab.calculateUnits({ ...actuals, activeCustomers: 240 }).mediaCAC, 500);
});
test('LTV and break-even metrics do not invent zero-denominator or negative-margin results', () => {
  assert.equal(lab.calculateUnits({ ...actuals, churnRate: 0 }).ltv, null); assert.equal(lab.calculateUnits({ ...actuals, activeCustomers: 0 }).ltv, null);
  const loss = lab.calculateUnits({ ...actuals, variableCosts: 20000 }); assert.equal(loss.contribution, -8000); assert.equal(loss.breakEvenROAS, null);
  const zeros = Object.fromEntries(Object.keys(actuals).map(key => [key, 0]));
  for (const [key, value] of Object.entries(lab.calculateUnits(zeros))) assert.equal(value, key === 'contribution' ? 0 : null);
});
test('actual-input validation rejects missing, negative, nonfinite and excessive percentage values', () => {
  for (const field of Object.keys(actuals)) for (const value of [undefined, -1, Infinity, NaN, '3']) assert.throws(() => lab.calculateUnits({ ...actuals, [field]: value }), RangeError);
  assert.throws(() => lab.calculateUnits({ ...actuals, churnRate: 101 }), RangeError);
  assert.throws(() => lab.calculateUnits({ ...actuals, clicks: Number.MAX_VALUE }), RangeError);
});
