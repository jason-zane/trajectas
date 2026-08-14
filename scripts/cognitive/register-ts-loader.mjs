// Usage: node --import ./scripts/cognitive/register-ts-loader.mjs scripts/cognitive/generate-matrix-bank.ts [args...]
import { register } from 'node:module'
register('./ts-loader.mjs', import.meta.url)
