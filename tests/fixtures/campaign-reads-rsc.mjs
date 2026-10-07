// Exercise the real action module and React request cache inside an actual RSC
// render. All I/O and authority are synthetic: no Next runtime, credentials or DB.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import * as React from 'react'
import { renderToReadableStream } from 'next/dist/compiled/react-server-dom-webpack/server.node.js'

const scenario = process.argv[2] || 'dashboard'
const sourcePath = process.argv[3] || 'src/app/actions/campaigns.ts'
const calls = { lists: 0, links: 0, linkRows: 0, access: 0, scopes: 0 }
const capturedScopes = []
let actor = 'actor-a'
let scope = { requestSurface: 'admin', activeContext: null, allowedCampaignIds: null }
const campaignRows = Array.from({ length: 60 }, (_, i) => ({
  id: `campaign-${i}`, status: ['draft', 'paused', 'active', 'closed'][i % 4],
  created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
}))
const linkRows = campaignRows.flatMap(c => [0, 1].map(i => ({
  id: `${c.id}-link-${i}`, campaign_id: c.id, is_active: true, created_at: c.created_at,
})))
class AuthorizationError extends Error {}
const mocks = {
  react: React,
  '@/lib/features/access': { requireWorkspaceFeature: async () => { if (scenario === 'feature-denied') throw new AuthorizationError('Feature disabled') } },
  '@/lib/auth/authorization': {
    AuthorizationError,
    resolveAuthorizedScope: async () => { calls.scopes++; return scope },
    getAccessibleCampaignIds: async () => scope.allowedCampaignIds,
    requireClientAccess: async () => {
      calls.access++
      if (scenario === 'denied') throw new AuthorizationError('Denied')
      return { scope }
    },
  },
  '@/lib/supabase/server': { createClient: async () => ({ actor }) },
  '@/lib/dal/campaigns': {
    listCampaigns: async (db, filter) => {
      calls.lists++
      capturedScopes.push(filter)
      await new Promise(r => setTimeout(r, 10))
      if (scenario === 'empty' || (filter.scopedCampaignIds && !filter.scopedCampaignIds.length)) return []
      return campaignRows.map(c => ({ ...c, actor: db.actor, clientId: filter.effectiveClientId }))
    },
  },
  '@/lib/supabase/admin': {
    createAdminClient: () => ({
      from: table => {
        if (table !== 'campaign_access_links') throw new Error(`Unexpected read: ${table}`)
        let selected = linkRows
        const filters = []
        const builder = {
          select: () => builder,
          eq: (key, value) => { filters.push([key, value]); return builder },
          is: (key, value) => { filters.push([key, value]); return builder },
          order: () => builder,
          in: (key, ids) => { selected = selected.filter(r => ids.includes(r[key])); return builder },
          then: async (onfulfilled, onrejected) => {
            calls.links++
            if (!filters.some(([k]) => k === 'campaigns.client_id') ||
                !filters.some(([k, v]) => k === 'campaigns.deleted_at' && v === null)) {
              throw new Error('Existing client/deletion predicates were lost')
            }
            calls.linkRows += selected.length
            await new Promise(r => setTimeout(r, 10))
            return Promise.resolve({ data: selected, error: null }).then(onfulfilled, onrejected)
          },
        }
        return builder
      },
    }),
  },
  '@/lib/supabase/mappers': {
    mapCampaignAccessLinkRow: r => ({ id: r.id, campaignId: r.campaign_id, isActive: r.is_active }),
  },
  '@/lib/campaign-access-links': { getPrimaryActiveAccessLink: rows => rows[0] },
}
const mod = { exports: {} }
const source = ts.transpileModule(readFileSync(resolve(sourcePath), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
vm.runInNewContext(source, {
  module: mod, exports: mod.exports, require: name => mocks[name] || {},
  console, Date, Promise, Buffer, setTimeout,
}, { filename: sourcePath })
const actions = mod.exports
const results = []

async function Root() {
  if (scenario === 'feature-denied') {
    try { await actions.getCampaigns({ clientId: 'client-a' }); results.push({ denied: false }) }
    catch(e) { results.push({ denied: e instanceof AuthorizationError }) }
  } else if (scenario === 'dashboard' || scenario === 'empty' || scenario === 'denied') {
    try {
      const [all, operational] = await Promise.all([
        ...(scenario === 'denied' ? [] : [actions.getCampaigns({ clientId: 'client-a' })]),
        actions.getOperationalCampaignsForClient('client-a', { limit: 6 }),
      ])
      results.push({ allCount: all.length, operational: operational.map(c => ({
        id: c.id, linkIds: c.accessLinks.map(l => l.id),
      })) })
    } catch (e) {
      if (scenario !== 'denied') throw e
      results.push({ denied: e instanceof AuthorizationError })
    }
  } else if (scenario === 'unlimited') {
    const operational = await actions.getOperationalCampaignsForClient('client-a')
    results.push({ count: operational.length, links: operational.reduce((n, c) => n + c.accessLinks.length, 0) })
  } else if (scenario === 'request-isolation') {
    const [a, b] = await Promise.all([
      actions.getCampaigns({ clientId: 'client-a' }), actions.getCampaigns({ clientId: 'client-a' }),
    ])
    results.push({ actors: [a[0].actor, b[0].actor] })
  } else if (scenario === 'context-isolation') {
    const [a, b] = await Promise.all([actions.getCampaigns(), actions.getCampaigns()])
    results.push({ clients: [a[0].clientId, b[0].clientId] })
  } else if (scenario === 'client-isolation') {
    const [a, b] = await Promise.all([
      actions.getCampaigns({ clientId: 'client-a' }), actions.getCampaigns({ clientId: 'client-b' }),
    ])
    results.push({ clients: [a[0].clientId, b[0].clientId] })
  } else if (scenario === 'empty-scope' || scenario === 'limited-scope') {
    scope = { requestSurface: 'admin', activeContext: { tenantId: 'client-a' },
      allowedCampaignIds: scenario === 'empty-scope' ? [] : ['campaign-58'] }
    const rows = await actions.getCampaigns()
    results.push({ count: rows.length })
  } else if (scenario === 'scope') {
    scope = { requestSurface: 'client', activeContext: { tenantId: 'client-b' }, allowedCampaignIds: [] }
    await actions.getCampaigns()
    scope = { requestSurface: 'admin', activeContext: null, allowedCampaignIds: [] }
    await actions.getCampaigns({ clientId: 'client-a' })
  }
  return 'synthetic render complete'
}

async function run() {
  if (scenario === 'context-isolation') {
    scope = { requestSurface: 'client', activeContext: { tenantId: 'client-a' },
      supportSession: { clientId: 'client-a' }, allowedCampaignIds: [] }
  }
  const start = performance.now()
  const stream = renderToReadableStream(React.createElement(Root), {}, { onError: error => { throw error } })
  await new Response(stream).text()
  if (scenario === 'request-isolation' || scenario === 'context-isolation') {
    if (scenario === 'request-isolation') actor = 'actor-b'
    else scope = { requestSurface: 'client', activeContext: { tenantId: 'client-b' },
      supportSession: { clientId: 'client-b' }, allowedCampaignIds: [] }
    const next = renderToReadableStream(React.createElement(Root), {})
    await new Response(next).text()
  }
  console.log(JSON.stringify({ calls, capturedScopes, results, elapsedMs: Math.round(performance.now() - start) }))
}
run().catch(error => { console.error(error); process.exitCode = 1 })
