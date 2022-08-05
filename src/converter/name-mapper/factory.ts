import { assertNever } from "src/common/util";
import {
  CamelInputMapper,
  PascalInputMapper,
  CamelOutputMapper,
  SnakeInputMapper,
  SnakeOutputMapper,
  PascalOutputMapper,
  KebabInputMapper,
  KebabOutputMapper,
} from "./mappers";
import {
  CasedString,
  CasingConvention,
  NameInputMapper,
  NameOutputMapper,
  NameMapperFunction,
} from "./types";

function getInputMapper<T extends CasingConvention>(
  source: T
): NameInputMapper<T> {
  switch (source) {
    case CasingConvention.SnakeCase:
      return SnakeInputMapper as NameInputMapper<T>;
    case CasingConvention.PascalCase:
      return PascalInputMapper as NameInputMapper<T>;
    case CasingConvention.CamelCase:
      return CamelInputMapper as NameInputMapper<T>;
    case CasingConvention.KebabCase:
      return KebabInputMapper as NameInputMapper<T>;
    default:
      assertNever(source);
  }
  throw new Error(`Could not find mapping for source: ${source}`);
}

function getOutputMapper<T extends CasingConvention>(
  target: T
): NameOutputMapper<T> {
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

export function getNameMapper<
  TSource extends CasingConvention,
  TTarget extends CasingConvention
>(source: TSource, target: TTarget): NameMapperFunction<TSource, TTarget> {
  const toWords = getInputMapper(source);
  const fromWords = getOutputMapper(target);
  return (str: CasedString<TSource>): CasedString<TTarget> => {
    const words = toWords(str);
    const newName = fromWords(words);
    return newName;
  };
}
