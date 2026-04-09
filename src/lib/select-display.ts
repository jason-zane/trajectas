export interface SelectLabelOption<T extends string = string> {
  value: T;
  label: string;
}

export function getSelectLabel<T extends string>(
  value: T | null | undefined,
  options: ReadonlyArray<SelectLabelOption<T>>,
  placeholder = ""
): string {
  if (!value) {
    return placeholder;
  }

  return options.find((option) => option.value === value)?.label ?? value;
}
