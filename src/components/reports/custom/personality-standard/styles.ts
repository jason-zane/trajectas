// Scoped styles preserved from the approved v13 report design.
export const PERSONALITY_REPORT_CSS = `

.tpp-report *{box-sizing:border-box} .tpp-report{--emerald:#2d6a5a;--gold:#816226;--blue:#476b8b;--ink:#1a1a1a;--muted:#5b655f;--line:#d2dad4;--paper:#fff}
.tpp-report h1,.tpp-report h2,.tpp-report h3,.tpp-report p,.tpp-report dl,.tpp-report dd{margin:0}.tpp-report strong{font-weight:700}.tpp-report .report-shell{width:2462px}.tpp-report .report-grid{display:grid;grid-template-columns:repeat(3,794px);gap:40px}
.tpp-report .report-page{position:relative;isolation:isolate;width:794px;height:1123px;padding:36px 56px 30px;background:#fff;display:flex;flex-direction:column;overflow:hidden}
.tpp-report .report-page>*{flex-shrink:0}.tpp-report .page-header{height:34px;min-height:34px;display:flex;justify-content:flex-end;align-items:center}.tpp-report .brand,.tpp-report .brand svg{width:150px;height:32px;display:block;flex:none}
.tpp-report .page-footer{margin-top:auto;height:28px;min-height:28px;padding-top:10px;border-top:1px solid #bccac0;display:flex;justify-content:space-between;position:relative;font-size:8px;line-height:12px;color:var(--muted);letter-spacing:.2px}
.tpp-report .page-footer>span:nth-child(2){position:absolute;left:50%;transform:translateX(-50%)}.tpp-report .page-number{font-size:10px;color:var(--ink);font-weight:750}{font-style:normal;color:var(--muted);font-size:8px;font-weight:500}

{font-size:10.5px;line-height:15px;font-weight:700;white-space:nowrap;color:var(--range-colour);letter-spacing:-.1px}
.tpp-report .axis{display:flex;justify-content:space-between;font-size:8px;line-height:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.tpp-report .track{height:24px;position:relative;flex:none}.tpp-report .reference-band{position:absolute;left:30%;width:40%;top:4px;height:16px;background:#dce8de}.tpp-report .rail{position:absolute;left:0;right:0;top:11.5px;height:1px;background:#bcc9bf}
.tpp-report .dot{position:absolute;top:5px;width:14px;height:14px;border-radius:50%;background:var(--range-colour);box-shadow:0 0 0 1.5px var(--halo,#fff);z-index:1}
.tpp-report .compact{height:20px}.tpp-report .compact .reference-band{top:3px;height:14px}.tpp-report .compact .rail{top:9.5px}.tpp-report .compact .dot{width:11px;height:11px;top:4.5px}
{display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-size:9px;line-height:14px;white-space:nowrap}{width:18px;height:9px;background:#dce8de;border:1px solid #cad7cc}
{display:flex;align-items:center;justify-content:space-between;gap:24px}{font-size:11px;line-height:16px;color:var(--muted)}
.tpp-report .cover{padding-top:44px;background:var(--emerald);color:#fff}{position:absolute;top:264px;left:180px;width:760px;height:760px;opacity:.17;z-index:-1}{width:760px;height:760px}
.tpp-report .cover-body{margin-top:153px}.tpp-report .cover-body h1{font-size:76px;line-height:1.09;letter-spacing:-3.2px;font-weight:800}.tpp-report .cover-body h1>span{font-weight:400;letter-spacing:-3.5px}
.tpp-report .cover-person{position:absolute;left:0;right:0;bottom:0;height:281px;padding:35px 56px 40px;background:#fff;color:var(--ink);display:grid;grid-template-columns:1fr 262px;column-gap:30px;align-content:start;row-gap:32px}
{grid-column:1 / -1;font-size:10px;line-height:15px;letter-spacing:1.35px;color:var(--emerald);font-weight:700}.tpp-report .eyebrow{font-size:9px;line-height:14px;letter-spacing:1px;color:var(--muted);font-weight:600}
.tpp-report .cover-person h2{font-size:38px;line-height:49px;letter-spacing:-1px;font-weight:750;margin-top:10px}.tpp-report .cover-date{text-align:right}.tpp-report .cover-date h3{font-size:16px;line-height:24px;font-weight:600;margin-top:21px}
.tpp-report .overview-heading{margin-top:28px}.tpp-report .overview-heading h1{font-size:44px;line-height:1.08;letter-spacing:-1.6px;font-weight:750}{margin-top:18px}
.tpp-report .overview-key,.tpp-report .dimension-row{display:grid;grid-template-columns:84px 236px 310px;column-gap:26px;align-items:center}
.tpp-report .overview-key{font-size:8.8px;line-height:12px;color:var(--muted);font-weight:600;margin:25px 0 10px}
.tpp-report .dimension-row{height:148px;border-top:1px solid var(--line)}.tpp-report .dimension-row:last-child{border-bottom:1px solid var(--line)}
.tpp-report .dimension-result{display:flex;flex-direction:column;gap:6px;align-items:flex-start;font-variant-numeric:tabular-nums}.tpp-report .dimension-result>strong{font-size:52px;line-height:1.04;letter-spacing:-1.8px;font-weight:750}
.tpp-report .dimension-copy h2{font-size:19px;line-height:25px;font-weight:750;letter-spacing:-.45px;color:var(--emerald)}
.tpp-report .dimension-copy p{margin-top:9px;max-width:226px;font-size:11.7px;line-height:18px;color:var(--muted)}
.tpp-report .dimension-chart .anchors{display:flex;justify-content:space-between;gap:16px;margin-top:8px;font-size:10px;line-height:15px;color:var(--muted)}
.tpp-report .anchors>span{max-width:50%}.tpp-report .anchors>span:last-child{text-align:right}
.tpp-report .profile-title{display:flex;justify-content:space-between;align-items:center;gap:24px;height:37px}.tpp-report .profile-title h1{font-size:32px;line-height:37px;font-weight:750;letter-spacing:-.9px}
{margin-top:16px}.tpp-report .profile-row{display:grid;grid-template-columns:152px 105px 194px 108px 33px 60px;gap:6px;align-items:center}
.tpp-report .profile-key{height:15px;margin-top:16px;margin-bottom:9px;color:var(--muted);font-size:8.7px;line-height:13px;font-weight:600}.tpp-report .profile-key .score-key{grid-column:5 / 7;text-align:right}
.tpp-report .profile-key .lower-end,.tpp-report .profile-key .higher-end{font-size:9px}.tpp-report .profile-group{margin:0 -10px;padding:4px 10px 6px;border-bottom:1px solid #cbd7ce}
.tpp-report .profile-group:nth-child(odd){background:#f1f7f3;--halo:#f1f7f3}.tpp-report .dimension-profile-row{height:28px}.tpp-report .trait-profile-row{height:23.5px}
.tpp-report .profile-row .name{font-size:11.4px;line-height:16px;white-space:nowrap;letter-spacing:-.14px}.tpp-report .dimension-profile-row .name{font-size:13.4px;line-height:20px;font-weight:750}
.tpp-report .profile-group:nth-child(odd) .dimension-profile-row .name{color:var(--emerald)}
.tpp-report .profile-row .lower-end,.tpp-report .profile-row .higher-end{font-size:10.2px;line-height:14px;color:var(--muted);white-space:nowrap;letter-spacing:-.1px}.tpp-report .lower-end{text-align:right;padding-right:3px}.tpp-report .higher-end{padding-left:3px}
.tpp-report .profile-row .score{text-align:right;font-size:12px;line-height:18px;font-weight:750;font-variant-numeric:tabular-nums}.tpp-report .dimension-profile-row .score{font-size:15px}{font-size:10px;line-height:14px;text-align:right}
.tpp-report .profile-row .compact{height:23.5px}.tpp-report .dimension-profile-row .compact{height:28px}.tpp-report .profile-row .compact .reference-band{top:0;height:100%}.tpp-report .profile-row .compact .rail{top:50%}.tpp-report .profile-row .compact .dot{top:calc(50% - 5.5px)}
.tpp-report .detail-heading{margin-top:20px}.tpp-report .detail-hero{display:grid;grid-template-columns:546px 112px;gap:24px;align-items:start}
.tpp-report .detail-hero h1{font-size:40px;line-height:47px;font-weight:750;letter-spacing:-1.25px}.tpp-report .detail-hero>div>p{font-size:12px;line-height:18px;margin-top:12px;color:var(--muted);max-width:495px}
.tpp-report .detail-result{display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums}.tpp-report .detail-result>strong{font-size:64px;line-height:70px;letter-spacing:-2px;font-weight:750}
{font-size:9px;line-height:12px;color:var(--muted);margin-top:2px}{font-size:11px;line-height:16px;margin-top:4px}{font-size:9px;line-height:12px;color:var(--muted);margin-top:4px}
.tpp-report .dimension-scale{margin-top:14px}.tpp-report .domain-poles{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:10px;margin-bottom:16px}
.tpp-report .domain-poles h2{font-size:9px;line-height:13px;font-weight:700;color:var(--muted)}.tpp-report .domain-poles p{font-size:10.8px;line-height:15px;margin-top:5px;color:var(--muted)}
.tpp-report .trait-key{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;font-size:8.8px;line-height:14px;color:var(--muted)}.tpp-report .trait-key h2{font-size:11px;line-height:14px;font-weight:750;color:var(--ink)}
{display:grid;grid-template-columns:1fr 1fr;column-gap:28px;row-gap:12px}
{position:relative;height:224px;border-top:1px solid #afc2b4;padding:14px 0 28px}
{display:grid;grid-template-columns:1fr 58px;gap:10px;align-items:start;min-height:37px}
{font-size:16px;line-height:22px;letter-spacing:-.38px;font-weight:750}
{display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums}{font-size:23px;line-height:25px;letter-spacing:-.6px;font-weight:750}{font-size:9px;line-height:12px}
{font-size:11.4px;line-height:16px;color:var(--muted);margin-top:5px;min-height:32px}
{margin-top:8px}
{display:flex;flex-direction:column;gap:4px;margin-top:8px}{display:grid;grid-template-columns:37px 1fr;gap:5px;font-size:10.4px;line-height:15px;color:var(--muted)}{font-size:9px;line-height:15px;color:var(--ink);font-weight:700}
{position:absolute;left:0;bottom:10px;font-size:8px;line-height:12px;color:#6b746e}{font-weight:600;color:var(--muted);margin-left:4px}
.tpp-report .info-heading{margin-top:28px}.tpp-report .info-heading h1{font-size:44px;line-height:1.08;letter-spacing:-1.4px;font-weight:750}
.tpp-report .information-grid{display:grid;grid-template-columns:432px 222px;gap:28px;margin-top:34px}
.tpp-report .reading-guide section+section{margin-top:28px}.tpp-report .reading-guide h2{font-size:18px;line-height:25px;font-weight:750;letter-spacing:-.4px}.tpp-report .reading-guide p{font-size:11.5px;line-height:18px;color:var(--muted);margin-top:10px}
.tpp-report .example-chart{margin-top:21px}.tpp-report .example-labels{position:relative;display:flex;justify-content:space-between;font-size:8px;line-height:13px;color:var(--muted);margin-top:4px}.tpp-report .example-labels strong{position:absolute;left:calc(75% - 7px);color:var(--ink);font-size:10px}
{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:24px;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
{display:flex;flex-direction:column;gap:7px}{display:flex;align-items:center;gap:7px;font-size:10px;line-height:15px;color:var(--range-colour)}{font-size:10px;line-height:15px;color:var(--muted)}
{width:8px;height:8px;background:var(--range-colour);border-radius:50%;flex:none}
{font-size:10px;line-height:16px;margin-top:12px}
.tpp-report .assessment-details{background:var(--emerald);color:#fff;padding:25px 22px;align-self:start}
.tpp-report .assessment-details dl>div+div{margin-top:25px}.tpp-report .assessment-details dt{font-size:8px;line-height:12px;color:#cfdfd6;letter-spacing:.5px;margin-bottom:7px}.tpp-report .assessment-details dd{font-size:13px;line-height:20px;font-weight:600}
.tpp-report .assessment-details section{border-top:1px solid #7fa293;margin-top:30px;padding-top:20px}.tpp-report .assessment-details h2{font-size:12px;line-height:18px;font-weight:700}.tpp-report .assessment-details p{font-size:10px;line-height:16px;color:#e7efeb;margin-top:9px}
.tpp-report .reference{margin-top:30px;max-width:620px}.tpp-report .reference h2{font-size:10px;line-height:16px;font-weight:700}.tpp-report .reference p{font-size:8.5px;line-height:13px;color:var(--muted);margin-top:7px}.tpp-report .reference p>span{margin:0 7px}.tpp-report .reference .design-credit{font-size:8px;margin-top:14px}
@page{size:A4;margin:0}@media print{.tpp-report .report-shell,.tpp-report .report-grid{width:auto;display:block}.tpp-report .report-page{width:210mm;height:297mm;break-after:page;page-break-after:always;print-color-adjust:exact;-webkit-print-color-adjust:exact}.tpp-report .report-page:last-child{break-after:auto;page-break-after:auto}}

{display:block;margin-top:10px;font-size:12px;line-height:18px;letter-spacing:0;color:var(--muted);font-weight:500}
.tpp-report .cover-person{row-gap:22px}
.tpp-report .trait-stack{display:flex;flex-direction:column}
.tpp-report .trait-strip{height:114px;flex:none;border-top:1px solid #afc2b4;padding:10px 0 8px}
.tpp-report .strip-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:21px}
.tpp-report .strip-heading h2{font-size:15px;line-height:21px;letter-spacing:-.25px;font-weight:750}
.tpp-report .strip-result{display:flex;align-items:baseline;justify-content:flex-end;gap:12px;min-width:98px;font-variant-numeric:tabular-nums}
.tpp-report .strip-result strong{font-size:19px;line-height:23px;letter-spacing:-.4px;color:var(--ink);font-weight:750}
{min-width:38px;text-align:right}
.tpp-report .strip-description{display:grid;grid-template-columns:1fr 98px;gap:20px;align-items:baseline;margin-top:3px}
.tpp-report .strip-description p{font-size:12px;line-height:18px;color:var(--muted)}
{font-size:8.8px;line-height:14px;color:var(--muted);text-align:right;white-space:nowrap}
{font-weight:600}
.tpp-report .trait-strip .track{height:18px;margin-top:7px}
.tpp-report .trait-strip .reference-band{top:2px;height:14px}
.tpp-report .trait-strip .rail{top:8.5px}
.tpp-report .trait-strip .dot{top:3.5px}
.tpp-report .strip-poles{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:4px}
.tpp-report .strip-poles p{display:grid;grid-template-columns:36px 1fr;gap:5px;font-size:10.9px;line-height:16px;color:var(--muted)}
{font-size:9.5px;line-height:16px;font-weight:700;color:var(--ink)}
{font-size:54px;line-height:58px}
{height:99px;padding-top:6px;padding-bottom:5px}
{margin-top:4px}
{margin-top:2px}
{margin-top:1px}
{display:grid;grid-template-columns:458px 196px;gap:28px;margin:14px 0 10px;align-items:start}
{font-size:14px;line-height:20px;font-weight:750;letter-spacing:-.2px;margin-bottom:7px;color:var(--emerald)}
{font-size:12px;line-height:18px;color:var(--ink)}
{display:block;margin:0}
{margin-top:12px}
{font-size:9px;line-height:13px}
{font-size:10.8px;line-height:15px;margin-top:3px}
{margin-top:26px}
{font-size:42px;line-height:47px}
{margin-top:24px}
{font-size:14px;line-height:20px;font-weight:750;color:var(--emerald);margin-bottom:9px}
{font-size:12.5px;line-height:20px;max-width:670px}
{margin-top:12px}
{font-size:18px;line-height:25px;letter-spacing:-.35px;font-weight:750;margin-top:27px}
{margin:14px 0 8px}
{height:108px}
{font-size:40px;line-height:45px}
{gap:3px}
{font-size:17px;line-height:23px;letter-spacing:-.35px}
{margin-top:5px}
{margin-top:21px}
{font-size:17px;line-height:23px}
{margin-top:8px}
{margin-top:28px}
{margin-top:18px}
{margin-top:24px}


.tpp-report .cover-body{margin-top:117px}
.tpp-report .cover-profile-title{font-size:24px;line-height:32px;letter-spacing:-.65px;font-weight:650;color:#f4f7ef;margin-bottom:27px}
.tpp-report .cover-art{position:absolute;top:440px;left:0;width:794px;height:402px;z-index:-1;overflow:hidden}
.tpp-report .cover-art svg{display:block;width:794px;height:402px}
.tpp-report .cover-format{grid-column:1 / -1;font-size:10px;line-height:15px;color:var(--emerald);font-weight:700;letter-spacing:.25px}
.tpp-report .cover-person{row-gap:32px}
.tpp-report .overview-key .axis{color:var(--muted)}
{margin-top:25px}
{height:118px}
{margin-top:26px}
.tpp-report .full-profile .trait-profile-row{height:24.5px}
.tpp-report .full-profile .profile-row .compact{height:24.5px}
.tpp-report .full-profile .dimension-profile-row .compact{height:28px}
.tpp-report .full-profile .trait-profile-row .name{font-size:11.7px}
.tpp-report .full-profile .profile-key .lower-end{color:var(--blue)}
.tpp-report .full-profile .profile-key .higher-end{color:var(--gold)}
.tpp-report .detail-hero{grid-template-columns:1fr 108px;gap:24px;align-items:center;min-height:116px;height:116px;padding:16px 20px;background:var(--emerald)}
.tpp-report .detail-hero h1{font-size:37px;line-height:45px;letter-spacing:-1.15px;color:#fff}
.tpp-report .detail-hero>div>p{font-size:12px;line-height:18px;margin-top:8px;color:#edf3ee;max-width:510px}
.tpp-report .detail-result{height:84px;padding:5px 10px;background:#fff;align-items:center;justify-content:center}
.tpp-report .detail-result>strong{font-size:50px;line-height:54px;letter-spacing:-1.5px}
{font-size:10.5px;line-height:16px;margin-top:4px}
.tpp-report .domain-poles h2{font-size:9.5px;color:var(--blue)}
.tpp-report .domain-poles>div:last-child h2{color:var(--gold)}
.tpp-report .trait-key h2{font-size:12px;line-height:16px;color:var(--emerald)}
.tpp-report .strip-heading h2{color:var(--emerald)}
.tpp-report .strip-description{display:block}
.tpp-report .strip-description p{max-width:670px}
{color:var(--blue)}
{color:var(--gold)}
{height:97px}
{grid-template-columns:458px 196px;gap:28px;margin:14px 0 10px}
{font-size:9.5px}
{color:var(--gold)}
{color:var(--emerald);font-size:14px}
.tpp-report .page-number{font-size:10px;letter-spacing:0}
.tpp-report .information .reading-guide section+section{margin-top:24px}
{margin-top:20px}
.tpp-report .information .reading-guide h2{color:var(--emerald)}
{margin-top:18px}
.tpp-report .information .reference{margin-top:24px}
{width:1628px;display:flex;gap:40px}
{width:794px}
{font-size:17px;line-height:24px;margin:0 0 15px;color:var(--emerald);font-weight:750}
@media print{{display:block;width:auto}}


.tpp-report .cover-profile-title{color:#e4cc90}
.tpp-report .cover-person{padding:0 56px;align-content:center;row-gap:28px}
.tpp-report .detail-hero{width:calc(100% + 112px);margin-left:-56px;margin-right:-56px;padding-left:56px;padding-right:56px}
.tpp-report .detail-result{background:transparent;padding:0;align-items:flex-end}
.tpp-report .detail-result>strong{color:#fff}





.tpp-report .report-page:not(.cover)>.page-header{justify-content:space-between}
.tpp-report .report-header-label{font-size:10.5px;line-height:16px;font-weight:700;letter-spacing:1.15px;color:var(--ink);opacity:.62;white-space:nowrap}
.tpp-report .brand{opacity:.62}
.tpp-report .cover-profile-title{font-size:20px;line-height:30px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase}
.tpp-report .page-footer{height:16px;min-height:16px;padding-top:0;border-top:0;align-items:flex-end}
.tpp-report .page-footer>span:nth-child(2){position:static;left:auto;transform:none}
.tpp-report .full-profile .profile-title{margin-top:16px}
.tpp-report .full-profile .profile-key{margin-top:12px}
.tpp-report .full-profile .trait-profile-row{height:23.5px}
.tpp-report .full-profile .profile-row .compact{height:23.5px}
.tpp-report .full-profile .dimension-profile-row .compact{height:28px}
.tpp-report .assessment-details .assessment-name{font-size:12px;line-height:20px;letter-spacing:.55px}


/* Continuous percentiles. Colour denotes chart role, never a score band. */
.tpp-report .track{--marker-colour:var(--emerald)}
.tpp-report .track[data-chart-role="dimension"]{--marker-colour:var(--gold)}
.tpp-report .track[data-chart-role="population-example"]{--marker-colour:var(--blue)}
.tpp-report .dot{background:var(--marker-colour)}
.tpp-report .dimension-result{gap:0}
.tpp-report .strip-result{min-width:34px;gap:0}
.tpp-report .profile-row{grid-template-columns:152px 116px 240px 116px 34px}
.tpp-report .profile-key .score-key{grid-column:5;text-align:right}
.tpp-report .profile-key .lower-end,.tpp-report .profile-key .higher-end{color:var(--muted)}
.tpp-report .strip-poles p{display:block}
.tpp-report .strip-poles p:last-child{text-align:right}
.tpp-report .domain-poles h2{font-size:9.5px;line-height:14px}
.tpp-report .example-labels{min-height:17px}
.tpp-report .population-reference{margin-top:20px;padding-top:15px;border-top:1px solid var(--line)}
.tpp-report .population-reference .population-note{margin-top:0;font-size:11.5px;line-height:18px}
.tpp-report .population-reference .reference-note{margin-top:10px;font-size:10px;line-height:16px}

.tpp-report{font-family:var(--font-sans),Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased}
.tpp-report .report-shell{width:794px}
.tpp-report .report-grid{display:flex;flex-direction:column;gap:24px}
.tpp-report .cover-person h2{overflow-wrap:anywhere}
@media print{.tpp-report .report-shell{width:auto}.tpp-report .report-grid{display:block;gap:0}}

.tpp-report{--motif-deep:#245748;--motif-mid:#47836b;--motif-soft:#9bb79e;--motif-gold:#c9a962}

/* Preserve report content against the app shell's global print hiding rules. */
@media print {
  .tpp-report .page-header, .tpp-report .strip-heading { display: flex !important; }
  .tpp-report .assessment-details { display: block !important; }
}
`
