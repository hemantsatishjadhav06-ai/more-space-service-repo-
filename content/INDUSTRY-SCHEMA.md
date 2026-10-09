# Industry website content schema

Each industry website is generated from `content/industries/<id>.json`. The registry in
`content/industries.json` fixes the id, display name, short name, accent colour, icon,
journey label and segment ids/names. Validate a file with:

```
node checks/industry-schema.cjs content/industries/<id>.json
```

The build refuses invalid files. Every page is static HTML; nothing here runs the named
tools or connects to a client account.

## Generated pages

| Route | Built from |
|---|---|
| `industries/<id>/index.html` | overview: hero, challenges, flagship automation, segments, top automations, KPIs |
| `industries/<id>/automations.html` | the full automation playbook with stage and segment filters |
| `industries/<id>/journey.html` | journey stages, touchpoints, owners and the automations placed on each stage |
| `industries/<id>/stack.html` | industry systems we integrate with, catalogue tools, KPIs and metric links |
| `industries/<id>/how-we-work.html` | five delivery phases, pilot, governance, compliance notes and FAQs |
| `industries/<id>/<segment-id>.html` | one page per registry segment |

## Fields

All text is plain English (no HTML, no angle brackets). Keep it specific to the industry
and segment. Do not invent client names, testimonials, statistics or results. Outcomes are
qualitative; KPIs are proposed measures agreed with the client.

```jsonc
{
  "id": "hospitals",                       // registry id
  "name": "Hospitals & Healthcare",        // must equal registry name
  "shortName": "Healthcare",               // must equal registry shortName
  "eyebrow": "Automation for hospitals, clinics, labs and pharmacies",   // ≤ 90 chars
  "headline": "Less waiting. More time for care.",                        // h1, ≤ 70 chars, no numbers-as-claims
  "summary": "…",                          // lede, ≤ 320 chars
  "shareText": "…",                        // WhatsApp/LinkedIn share message, ≤ 200 chars
  "audience": ["Hospital COOs and administrators", "…"],                  // 4–6 roles
  "challenges": [{ "title": "…", "description": "…" }],                  // 4–6
  "flagship": {                            // the single "perfect automation" for this industry
    "title": "…", "summary": "…",
    "steps": [{ "title": "…", "description": "…", "toolIds": ["whatsapp", "n8n"] }],  // 4–6 steps
    "humanCheckpoint": "…",                // where a person reviews / decides
    "outcomes": ["…"],                     // 3–4 qualitative outcomes
    "automationId": "appointment-reminders" // optional: the matching automation id
  },
  "journey": {
    "label": "Patient journey",            // must equal registry journeyLabel
    "stages": [{                           // 5–7 stages in order
      "id": "discover", "title": "…", "description": "…",
      "touchpoints": ["…", "…"],           // 2–6
      "owner": "Front-office lead",        // the accountable client role
      "automationIds": ["…"]               // ≥ 1; every automation appears on its own stage
    }]
  },
  "segments": [{                           // exactly the registry segments, same order
    "id": "multi-specialty-hospitals", "name": "Multi-specialty hospitals",   // must equal registry
    "headline": "…", "summary": "…",
    "challenges": ["…"],                   // 3–5
    "uses": [{ "title": "…", "description": "…" }],   // 4–6 segment-specific uses
    "automationIds": ["…"],                // 3–6; each automation must list this segment
    "kpis": ["…"],                         // 4–6 short KPI names
    "systems": ["HIS", "…"]                // 2–6 systems typical for the segment
  }],
  "automations": [{                        // 10–14 automations
    "id": "appointment-reminders", "title": "…", "summary": "…",
    "stage": "book",                       // a journey stage id
    "segmentIds": ["clinics-day-care"],    // ≥ 1 registry segment ids
    "problem": "…", "trigger": "…",
    "steps": ["…"],                        // 3–7
    "humanCheckpoint": "…",
    "toolIds": ["whatsapp", "n8n"],        // ≥ 2 catalogue tool ids
    "systems": ["HIS / appointment system"],   // 1–6 industry systems touched
    "data": "…",                           // data used, consent, retention and access notes
    "kpis": ["…"],                         // 2–5
    "metricIds": ["response-time"],        // optional catalogue metric ids
    "complexity": "Starter",               // Starter | Standard | Advanced
    "timeline": "2–3 weeks",               // indicative range in weeks
    "outputs": ["…"]                       // 2–5 deliverables
  }],
  "systems": [{ "category": "Hospital information system (HIS)", "examples": ["…", "…"], "role": "…" }],  // 4–7
  "kpis": [{ "name": "…", "definition": "…", "why": "…" }],                                              // 6–10
  "howWeWork": {
    "phases": [                            // exactly: Discover, Design, Build, Validate & launch, Operate & improve
      { "title": "Discover", "duration": "1–2 weeks", "description": "…", "deliverables": ["…"], "clientInputs": ["…"] }
    ],
    "pilot": { "title": "…", "description": "…", "scope": ["…"] },   // a sensible first pilot
    "governance": ["…"]                    // 4–6 data, safety and approval practices
  },
  "compliance": [{ "title": "…", "description": "…", "sourceUrl": "https://…" }],   // 3–6, authoritative sources
  "faqs": [{ "question": "…", "answer": "…" }],                                       // 5–8
  "serviceIds": ["ai-automation", "…"],    // ≥ 2 service ids
  "solutionIds": ["whatsapp-lead-routing"],// ≥ 1 solution ids
  "toolIds": ["whatsapp", "…"],            // ≥ 6 catalogue tool ids for the stack page
  "sources": ["https://…"]                 // ≥ 3 unique https references used for this content
}
```

Valid `toolIds`, `metricIds`, `serviceIds` and `solutionIds` are the ids in
`content/tools.json`, `content/metric-library.json`, `content/services.json` and
`content/solutions.json`. Industry software that is not in the catalogue (for example an
HIS, LMS, Shopify or Tally) belongs in the free-text `systems` fields; naming it does not
imply a partnership.

Compliance notes explain what an implementation must respect and link to the authority.
They are not legal advice and never claim that MoreSpace or a client is certified or
compliant.
