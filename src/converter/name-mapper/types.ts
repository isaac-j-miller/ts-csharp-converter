export enum CasingConvention {
  PascalCase,
  SnakeCase,
  CamelCase,
  KebabCase,
}
export const casingConventions = Object.values(CasingConvention).filter(
  k => typeof k === "string"
) as string[];

export type ParsedWord = {
  base: string;
  typeArguments?: ParsedWord[][];
  arrayPart?: string;
};

export interface CasedString<T extends CasingConvention> extends String {
  _casing: T;
}
export type NameInputMapper<T extends CasingConvention> = (source: CasedString<T>) => ParsedWord[];

export type NameOutputMapper<T extends CasingConvention> = (
  source: ParsedWord[],
  nameType: NameType
) => CasedString<T>;

export type NameMapperFunction<TTarget extends CasingConvention = CasingConvention> = (
  source: string,
  nameType: NameType
) => CasedString<TTarget>;

export enum NameType {
  DeclarationName,
  PropertyName,
  EnumMember,
}

export type NameTypeConfig = {
  output: CasingConvention;
};

type NameConfigMap = {
  [K in NameType]: NameTypeConfig;
};

export type NameMapperConfig = {
  transforms: NameConfigMap;
};

export interface INameMapper {
  transform(name: string, nameType: NameType): string;
}
