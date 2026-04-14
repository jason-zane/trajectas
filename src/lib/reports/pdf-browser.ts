import { existsSync } from 'node:fs'

import type { Browser, LaunchOptions } from 'puppeteer-core'

const LOCAL_EXECUTABLE_ENV_VARS = [
  'PUPPETEER_EXECUTABLE_PATH',
  'CHROME_EXECUTABLE_PATH',
  'GOOGLE_CHROME_BIN',
] as const

const COMMON_EXECUTABLE_PATHS: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/opt/google/chrome/chrome',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
}

const CHROMIUM_MIN_VERSION = '143.0.0'

function findLocalExecutablePath() {
  for (const envVar of LOCAL_EXECUTABLE_ENV_VARS) {
    const configuredPath = process.env[envVar]
    if (configuredPath && existsSync(configuredPath)) {
      return configuredPath
    }
  }

  const candidates = COMMON_EXECUTABLE_PATHS[process.platform] ?? []
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

async function getLaunchOptions(): Promise<LaunchOptions> {
  const localExecutablePath = findLocalExecutablePath()
  if (localExecutablePath) {
    return {
      executablePath: localExecutablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
  }

  const chromium = (await import('@sparticuz/chromium-min')).default
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const packUrl =
    process.env.CHROMIUM_MIN_PACK_URL ??
    `https://github.com/Sparticuz/chromium/releases/download/v${CHROMIUM_MIN_VERSION}/chromium-v${CHROMIUM_MIN_VERSION}-pack.${arch}.tar`

  return {
    executablePath: await chromium.executablePath(packUrl),
    headless: 'shell',
    args: chromium.args,
  }
}

export async function launchReportPdfBrowser(): Promise<Browser> {
  const puppeteer = (await import('puppeteer-core')).default
  return puppeteer.launch(await getLaunchOptions())
}
