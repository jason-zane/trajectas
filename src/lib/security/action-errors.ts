export function logActionError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}

export function throwActionError(
  context: string,
  publicMessage: string,
  error: unknown
): never {
  logActionError(context, error);
  throw new Error(publicMessage);
}
