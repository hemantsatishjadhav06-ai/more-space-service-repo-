(function (root) {
  'use strict';

  var fields = ['spend', 'cpc', 'leadRate', 'qualifiedRate', 'closeRate', 'orderValue', 'margin'];
  var percentages = ['leadRate', 'qualifiedRate', 'closeRate', 'margin'];

  function divide(numerator, denominator) {
    return denominator === 0 ? null : numerator / denominator;
  }

  /**
   * Forecast a paid-media funnel. Rates use percentage points (for example 5 = 5%).
   * Counts are fractional expected quantities, and costs share the input currency.
   * Ratios with a zero denominator are returned as null rather than Infinity.
   */
  function calculate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new RangeError('Provide all seven inputs as finite numeric values.');
    }

    fields.forEach(function (field) {
      if (typeof input[field] !== 'number' || !Number.isFinite(input[field]) || input[field] < 0) {
        throw new RangeError(field + ' must be a finite, nonnegative number.');
      }
    });
    if (input.cpc <= 0) {
      throw new RangeError('cpc must be greater than zero.');
    }
    percentages.forEach(function (field) {
      if (input[field] > 100) {
        throw new RangeError(field + ' must be between 0 and 100.');
      }
    });

    var visitors = input.spend / input.cpc;
    var leads = visitors * (input.leadRate / 100);
    var qualified = leads * (input.qualifiedRate / 100);
    var customers = qualified * (input.closeRate / 100);
    var revenue = customers * input.orderValue;
    var grossProfit = revenue * (input.margin / 100);
    var contribution = grossProfit - input.spend;

    return {
      visitors: visitors,
      leads: leads,
      qualified: qualified,
      customers: customers,
      revenue: revenue,
      grossProfit: grossProfit,
      contribution: contribution,
      CPL: divide(input.spend, leads),
      CPQL: divide(input.spend, qualified),
      mediaCAC: divide(input.spend, customers),
      ROAS: divide(revenue, input.spend),
      breakEvenROAS: divide(100, input.margin)
    };
  }

  var api = Object.freeze({ calculate: calculate });
  root.MoreSpaceMetrics = api;
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
