import { assertNever } from "src/common/util";
import {
  CamelOutputMapper,
  SnakeOutputMapper,
  PascalOutputMapper,
  KebabOutputMapper,
  normalize,
  parseNormalized,
} from "./mappers";
import { CasedString, CasingConvention, NameOutputMapper, NameMapperFunction } from "./types";

export function getOutputMapper<T extends CasingConvention>(target: T): NameOutputMapper<T> {
  switch (target) {
    case CasingConvention.SnakeCase:
      return SnakeOutputMapper as NameOutputMapper<T>;
    case CasingConvention.PascalCase:
      return PascalOutputMapper as NameOutputMapper<T>;
    case CasingConvention.CamelCase:
      return CamelOutputMapper as NameOutputMapper<T>;
    case CasingConvention.KebabCase:
      return KebabOutputMapper as NameOutputMapper<T>;
    default:
      assertNever(target);
  }
  throw new Error(`Could not find mapping for target: ${target}`);
}

export function getNameMapper<TTarget extends CasingConvention>(
  target: TTarget
): NameMapperFunction<TTarget> {
  const fromWords = getOutputMapper(target);
  return (str: string): CasedString<TTarget> => {
    const normalized = normalize(str);
    const parsed = parseNormalized(normalized);
    const newName = fromWords(parsed);
    return newName;
  };
}
