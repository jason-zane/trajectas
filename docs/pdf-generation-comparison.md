# PDF Generation Solutions for Next.js + Vercel

## Executive Summary

**Recommendation: Use @sparticuz/chromium-min with S3-hosted binaries (with Browserless as fallback)**

This approach delivers:
- **Perfect CSS fidelity** (full Chromium rendering engine)
- **Production reliability** on Vercel (proven path with environment variable setup)
- **Cold start optimization** (binary caching + async S3 download at runtime)
- **Minimal complexity** (drop-in replacement for existing puppeteer setup)
- **No additional costs** (except S3 storage ~$1-2/month for small binary)

---

## Detailed Comparison Matrix

| Dimension | @sparticuz/chromium-min | Browserless.io | Playwright | PDFShift/DocRaptor | Railway Microservice |
|-----------|------------------------|----------------|-----------|-------------------|----------------------|
| **CSS Fidelity** | ★★★★★ Perfect | ★★★★★ Perfect | ★★★★★ Perfect | ★★★★ Very Good | ★★★★★ Perfect |
| **Vercel Compatible** | ✓ (with setup) | ✓ (API call) | ✗ (binary size) | ✓ (API call) | ✗ (external service) |
| **Cold Start (ms)** | 2000-3500 | 500-1000 | 800-1200 | 100-200 | 1500-2500 |
| **Monthly Cost** | $1-3 (S3 only) | $0-29 (free tier included) | N/A (free) | $49-99/month | $5-15/month base |
| **Setup Complexity** | Medium | Low | High | Very Low | High |
| **Production Maturity** | ★★★★ Proven | ★★★★ Proven | ★★★ Viable | ★★★★★ Battle-tested | ★★★ Viable |
| **Maintenance Burden** | Low | None | Low | None | Medium |

---

## Option 1: @sparticuz/chromium-min with S3 Binary Hosting

### What It Is
Lightweight version of @sparticuz/chromium (~140MB uncompressed vs 300MB+) that downloads the binary at runtime instead of bundling it. Binary is hosted on S3 and downloaded on first execution.

### How It Works
1. Deploy without bundled binary (stays under 50MB limit)
2. On first request, function downloads binary from S3 (~5-10s)
3. Binary cached in `/tmp` for subsequent invocations (same container)
4. Puppeteer connects to local Chromium instance

### Strengths
- **Perfect CSS fidelity** — uses real Chromium renderer
- **No per-request charges** — one-time S3 download cost
- **Minimal code changes** — drop-in replacement for existing puppeteer setup
- **Vercel cold start friendly** — binary download happens at runtime, not build time
- **Caching benefit** — warm containers reuse cached binary (very fast subsequent calls)

### Weaknesses
- **First invocation slow** — 2-3.5 seconds to download and boot Chromium
- **S3 setup required** — need to upload binary and configure credentials
- **Environment variable timing critical** — `CHROMIUM_PATH` must be set before Puppeteer initializes
- **Concurrent requests** — multiple simultaneous requests may download binary multiple times

### Setup Steps
```typescript
// 1. Environment variables on Vercel
// CHROMIUM_MIN_SKIP_DOWNLOAD=true
// AWS_S3_BUCKET=your-bucket
// AWS_ACCESS_KEY_ID=your-key
// AWS_SECRET_ACCESS_KEY=your-secret

// 2. Download binary locally and upload to S3
// https://github.com/Sparticuz/chromium-min/releases

// 3. Code structure
import chromium from '@sparticuz/chromium-min';

export default async function handler(req, res) {
  let browser;
  try {
    // Set binary path BEFORE launching
    process.env.CHROMIUM_PATH = await downloadBinaryFromS3();

    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto(reportUrl, { waitUntil: 'networkidle2' });
    const pdf = await page.pdf({ format: 'A4' });
    res.contentType('application/pdf');
    res.send(pdf);
  } finally {
    if (browser) await browser.close();
  }
}
```

### Pricing
- S3 storage: ~$0.023/GB/month (binary is ~140MB = ~$0.003/month)
- S3 requests: ~$0.0004 per 1,000 GET requests
- **Practical total: $1-3/month** for typical usage

### Cold Start Performance
- First request: 2000-3500ms (download + boot)
- Subsequent requests in same container: 800-1200ms
- Most Vercel containers stay warm for 5-15 minutes

---

## Option 2: Browserless.io (WebSocket Browser API)

### What It Is
Cloud-hosted headless browsers accessible via WebSocket. Your code sends rendering instructions to Browserless's servers instead of managing Chromium locally.

### How It Works
1. Client connects to Browserless WebSocket endpoint
2. Send page navigation and PDF generation commands
3. Browserless renders and returns PDF
4. Connection closes

### Strengths
- **Fastest cold start** — 500-1000ms (API call vs binary download)
- **Zero binary management** — no deployment complexity
- **Free tier generous** — 1,000 units/month free (enough for ~200 PDF renders)
- **Reliable** — battle-tested service with SLA
- **Easy debugging** — browser sessions available for inspection
- **Browserless Premium features** — session recording, rate limiting control

### Weaknesses
- **Per-request latency** — network round trip adds 200-500ms vs local rendering
- **Cost at scale** — $0.50 per 1,000 units; typical PDF render = 5-10 units
  - Free tier covers ~200 PDFs/month
  - $29/month tier covers ~5,000 PDFs/month
- **Dependency on external service** — network/service failures affect availability
- **Less control** — can't customize browser behavior beyond Browserless API
- **No CSS print media support** — limited CSS @media print capabilities (Browserless limitation)

### Setup Steps
```typescript
import { connect } from 'puppeteer-core';

export default async function handler(req, res) {
  const browser = await connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`,
  });

  try {
    const page = await browser.newPage();
    await page.goto(reportUrl, { waitUntil: 'networkidle2' });
    const pdf = await page.pdf({ format: 'A4' });
    res.contentType('application/pdf');
    res.send(pdf);
  } finally {
    await browser.close();
  }
}
```

### Pricing
- **Free tier**: 1,000 units/month (1 unit ≈ 0.5-1 PDF render)
- **$29/month**: 5,000 units/month
- **$99/month**: 20,000 units/month
- **Pay-as-you-go**: $0.50 per 1,000 units beyond plan

### Cold Start Performance
- Per-request latency: 500-1000ms (network + processing)
- No warmup needed — service always ready

### Recommendation Level
**Tier 2 (Fallback).** Best as backup when S3 binary approach fails or for non-mission-critical PDFs. Excellent free tier makes it good for experimentation.

---

## Option 3: Playwright (Browser Automation)

### What It Is
Modern browser automation framework by Microsoft. Similar to Puppeteer but with better API and more active development. Requires bundling Chromium binary.

### How It Works
Same as Puppeteer: Chromium binary bundled or referenced, Playwright controls browser instance.

### Strengths
- **Modern API** — cleaner than Puppeteer, better error messages
- **Cross-browser** — supports Chromium, Firefox, WebKit
- **Better CSS support** — improved @media print handling
- **Active development** — more frequent updates than Puppeteer

### Weaknesses
- **Binary size issue** — Chromium binary (~300MB) exceeds Vercel 50MB limit
- **No serverless distribution** — no equivalent to @sparticuz/chromium available yet
- **Requires workarounds** — would need same S3 approach as Puppeteer
- **Overkill for single browser** — cross-browser support adds complexity

### Verdict
**Not recommended for this use case.** Requires same S3 binary management as @sparticuz/chromium-min but without existing serverless tooling support. Stick with Puppeteer ecosystem.

---

## Option 4: PDFShift / DocRaptor (HTML-to-PDF APIs)

### What It Is
Third-party APIs that accept HTML/CSS and return rendered PDF. No browser management needed.

### How It Works
1. Send HTML content + CSS to API endpoint
2. API renders using headless browser
3. Return finished PDF

### Strengths
- **Simplest implementation** — just HTTP POST with HTML
- **Fastest per-request latency** — 100-200ms (optimized servers)
- **Battle-tested CSS fidelity** — support for advanced page-break rules
- **No dependency management** — no binaries to download/cache
- **Excellent for PDFs with complex layouts** — DocRaptor handles edge cases well

### Weaknesses
- **Per-request cost** — $0.001-0.005 per page typically
  - At 100 PDFs/day = $3-15/month
  - At 1,000 PDFs/day = $30-150/month
- **External dependency** — service downtime = feature unavailable
- **Less control over rendering** — can't customize browser flags or timing
- **Data transmission** — large HTML documents require POST body transmission
- **Privacy** — HTML sent to third-party servers (consider compliance)

### Setup Steps
```typescript
import axios from 'axios';

export default async function handler(req, res) {
  const response = await axios.post('https://api.pdfshift.io/v3/convert/html', {
    source: reportHtml, // Full HTML/CSS content
    sandbox: true,
  }, {
    auth: {
      username: process.env.PDFSHIFT_API_KEY,
      password: '',
    },
  });

  res.contentType('application/pdf');
  res.send(response.data);
}
```

### Pricing
- **PDFShift**: Starts at $49/month for 500 conversions
- **DocRaptor**: $0.001/page on pay-as-you-go (minimum ~$10/month setup)
- **Gotenberg**: Self-hosted alternative (~free, but requires server management)

### Recommendation Level
**Tier 3 (High-volume alternative).** Only choose this if:
1. You anticipate 500+ PDFs/month (economies of scale)
2. Concerned about Vercel cold starts (not an issue with Browserless)
3. Complex layouts that require DocRaptor's rendering engine

---

## Option 5: Railway/Render/Fly.io Microservice

### What It Is
Run a dedicated PDF generation service on Railway, Render, or Fly.io. Your Vercel function calls this service via HTTP.

### How It Works
1. Containerized app (with Chromium bundled) deployed on Railway/Render/Fly
2. Vercel function POSTs to microservice with report URL
3. Microservice renders PDF and returns binary
4. Scale microservice independently of Vercel

### Strengths
- **Unlimited PDF generation** — no Vercel function size/timeout constraints
- **Heavy customization** — full control over Chromium flags, fonts, plugins
- **Scalability** — spin up multiple instances for high volume
- **Cost-effective at high volume** — $5-15/month Railway vs $49+ API pricing

### Weaknesses
- **Architectural complexity** — maintains separate service + deployment pipeline
- **Cold start overhead** — microservice starts before first request
- **Deployment management** — another service to monitor/maintain
- **Network latency** — HTTP call adds 200-500ms vs local rendering
- **Reliability dependency** — microservice downtime = feature unavailable
- **Monitoring burden** — track logs, errors, resource usage separately

### Setup Steps
```typescript
// Vercel function
export default async function handler(req, res) {
  const response = await fetch(process.env.PDF_SERVICE_URL, {
    method: 'POST',
    body: JSON.stringify({ url: reportUrl }),
  });
  const pdf = await response.arrayBuffer();
  res.contentType('application/pdf');
  res.send(pdf);
}

// Railway/Render service (Node.js + Puppeteer)
app.post('/generate-pdf', async (req, res) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(req.body.url, { waitUntil: 'networkidle2' });
  const pdf = await page.pdf({ format: 'A4' });
  res.contentType('application/pdf');
  res.send(pdf);
});
```

### Pricing
- **Railway**: $5/month base + $0.30/hour compute
  - Realistic total: $15-25/month for consistent usage
- **Render**: $7/month for basic instance + $0.10/hour usage
- **Fly.io**: $0.15/hour for 1GB RAM instance + $0.03/hour storage

### Recommendation Level
**Tier 4 (Enterprise/high-volume only).** Adds architectural complexity that's not justified unless you hit limits of other options.

---

## CSS Pagination Support Comparison

All recommended options support CSS page-break properties:

| Property | Support | Notes |
|----------|---------|-------|
| `page-break-before: always` | ✓ All | Force page break before element |
| `page-break-after: always` | ✓ All | Force page break after element |
| `break-inside: avoid` | ✓ All | Keep element on same page |
| `@page` margin rules | ✓ All | Set page margins |
| `@media print` | ✓ All | Print-specific styles |
| CSS Grid/Flexbox on print | ✓ Chromium/Playwright | ✓ PDFShift/DocRaptor |

---

## Implementation Roadmap

### Phase 1: Fix Current Setup (Week 1)
Replace existing broken setup with @sparticuz/chromium-min + S3:
1. Upload Chromium binary to S3
2. Add environment variables to Vercel
3. Update code to handle binary download
4. Test with existing report endpoint
5. **Estimated time**: 2-4 hours

### Phase 2: Add Fallback (Week 2)
If S3 approach fails:
1. Integrate Browserless.io as automatic fallback
2. Detect S3 failure and switch to Browserless
3. Log fallback events for monitoring
4. **Cost impact**: ~$0 if using free tier

### Phase 3: Monitor & Optimize (Ongoing)
1. Track cold start times
2. Monitor S3 download success rate
3. Watch for Browserless free tier overages
4. Consider migration to Browserless-only if load justifies $29/month

---

## Quick Decision Tree

```
Do you want perfect CSS fidelity?
├─ Yes → Continue
└─ No → Use Browserless (fastest, simplest)

Can you wait 2-3 seconds on first request?
├─ Yes → @sparticuz/chromium-min + S3 (Recommended)
├─ No → Browserless.io (500ms cold start)
└─ No → PDFShift if rendering >500 PDFs/month

Do you anticipate <200 PDFs/month?
├─ Yes → Browserless (free tier covers it)
└─ No → @sparticuz/chromium-min (no per-request cost)
```

---

## Recommended Implementation: @sparticuz/chromium-min + S3

### Prerequisites
- AWS S3 bucket
- IAM credentials with S3 GetObject permission

### Step 1: Upload Binary to S3

```bash
# Download Chromium binary
# From: https://github.com/Sparticuz/chromium-min/releases
# Get the latest "chromium-min" release (not just chromium)

aws s3 cp chromium-min s3://your-bucket/chromium-min --region us-east-1
```

### Step 2: Vercel Environment Variables

```
CHROMIUM_MIN_SKIP_DOWNLOAD=true
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1
```

### Step 3: Create Binary Download Utility

```typescript
// lib/chromium-binary.ts
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function downloadChromium(): Promise<string> {
  const tmpPath = resolve('/tmp/chromium-min');

  // Check if already cached
  try {
    require('fs').accessSync(tmpPath);
    return tmpPath;
  } catch {}

  // Download from S3
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: 'chromium-min',
  });

  const response = await s3.send(command);
  const buffer = await response.Body?.transformToByteArray();

  await writeFile(tmpPath, buffer!);
  await require('fs').promises.chmod(tmpPath, 0o755);

  return tmpPath;
}
```

### Step 4: Update PDF Generation Route

```typescript
// pages/api/reports/[id]/pdf.ts
import chromium from '@sparticuz/chromium-min';
import { downloadChromium } from '@/lib/chromium-binary';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  let browser;
  try {
    // Download binary BEFORE puppeteer initialization
    const chromiumPath = await downloadChromium();

    const reportUrl = `${process.env.NEXTAUTH_URL}/reports/${req.query.id}?format=print`;

    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: chromiumPath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto(reportUrl, { waitUntil: 'networkidle2' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
    res.send(pdf);
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).json({ error: 'PDF generation failed' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
```

### Step 5: Add Browserless Fallback (Optional)

```typescript
// lib/pdf-generator.ts
import chromium from '@sparticuz/chromium-min';
import { downloadChromium } from './chromium-binary';
import { connect } from 'puppeteer-core';

async function generatePdfLocal(url: string): Promise<Buffer> {
  const chromiumPath = await downloadChromium();
  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: chromiumPath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    return await page.pdf({ format: 'A4' });
  } finally {
    await browser.close();
  }
}

async function generatePdfBrowserless(url: string): Promise<Buffer> {
  const browser = await connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`,
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    return await page.pdf({ format: 'A4' });
  } finally {
    await browser.close();
  }
}

export async function generatePdf(url: string): Promise<Buffer> {
  try {
    return await generatePdfLocal(url);
  } catch (error) {
    console.warn('Local PDF generation failed, falling back to Browserless:', error);
    if (process.env.BROWSERLESS_TOKEN) {
      return await generatePdfBrowserless(url);
    }
    throw error;
  }
}
```

---

## Testing Checklist

- [ ] S3 binary downloads correctly on first invocation
- [ ] PDF renders with correct CSS (margins, page breaks, fonts)
- [ ] Cold start time < 4 seconds
- [ ] Warm container reuses cached binary
- [ ] Error handling gracefully degrades
- [ ] Browserless fallback activates on S3 failure (if configured)
- [ ] Load test with 10+ concurrent requests
- [ ] Verify S3 costs (~$1-3/month)

---

## Migration Path from Current Setup

If currently using old @sparticuz/chromium setup:

1. **Keep existing endpoint** — no breaking changes needed
2. **Update Puppeteer config** — swap binary path to S3-downloaded version
3. **Add fallback** — optional Browserless integration
4. **Test thoroughly** — verify PDF quality matches
5. **Monitor** — track cold starts and S3 costs
6. **Deprecate slowly** — don't rush migration if current setup partially works

---

## References

- [@sparticuz/chromium-min GitHub](https://github.com/Sparticuz/chromium-min)
- [Browserless Documentation](https://www.browserless.io/docs)
- [Puppeteer PDF API](https://pptr.dev/api/puppeteer.page.pdf)
- [CSS Page Breaking Spec](https://developer.mozilla.org/en-US/docs/Web/CSS/page-break-after)
- [Vercel Function Size Limits](https://vercel.com/docs/functions/runtimes#max-bundle-size)
