# MoreSpace metric library: research and recovery notes

The restored library contains 45 metrics. The 29 original entries were recovered from the saved website preview and preserved verbatim at the field level; the 16 additions and analysis guidance were reconstructed from the researched v3 definitions. Every metric includes three analysis dimensions, a review cadence, an accountable role, three diagnostic questions, three actions, and three data requirements.

| Category | Metrics |
|---|---:|
| Acquisition | 11 |
| Pipeline | 8 |
| Revenue | 9 |
| Product | 5 |
| Operations | 5 |
| Data quality | 3 |
| AI quality | 4 |

## Definition decisions

- `bounce-rate` means outbound email delivery bounce. The denominator is attempted recipient-message pairs, with retries deduplicated and final soft-bounce treatment agreed. It is separate from GA4 website bounce.
- `email-ctr` uses successful deliveries and counts each clicked recipient-message pair once. Total clicks and click-to-open rate use other denominators. Bot filtering and link classification need documented rules.
- `unsubscribe-rate` is a configured delivery-denominator metric. Vendor dashboards can use another denominator; reconstruct the agreed measure from confirmed campaign unsubscribes and delivery records.
- `positive-reply-rate` measures positive-intent prospects among substantive responding prospects. Smartlead documents positive replies divided by replies; this library explicitly deduplicates prospects and excludes automated responses. The rate among all contacted prospects is a separate measure.
- `meeting-booking-rate` measures progression from positive response to valid booking. Its denominator is the prior positive-intent stage. Booked, held, and qualified meetings remain separate outcomes.
- GA4 engagement means engaged sessions divided by sessions. The property duration threshold is configurable; the default criterion is longer than ten seconds, with key events or multiple page/screen views also qualifying a session. Session conversion counts sessions with a selected key event once, rather than event occurrences.
- Open qualified pipeline is unweighted opportunity value at an agreed snapshot and expected-close horizon. Weighted forecasts and realized revenue differ. Normalize currency, identify missing amounts, and review stale deals.
- NRR uses the fixed starting paying-customer revenue cohort, excludes new accounts, and can exceed 100%. Expansion MRR sums deduplicated positive recurring-value movements for existing paying accounts; one-off charges and new-customer MRR are excluded.
- Groundedness, task acceptance accuracy, validated-task cost, and AI case escalation are client-configured evaluation and operating measures. Define evidence, rubrics, samples, case boundaries, review costs, and thresholds for the task. They are not universal model scores or benchmark targets.
- Pipeline failure measures failed terminal attempts among succeeded-or-failed attempts. Canceled and pending runs are separate. Retried attempts and eventual logical-job recovery differ; technical success still requires business-output validation.
- Fully loaded CAC includes allocated acquisition sales and marketing costs. Media CAC contains advertising cost only. Simple gross-profit LTV includes margin; the calculator's separately labeled revenue LTV estimate follows another scope.

## Official references

Research was checked on 7 October 2026. The individual JSON entries retain their applicable primary-source URLs.

- [Mailchimp report API](https://mailchimp.com/developer/marketing/api/reports/get), [email campaign reports](https://mailchimp.com/help/about-email-campaign-reports/), [open and click rates](https://mailchimp.com/help/about-open-and-click-rates/), [bounces](https://mailchimp.com/help/about-bounces/), and [unsubscribes](https://mailchimp.com/help/about-unsubscribes/).
- [Smartlead analytics formulas](https://helpcenter.smartlead.ai/en/articles/122-how-to-replicate-the-ui-campaign-analytics-using-the-api), [out-of-office reply adjustment](https://helpcenter.smartlead.ai/en/articles/95-marking-out-of-office-adjusts-your-replies), and [calendar integrations](https://www.smartlead.ai/integrations).
- [GA4 engagement](https://support.google.com/analytics/answer/12195621?hl=en), [GA4 session settings](https://support.google.com/analytics/answer/9191807?hl=en), [session key-event rate](https://support.google.com/analytics/answer/12923437?hl=en), and [Search Console performance](https://support.google.com/webmasters/answer/7576553?hl=en).
- [HubSpot forecast amounts](https://knowledge.hubspot.com/forecast/set-up-the-forecast-tool) and [sales analytics](https://knowledge.hubspot.com/reports/create-sales-reports-in-the-sales-analytics-suite).
- [Stripe NRR](https://stripe.com/resources/more/net-revenue-retention) and [recurring-revenue movements](https://stripe.com/resources/more/how-to-use-monthly-recurring-revenue-mrr-and-annual-recurring-revenue-arr-to-guide-growth).
- [Claude evidence grounding](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations), [task evaluation](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests), and [ticket routing](https://platform.claude.com/docs/en/about-claude/use-case-guides/ticket-routing).
- [OpenAI evaluation practice](https://developers.openai.com/api/docs/guides/evaluation-best-practices), [cost optimization](https://developers.openai.com/api/docs/guides/cost-optimization), and [actual usage and cost review](https://help.openai.com/en/articles/10478918-reviewing-api-usage-and-costs).
- [Microsoft Fabric pipeline monitoring](https://learn.microsoft.com/en-us/fabric/data-factory/monitor-pipeline-runs) and [Azure Data Factory monitoring](https://learn.microsoft.com/en-us/azure/data-factory/monitor-data-factory).

## Recovery verification

All 45 examples were independently recalculated from their named inputs; all passed within rounding tolerance. The recovered original 29 entries were compared against the base JSON with deep equality, excluding only the new analysis field. Checks confirmed 45 unique IDs, every analysis array containing three nonempty meaningful entries, nonempty owner and cadence, HTTPS source protocols, and no forbidden controls or UTF-8 replacement characters.

| Added metric | Verified result |
|---|---:|
| Email bounce rate | 2% |
| Positive reply share | 30% |
| Positive-response-to-booking rate | 40% |
| Delivered-email CTR | 5% |
| Delivered-email unsubscribe rate | 0.5% |
| Organic search CTR | 3% |
| GA4 engagement rate | 65% |
| GA4 session key-event rate | 4.2% |
| Open qualified pipeline | 55,000 currency units |
| Net revenue retention | 102% |
| Expansion MRR | 5,000 currency units/month |
| AI claim groundedness | 95% |
| AI task acceptance accuracy | 92% |
| Cost per validated AI task | 0.40 currency units/task |
| Terminal pipeline failure rate | 5% |
| AI case escalation rate | 14% |

Pipeline and expansion example inputs are numeric arrays. A renderer should present them as readable values: `qualified_opportunity_amounts: [12000, 18000, 25000]` and `eligible_positive_mrr_increments: [1500, 2500, 1000]`.

Zero denominators remain undefined. Empty eligible sets sum to zero for pipeline value and expansion MRR; missing amounts require explicit exceptions. Zero or negative contribution margin has no finite positive break-even ROAS. Examples illustrate arithmetic, not client results, current provider prices, forecasts, or universal performance targets.
