export enum CasingConvention {
  PascalCase,
  SnakeCase,
  CamelCase,
  KebabCase,
}
export const casingConventions = Object.values(CasingConvention).filter(
  (k) => typeof k === "string"
) as string[];

export type ParsedWord = {
  base: string;
  typeArguments?: ParsedWord[][];
  arrayPart?: string;
};

export interface CasedString<T extends CasingConvention> extends String {
  _casing: T;
}
export type NameInputMapper<T extends CasingConvention> = (
  source: CasedString<T>
) => ParsedWord[];

export type NameOutputMapper<T extends CasingConvention> = (
  source: ParsedWord[]
) => CasedString<T>;

export type NameMapperFunction<
  TSource extends CasingConvention = CasingConvention,
  TTarget extends CasingConvention = CasingConvention
> = (source: CasedString<TSource>) => CasedString<TTarget>;

export enum NameType {
  DeclarationName,
  PropertyName,
  EnumMember,
}

export type NameTypeConfig = {
  input: CasingConvention;
  output: CasingConvention;
};

type NameConfigMap = {
  [K in NameType]: NameTypeConfig;
};

export type NameMapperConfig = {
  transforms: NameConfigMap;
};
