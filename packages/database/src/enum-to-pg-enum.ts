type EnumSource = Record<string, string> | readonly string[];
type EnumValue<T extends EnumSource> = T extends readonly (infer Value extends string)[]
  ? Value
  : T extends Record<string, infer Value extends string>
    ? Value
    : never;

export function enumToPgEnum<const T extends EnumSource>(values: T) {
  return Object.values(values) as [EnumValue<T>, ...EnumValue<T>[]];
}
