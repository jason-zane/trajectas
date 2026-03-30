export const DISCRIMINATION_SYSTEM_PROMPT = `You are an expert psychometrician. Your task is to assess whether two psychological constructs are sufficiently distinct to support independent self-report item development.`

export function buildDiscriminationPrompt(
  constructA: { name: string; definition: string },
  constructB: { name: string; definition: string },
): string {
  return `Assess whether these two constructs can produce clearly discriminating self-report items.

## Construct A: ${constructA.name}
Definition: ${constructA.definition}

## Construct B: ${constructB.name}
Definition: ${constructB.definition}

Generate 3 example items that would ONLY belong to Construct A and not B, and 3 that would ONLY belong to Construct B and not A.
If you cannot produce clearly discriminating items, explain why.

Respond in JSON:
{
  "canDiscriminate": true | false,
  "itemsForA": ["item1", "item2", "item3"],
  "itemsForB": ["item1", "item2", "item3"],
  "explanation": "brief explanation"
}`
}
