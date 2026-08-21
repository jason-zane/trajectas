/**
 * model-parser.ts — Deterministic parser for text-pasted measurement models.
 *
 * Turns user-pasted constructs (from JSON, YAML, markdown, delimited lists, etc.)
 * into a canonical ProposedConstruct[] without any AI or network call.
 * If the text doesn't match a recognized shape, returns format 'none' with a helpful warning.
 *
 * @module
 */

import type { ProposedConstruct } from './structure'

/**
 * The result of parseModelText: constructs, detected format, warnings, and unparsed lines.
 */
export interface ParsedModel {
  constructs: ProposedConstruct[]
  format: 'json' | 'yaml' | 'markdown-list' | 'delimited' | 'none'
  warnings: string[]
  unparsedLines: string[]
}

/**
 * Normalize exclusions to always be an array.
 * Accepts string or string[]; if string, splits on newline/semicolon/comma.
 */
function normalizeExclusions(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0)
  }
  if (typeof input === 'string' || typeof input === 'number') {
    const str = String(input)
    return str
      .split(/[\n;,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
  return []
}

/**
 * Attempt to parse as JSON: both { constructs: [...] } and bare array.
 * Accepts flexible key names for name, definition, and exclusions.
 */
function tryParseJson(raw: string): ParsedModel | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    const warnings: string[] = []
    const unparsedLines: string[] = []

    let items: Record<string, unknown>[] = []

    if (Array.isArray(parsed)) {
      items = parsed as Record<string, unknown>[]
    } else if (parsed && typeof parsed === 'object' && 'constructs' in parsed) {
      const constructs = parsed.constructs
      if (Array.isArray(constructs)) {
        items = constructs as Record<string, unknown>[]
      }
    } else {
      return null
    }

    const constructs = items
      .map((item) => {
        if (typeof item !== 'object' || !item) {
          return null
        }
        const obj = item as Record<string, unknown>

        const name =
          String(obj.name || obj.construct || obj.title || '').trim() || ''
        const definition =
          String(obj.definition || obj.description || obj.def || '').trim() || ''
        const exclusionsRaw = obj.exclusions || obj.excludes || obj.not

        if (!name) {
          return null
        }

        return {
          name,
          definition,
          exclusions: normalizeExclusions(exclusionsRaw),
        }
      })
      .filter((c) => c !== null) as ProposedConstruct[]

    if (constructs.length === 0) {
      return null
    }

    return {
      constructs,
      format: 'json',
      warnings,
      unparsedLines,
    }
  } catch {
    return null
  }
}

/**
 * Simple YAML-ish parser for indented block lists.
 * Handles 2 or 4-space indentation and '>' or '|' block scalars.
 * Does NOT pull in a YAML library.
 * Strict: only matches if next line has recognized YAML keys (name:, definition:, exclusions:, etc.)
 */
function tryParseYaml(raw: string): ParsedModel | null {
  const lines = raw.split('\n')

  // Quick check: scan for typical YAML patterns
  // Must have at least one line starting with "- name:" or indented "definition:" or "exclusions:"
  let hasYamlPatterns = false
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i]
    if (line.match(/^\s*-\s+name:/)) {
      hasYamlPatterns = true
      break
    }
    // Look for indented definition: or exclusions: keys
    if (line.match(/^\s{2,}(definition|description|def|exclusions|excludes|not):/)) {
      hasYamlPatterns = true
      break
    }
  }

  if (!hasYamlPatterns) {
    return null
  }

  const constructs: ProposedConstruct[] = []
  const warnings: string[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Look for a list marker at any indentation. Requiring column 0 rejected the
    // most conventional YAML shape of all — a list nested under a `constructs:`
    // key — which then fell through to the Markdown parser and produced a
    // construct literally named "name".
    const withoutIndent = line.trimStart()
    if (!withoutIndent.startsWith('-')) {
      i++
      continue
    }

    const afterDash = withoutIndent.replace(/^-\s*/, '')
    if (!afterDash) {
      i++
      continue
    }

    // Determine base indentation for nested keys
    const baseIndentMatch = line.match(/^( *)/)
    const baseIndent = baseIndentMatch?.[1]?.length || 0

    let nameOnly = ''
    let definition = ''
    let exclusions: string[] = []

    // First line after dash: could be "name: value" or "description: value" or just "name"
    if (afterDash.includes(':')) {
      const [key, value] = afterDash.split(':', 2)
      const trimmedKey = key.trim()
      const trimmedValue = value?.trim() || ''

      // Check if key is a known YAML key for name, definition, or exclusions
      if (trimmedKey === 'name' || trimmedKey === 'construct' || trimmedKey === 'title') {
        nameOnly = trimmedValue
      } else if (trimmedKey === 'definition' || trimmedKey === 'description' || trimmedKey === 'def') {
        definition = trimmedValue
      } else {
        // Unknown key pattern, treat as simple "key: value" in markdown/delimited
        nameOnly = afterDash.trim()
      }
    } else {
      nameOnly = afterDash.trim()
    }

    if (!nameOnly) {
      i++
      continue
    }

    // Parse subsequent indented lines for keys
    i++
    while (i < lines.length) {
      const nextLine = lines[i]

      // Empty line: skip
      if (nextLine.trim() === '') {
        i++
        continue
      }

      // Not indented: back to top-level, stop parsing this construct
      const nextIndentMatch = nextLine.match(/^( *)/)
      const nextIndent = nextIndentMatch?.[1]?.length || 0
      if (nextIndent <= baseIndent) {
        break
      }

      const nextContent = nextLine.trim()

      // Look for "definition:", "description:", or "def:" key
      if (nextContent.startsWith('definition:') || nextContent.startsWith('description:') || nextContent.startsWith('def:')) {
        const defValue = nextContent.split(':', 2)[1]?.trim() || ''

        // Check for block scalar >, |
        if (defValue === '>' || defValue === '|') {
          definition = ''
          i++
          while (i < lines.length) {
            const blockLine = lines[i]
            const blockIndentMatch = blockLine.match(/^( *)/)
            const blockIndent = blockIndentMatch?.[1]?.length || 0

            if (blockLine.trim() === '') {
              i++
              continue
            }
            // Block content must be indented deeper than the key that introduced
            // it. Comparing against the list item's indent instead let a sibling
            // key ("exclusions:") fall inside the block, so the definition
            // swallowed the exclusions and the exclusions array came back empty.
            if (blockIndent <= nextIndent) {
              break
            }

            definition += blockLine.trim() + ' '
            i++
          }
          definition = definition.trim().replace(/\s+/g, ' ')
          i-- // back up one since the outer loop will increment
        } else {
          definition = defValue
          i++
        }
      }
      // Look for "exclusions:", "excludes:", "not:" key
      else if (
        nextContent.startsWith('exclusions:') ||
        nextContent.startsWith('excludes:') ||
        nextContent.startsWith('not:')
      ) {
        const excValue = nextContent.split(':', 2)[1]?.trim() || ''

        if (excValue.startsWith('[') && excValue.endsWith(']')) {
          // Inline array: [item1, item2]
          exclusions = normalizeExclusions(excValue.slice(1, -1).split(','))
          i++
        } else if (excValue) {
          // Single item on same line
          exclusions = [excValue]
          i++
        } else {
          // Items on subsequent lines with dash
          i++
          while (i < lines.length) {
            const excLine = lines[i]
            const excIndentMatch = excLine.match(/^( *)/)
            const excIndent = excIndentMatch?.[1]?.length || 0

            if (excLine.trim() === '') {
              i++
              continue
            }
            if (excIndent <= baseIndent) {
              break
            }

            const excContent = excLine.trim()
            if (excContent.startsWith('-')) {
              const excItem = excContent.replace(/^-\s*/, '').trim()
              if (excItem) {
                exclusions.push(excItem)
              }
              i++
            } else {
              break
            }
          }
        }
      } else {
        i++
      }
    }

    constructs.push({
      name: nameOnly,
      definition: definition.trim().replace(/\s+/g, ' '),
      exclusions,
    })
  }

  if (constructs.length === 0) {
    return null
  }

  return {
    constructs,
    format: 'yaml',
    warnings,
    unparsedLines: [],
  }
}

/**
 * Parse markdown-style lists: numbered, bulleted, or header-based.
 * Strips markdown emphasis (* ** _ __ ~ etc.) from names.
 */
function tryParseMarkdown(raw: string): ParsedModel | null {
  const lines = raw.split('\n')
  const constructs: ProposedConstruct[] = []
  const warnings: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Numbered list: "1. Construct Name" or "1. Construct Name — definition"
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      let content = numberedMatch[2]
      let definition = ''

      // Check for separator: " — " or " - " or ": "
      if (content.includes(' — ')) {
        const [name, def] = content.split(' — ', 2)
        content = name
        definition = def || ''
      } else if (content.includes(': ')) {
        const [name, def] = content.split(': ', 2)
        content = name
        definition = def || ''
      }

      // Strip markdown emphasis from name
      const name = stripMarkdown(content.trim())
      if (name) {
        constructs.push({
          name,
          definition: definition.trim(),
          exclusions: [],
        })
      }
      continue
    }

    // Bullet point: "- Construct Name" or "* Construct Name"
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      let content = bulletMatch[1]
      let definition = ''

      if (content.includes(' — ')) {
        const [name, def] = content.split(' — ', 2)
        content = name
        definition = def || ''
      } else if (content.includes(': ')) {
        const [name, def] = content.split(': ', 2)
        content = name
        definition = def || ''
      }

      const name = stripMarkdown(content.trim())
      if (name) {
        constructs.push({
          name,
          definition: definition.trim(),
          exclusions: [],
        })
      }
      continue
    }

    // Markdown header: "## Construct Name"
    const headerMatch = trimmed.match(/^#+\s+(.+)$/)
    if (headerMatch) {
      const name = stripMarkdown(headerMatch[1].trim())
      if (name) {
        // Collect following paragraph as definition
        let definition = ''
        let j = i + 1
        while (j < lines.length) {
          const nextLine = lines[j]
          const nextTrimmed = nextLine.trim()
          if (nextTrimmed === '') {
            // Allow blank lines but stop after the paragraph
            if (definition) {
              break
            }
            j++
            continue
          }
          if (nextTrimmed.startsWith('#')) {
            break
          }
          // Stop if we hit another list marker
          if (nextTrimmed.match(/^[-*\d+]\s/)) {
            break
          }
          definition += nextTrimmed + ' '
          j++
        }
        constructs.push({
          name,
          definition: definition.trim().replace(/\s+/g, ' '),
          exclusions: [],
        })
        i = j - 1
      }
      continue
    }
  }

  if (constructs.length === 0) {
    return null
  }

  return {
    constructs,
    format: 'markdown-list',
    warnings,
    unparsedLines: [],
  }
}

/**
 * Strip markdown emphasis characters from a string.
 * Removes **, __, *, _, `, and ~~ but preserves the text inside
 * (except strikethrough ~~text~~ which removes the text entirely).
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/~~.+?~~/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Parse delimited formats: "Name: definition", "Name — definition", "Name | definition",
 * CSV (with quoted fields), TSV (tab-separated).
 */
function tryParseDelimited(raw: string): ParsedModel | null {
  const lines = raw.split('\n').filter((l) => l.trim())
  if (lines.length === 0) {
    return null
  }

  const constructs: ProposedConstruct[] = []
  const warnings: string[] = []

  // Detect format from first line
  const firstLine = lines[0]

  // Tabs are unambiguous — no prose uses them as a separator.
  if (firstLine.includes('\t')) {
    return tryParseDelimitedTsv(lines, warnings)
  }

  // A real CSV export announces itself with a header row. Requiring that is what
  // keeps a comma inside a definition from hijacking the parse: almost every
  // definition contains one ("Adjusts approach when conditions change, without
  // losing sight of the objective"), and routing on the bare presence of a comma
  // meant the whole line became the construct name and the definition was lost.
  const looksLikeCsvHeader = /^\s*"?(name|construct|title)"?\s*,/i.test(firstLine)
  if (looksLikeCsvHeader) {
    return tryParseDelimitedCsv(lines, warnings)
  }

  // Check for colon, em-dash, or pipe separator
  const hasColon = lines.some((l) => l.includes(':'))
  const hasEmDash = lines.some((l) => l.includes(' — '))
  const hasPipe = lines.some((l) => l.includes('|'))

  if (hasColon || hasEmDash || hasPipe) {
    for (const line of lines) {
      let name = ''
      let definition = ''

      if (hasEmDash && line.includes(' — ')) {
        const [n, d] = line.split(' — ', 2)
        name = n.trim()
        definition = d?.trim() || ''
      } else if (hasColon && line.includes(':')) {
        const [n, d] = line.split(':', 2)
        name = n.trim()
        definition = d?.trim() || ''
      } else if (hasPipe && line.includes('|')) {
        const [n, d] = line.split('|', 2)
        name = n.trim()
        definition = d?.trim() || ''
      } else {
        continue
      }

      if (name) {
        constructs.push({
          name,
          definition,
          exclusions: [],
        })
      }
    }

    if (constructs.length > 0) {
      return {
        constructs,
        format: 'delimited',
        warnings,
        unparsedLines: [],
      }
    }
  }

  // Headerless CSV is the last resort, once no explicit separator has claimed it.
  if (firstLine.includes(',')) {
    return tryParseDelimitedCsv(lines, warnings)
  }

  return null
}

/**
 * Parse CSV with proper quote handling.
 */
function tryParseDelimitedCsv(lines: string[], warnings: string[]): ParsedModel | null {
  const constructs: ProposedConstruct[] = []

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const fields = parseCsvLine(line)
    if (fields.length >= 1) {
      const name = fields[0]?.trim() || ''
      const definition = fields[1]?.trim() || ''
      const exclusionsStr = fields[2]?.trim() || ''

      // Skip if name looks like a header (e.g., "name", "Name", "construct", etc.)
      if (idx === 0 && (name.toLowerCase() === 'name' || name.toLowerCase() === 'construct' || name.toLowerCase() === 'title')) {
        continue
      }

      if (name && name.toLowerCase() !== 'name') {
        constructs.push({
          name,
          definition,
          exclusions: normalizeExclusions(exclusionsStr),
        })
      }
    }
  }

  if (constructs.length === 0) {
    return null
  }

  return {
    constructs,
    format: 'delimited',
    warnings,
    unparsedLines: [],
  }
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuote = !inQuote
      }
    } else if (char === ',' && !inQuote) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current)
  return fields
}

/**
 * Parse TSV (tab-separated) format.
 */
function tryParseDelimitedTsv(lines: string[], warnings: string[]): ParsedModel | null {
  const constructs: ProposedConstruct[] = []

  for (const line of lines) {
    const fields = line.split('\t')
    if (fields.length >= 1) {
      const name = fields[0]?.trim() || ''
      const definition = fields[1]?.trim() || ''
      const exclusionsStr = fields[2]?.trim() || ''

      if (name) {
        constructs.push({
          name,
          definition,
          exclusions: normalizeExclusions(exclusionsStr),
        })
      }
    }
  }

  if (constructs.length === 0) {
    return null
  }

  return {
    constructs,
    format: 'delimited',
    warnings,
    unparsedLines: [],
  }
}

/**
 * Main parser: attempts formats in precedence order.
 * Deduplicates by case-insensitive trimmed name.
 * Caps at 40 constructs; warns and truncates beyond that.
 * Trims and collapses internal whitespace in definitions.
 */
export function parseModelText(raw: string): ParsedModel {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      constructs: [],
      format: 'none',
      warnings: ['Input is empty. Please provide constructs in one of these formats: JSON, YAML-like, Markdown, or delimited (colon/dash/pipe/CSV/TSV).'],
      unparsedLines: [],
    }
  }

  // Try in precedence order
  let result: ParsedModel | null = tryParseJson(trimmed)
  if (!result) {
    result = tryParseYaml(trimmed)
  }
  if (!result) {
    result = tryParseMarkdown(trimmed)
  }
  if (!result) {
    result = tryParseDelimited(trimmed)
  }

  if (!result) {
    return {
      constructs: [],
      format: 'none',
      warnings: [
        'Input format not recognized. Accepted formats: JSON, YAML, Markdown, Delimited (colon/dash/pipe/CSV/TSV)',
        '  JSON: {"constructs": [{"name": "...", "definition": "...", "exclusions": [...]}]} or bare array',
        '  YAML: - name: ... definition: ... exclusions: [...]',
        '  Markdown: 1. Name or ## Header or - Name or ** Name ** followed by paragraph',
        '  Delimited: Name: definition or Name — definition or Name | definition or CSV/TSV with name,definition,exclusions',
      ],
      unparsedLines: trimmed.split('\n'),
    }
  }

  // Post-process: deduplicate, trim, collapse whitespace, cap at 40
  const seen = new Set<string>()
  const deduped: ProposedConstruct[] = []
  const warnings = [...result.warnings]

  for (const construct of result.constructs) {
    const key = construct.name.toLowerCase().trim()
    if (seen.has(key)) {
      warnings.push(`Duplicate construct name (case-insensitive) "${construct.name}" — kept first occurrence only.`)
      continue
    }
    seen.add(key)

    // Trim and collapse whitespace in definition
    const definition = construct.definition
      .trim()
      .replace(/\s+/g, ' ')

    deduped.push({
      name: construct.name.trim(),
      definition,
      exclusions: construct.exclusions.map((e) => e.trim()),
    })
  }

  if (deduped.length > 40) {
    warnings.push(`Found ${deduped.length} constructs; capping at 40.`)
    deduped.splice(40)
  }

  // Warn about constructs with no definition
  for (const construct of deduped) {
    if (!construct.definition) {
      warnings.push(`Construct "${construct.name}" has no definition. You can fill it in manually or ask AI to generate it.`)
    }
  }

  return {
    constructs: deduped,
    format: result.format,
    warnings,
    unparsedLines: result.unparsedLines,
  }
}
