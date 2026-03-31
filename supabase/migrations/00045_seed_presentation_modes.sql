-- Add presentationMode and chartType to seeded report template blocks

-- Template 1: Standard Individual
UPDATE report_templates SET blocks = '[
  {"id":"blk-si-01","type":"cover_page","order":1,"presentationMode":"featured","config":{"showDate":true,"showPrimaryLogo":true,"showSecondaryLogo":false,"showPoweredBy":false,"poweredByText":"Powered by Talent Fit"}},
  {"id":"blk-si-02","type":"custom_text","order":2,"presentationMode":"open","config":{"heading":"About This Report","content":"This report summarises your assessment results. Use it as a guide for reflection and professional development."}},
  {"id":"blk-si-03","type":"score_overview","order":3,"presentationMode":"open","chartType":"bar","config":{"chartType":"radar","displayLevel":"factor","groupByDimension":true,"showDimensionScore":true}},
  {"id":"blk-si-04","type":"score_detail","order":4,"presentationMode":"open","chartType":"bar","config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":false,"showChildBreakdown":false}},
  {"id":"blk-si-05","type":"score_detail","order":5,"presentationMode":"open","chartType":"bar","config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":false,"showChildBreakdown":false}},
  {"id":"blk-si-06","type":"score_detail","order":6,"presentationMode":"open","chartType":"bar","config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":false,"showChildBreakdown":false}},
  {"id":"blk-si-07","type":"strengths_highlights","order":7,"presentationMode":"carded","columns":3,"config":{"topN":3,"displayLevel":"factor","style":"cards"}},
  {"id":"blk-si-08","type":"development_plan","order":8,"presentationMode":"carded","config":{"maxItems":3,"prioritiseByScore":true}}
]'::jsonb
WHERE id = 'a1b2c3d4-0001-0000-0000-000000000001';

-- Template 2: Hiring Manager Brief
UPDATE report_templates SET blocks = '[
  {"id":"blk-hm-01","type":"cover_page","order":1,"presentationMode":"featured","config":{"showDate":true,"showPrimaryLogo":true,"showSecondaryLogo":false,"showPoweredBy":false,"poweredByText":"Powered by Talent Fit"}},
  {"id":"blk-hm-02","type":"score_overview","order":2,"presentationMode":"open","chartType":"bar","config":{"chartType":"bars","displayLevel":"factor","groupByDimension":false,"showDimensionScore":false}},
  {"id":"blk-hm-03","type":"score_detail","order":3,"presentationMode":"carded","chartType":"segment","config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":false,"showIndicators":false,"showDevelopment":false,"showChildBreakdown":false}},
  {"id":"blk-hm-04","type":"score_detail","order":4,"presentationMode":"carded","chartType":"segment","config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":false,"showIndicators":false,"showDevelopment":false,"showChildBreakdown":false}},
  {"id":"blk-hm-05","type":"custom_text","order":5,"presentationMode":"inset","config":{"heading":"Confidentiality Notice","content":"This report is provided for assessment purposes only. Results should be interpreted by a qualified practitioner."}}
]'::jsonb
WHERE id = 'a1b2c3d4-0001-0000-0000-000000000002';

-- Template 3: 360 Debrief — Participant
UPDATE report_templates SET blocks = '[
  {"id":"blk-3p-01","type":"cover_page","order":1,"presentationMode":"featured","config":{"showDate":true,"showPrimaryLogo":true,"showSecondaryLogo":false,"showPoweredBy":false,"poweredByText":"Powered by Talent Fit"}},
  {"id":"blk-3p-02","type":"custom_text","order":2,"presentationMode":"inset","config":{"heading":"Confidentiality","content":"Ratings have been aggregated to protect rater anonymity. No individual rater can be identified."}},
  {"id":"blk-3p-03","type":"score_overview","order":3,"presentationMode":"featured","chartType":"radar","config":{"chartType":"radar","displayLevel":"factor","groupByDimension":true,"showDimensionScore":true}},
  {"id":"blk-3p-04","type":"rater_comparison","order":4,"presentationMode":"open","chartType":"grouped_bar","config":{"raterGroups":["self","manager","peers","direct_reports"]}},
  {"id":"blk-3p-05","type":"gap_analysis","order":5,"presentationMode":"open","chartType":"gap","config":{"gapThreshold":20,"showBlindSpots":true,"showHiddenStrengths":true}},
  {"id":"blk-3p-06","type":"score_detail","order":6,"presentationMode":"open","chartType":"bar","config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":false}},
  {"id":"blk-3p-07","type":"score_detail","order":7,"presentationMode":"open","chartType":"bar","config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":false}},
  {"id":"blk-3p-08","type":"development_plan","order":8,"presentationMode":"open","config":{"maxItems":3,"prioritiseByScore":true}}
]'::jsonb
WHERE id = 'a1b2c3d4-0001-0000-0000-000000000003';

-- Template 4: 360 Debrief — Consultant
UPDATE report_templates SET blocks = '[
  {"id":"blk-3c-01","type":"cover_page","order":1,"presentationMode":"featured","config":{"showDate":true,"showPrimaryLogo":true,"showSecondaryLogo":false,"showPoweredBy":false,"poweredByText":"Powered by Talent Fit"}},
  {"id":"blk-3c-02","type":"score_overview","order":2,"presentationMode":"split","chartType":"radar","config":{"chartType":"radar","displayLevel":"factor","groupByDimension":true,"showDimensionScore":true}},
  {"id":"blk-3c-03","type":"rater_comparison","order":3,"presentationMode":"split","chartType":"grouped_bar","config":{"raterGroups":["self","manager","peers","direct_reports"]}},
  {"id":"blk-3c-04","type":"gap_analysis","order":4,"presentationMode":"inset","chartType":"gap","config":{"gapThreshold":20,"showBlindSpots":true,"showHiddenStrengths":true}},
  {"id":"blk-3c-05","type":"score_detail","order":5,"presentationMode":"open","chartType":"scorecard","config":{"displayLevel":"construct","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":true}},
  {"id":"blk-3c-06","type":"score_detail","order":6,"presentationMode":"open","chartType":"scorecard","config":{"displayLevel":"construct","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":true}},
  {"id":"blk-3c-07","type":"open_comments","order":7,"presentationMode":"open","config":{"minRatersForDisplay":3,"groupByFactor":true}},
  {"id":"blk-3c-08","type":"development_plan","order":8,"presentationMode":"carded","config":{"maxItems":5,"prioritiseByScore":true}}
]'::jsonb
WHERE id = 'a1b2c3d4-0001-0000-0000-000000000004';
