'use client'
import {createContext,useContext,type ReactNode} from 'react'
import Link from 'next/link'
const PublishedPrivacy=createContext(false)
export function PublishedPrivacyProvider({available,children}:{available:boolean;children:ReactNode}) {
  return <PublishedPrivacy.Provider value={available}>{children}</PublishedPrivacy.Provider>
}
export function PublicPrivacyLink(){return useContext(PublishedPrivacy)?<Link href="/privacy">Privacy</Link>:null}
