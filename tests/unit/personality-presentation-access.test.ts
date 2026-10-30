import { beforeEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({access:vi.fn(),from:vi.fn(),update:vi.fn(),eq:vi.fn(),single:vi.fn(),audit:vi.fn()}))
vi.mock('@/lib/auth/authorization',()=>({requireReportTemplateAccess:mocks.access}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({from:mocks.from})}))
vi.mock('@/lib/auth/support-sessions',()=>({logAuditEvent:mocks.audit}))
import { savePersonalityReportPresentation } from '@/lib/dal/personality-presentation'
beforeEach(()=>{
 vi.clearAllMocks();mocks.access.mockResolvedValue({scope:{actor:{id:'actor'}}})
 const chain={update:mocks.update,eq:mocks.eq,select:()=>chain,single:mocks.single}
 mocks.from.mockReturnValue(chain);mocks.update.mockReturnValue(chain);mocks.eq.mockReturnValue(chain)
 mocks.single.mockResolvedValue({data:{updated_at:'2026-10-30T01:00:00Z'},error:null})
})
it('requires template write access before opening a privileged database query',async()=>{
 mocks.access.mockRejectedValue(new Error('Unauthorized'))
 await expect(savePersonalityReportPresentation('template','Name',{},'old')).rejects.toThrow('Unauthorized')
 expect(mocks.from).not.toHaveBeenCalled()
})
it('restricts writes to the requested standard template and its expected revision',async()=>{
 await expect(savePersonalityReportPresentation('template','Updated',{version:1,scales:{O:{definition:'Changed copy'}}},'old')).resolves.toEqual({updatedAt:'2026-10-30T01:00:00Z'})
 expect(mocks.access).toHaveBeenCalledWith('template',{forWrite:true})
 expect(mocks.eq.mock.calls).toEqual([['id','template'],['custom_report_slug','trajectas-personality-standard-v1'],['updated_at','old']])
 expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({name:'Updated',presentation_config:{version:1,scales:{O:{definition:'Changed copy'}}}}))
 expect(mocks.audit).toHaveBeenCalledOnce()
})
it('rejects stale writes and does not report them as successful edits',async()=>{
 mocks.single.mockResolvedValue({data:null,error:{message:'No matching revision'}})
 await expect(savePersonalityReportPresentation('template','Name',{},'old')).rejects.toThrow('Refresh')
 expect(mocks.audit).not.toHaveBeenCalled()
})
it('does not accept measurement-direction or scoring fields as editable presentation',async()=>{
 await expect(savePersonalityReportPresentation('template','Name',{scales:{N4:{direction:'original'}}},'old')).rejects.toThrow()
 expect(mocks.from).not.toHaveBeenCalled()
})
