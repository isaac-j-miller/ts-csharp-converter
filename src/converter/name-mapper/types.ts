export enum CasingConvention {
  PascalCase,
  SnakeCase,
  CamelCase,
}

export interface CasedString<T extends CasingConvention> extends String {
  _casing: T;
}

export type PropertyNameMapper<
  TSource extends CasingConvention,
  TTarget extends CasingConvention
> = (source: CasedString<TSource>) => CasedString<TTarget>;
