import type { ChildScore } from './types';

export function rollupChildren(children: ChildScore[]): number | null {
  if (children.length === 0) {
    return null;
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const child of children) {
    if (child.score === null) {
      return null;
    }

    if (child.weight <= 0) {
      continue;
    }

    weightedSum += child.score * child.weight;
    totalWeight += child.weight;
  }

  if (totalWeight <= 0) {
    return null;
  }

  return Math.round(weightedSum / totalWeight);
}
