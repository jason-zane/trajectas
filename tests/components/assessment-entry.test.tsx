// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PAGE_CONTENT } from '@/lib/experience/defaults'
import { WelcomeScreen } from '@/components/assess/welcome-screen'
import { ConsentScreen } from '@/components/assess/consent-screen'
const { saveConsent } = vi.hoisted(() => ({ saveConsent: vi.fn() }))
vi.mock('@/app/actions/experience', () => ({ saveConsent }))
const token='a'.repeat(64), nextUrl=`/assess/${token}/consent`
const props = {
  token, campaignTitle:'Campaign', assessmentCount:1, hasInProgressSession:false, allowResume:true,
  content:DEFAULT_PAGE_CONTENT.welcome,nextUrl,assessments:[],sessions:[],totalItems:20,
  campaign:{title:'Campaign',confidentialityMode:'individual'},
} as unknown as ComponentProps<typeof WelcomeScreen>

describe('assessment entry navigation',()=>{
  it('server-rendered Begin has a real destination without hydration',()=>{
    const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<WelcomeScreen {...props}/>);
    const link=host.querySelector(`a[href="${nextUrl}"]`)
    expect(link?.textContent).toBe('Begin Assessment');expect(host.querySelector('button')).toBeNull()
  })
  it('resume and unfinished assessment rows all follow the resolved flow; completed rows do not navigate',()=>{
    const assessments=[{assessmentId:'one',title:'One'},{assessmentId:'two',title:'Two'},{assessmentId:'three',title:'Three'}] as ComponentProps<typeof WelcomeScreen>['assessments']
    const sessions=[{assessmentId:'one',status:'completed'},{assessmentId:'two',status:'in_progress'}] as ComponentProps<typeof WelcomeScreen>['sessions']
    render(<WelcomeScreen {...props} hasInProgressSession assessments={assessments} sessions={sessions}/>);
    expect(screen.getByText('DONE')).toBeVisible()
    for(const name of ['Resume','Begin','Resume Assessment'])expect(screen.getByRole('link',{name})).toHaveAttribute('href',nextUrl)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('consent save acknowledgement',()=>{
  beforeEach(()=>{saveConsent.mockReset()})
  const show=()=>render(<ConsentScreen token={token} participantId="participant" content={DEFAULT_PAGE_CONTENT.consent} nextUrl="/assessment-next"/>);
  const agree=()=>fireEvent.click(screen.getByRole('checkbox'))
  it.each(['returned','thrown'])('stays on the page and allows retry after a %s failure',async kind=>{
    if(kind==='returned')saveConsent.mockResolvedValue({error:'private database detail'});else saveConsent.mockRejectedValue(new Error('private database detail'))
    show();expect(screen.getByRole('button',{name:'Continue'})).toBeDisabled();agree();fireEvent.click(screen.getByRole('button',{name:'Continue'}));
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t save your consent. Please try again.'))
    expect(screen.queryByText('private database detail')).toBeNull();expect(screen.getByRole('button',{name:'Continue'})).toBeEnabled()
    fireEvent.click(screen.getByRole('button',{name:'Continue'}));await waitFor(()=>expect(saveConsent).toHaveBeenCalledTimes(2))
    expect(saveConsent).toHaveBeenCalledWith(token,'participant')
  })
  it('keeps experience preview interactive without attempting persistence',async()=>{
    render(<ConsentScreen token="preview" participantId="preview" isPreview content={DEFAULT_PAGE_CONTENT.consent} nextUrl="#"/>);
    agree();fireEvent.click(screen.getByRole('button',{name:'Continue'}));
    expect(saveConsent).not.toHaveBeenCalled();expect(screen.queryByRole('alert')).toBeNull()
  })
  it('admits only one pending consent save',async()=>{
    let resolve!:(r:{error?:string})=>void;saveConsent.mockImplementation(()=>new Promise(r=>{resolve=r}))
    show();agree();const button=screen.getByRole('button',{name:'Continue'});fireEvent.click(button);fireEvent.click(button)
    expect(saveConsent).toHaveBeenCalledTimes(1);expect(button).toBeDisabled();await act(async()=>resolve({error:'failure'}));expect(button).toBeEnabled()
  })
})
