import { assertNever } from "src/common/util";
import {
  CamelToSnake,
  PascalToSnake,
  SnakeToCamel,
  SnakeToPascal,
} from "./mappers";
import { CasedString, CasingConvention, PropertyNameMapper } from "./types";

function getToSnakeCase<T extends CasingConvention>(
  source: T
): PropertyNameMapper<T, CasingConvention.SnakeCase> {
  switch (source) {
    case CasingConvention.SnakeCase:
      return (str: CasedString<T>) =>
        str as CasedString<CasingConvention.SnakeCase>;
    case CasingConvention.PascalCase:
      return PascalToSnake as PropertyNameMapper<T, CasingConvention.SnakeCase>;
    case CasingConvention.CamelCase:
      return CamelToSnake as PropertyNameMapper<T, CasingConvention.SnakeCase>;
    default:
      assertNever(source);
  }
  throw new Error(`Could not find mapping for source: ${source}`);
}

function getFromSnakeCase<T extends CasingConvention>(
  target: T
): PropertyNameMapper<CasingConvention.SnakeCase, T> {
  switch (target) {
    case CasingConvention.SnakeCase:
      return (str: CasedString<CasingConvention.SnakeCase>) =>
        str as CasedString<T>;
    case CasingConvention.PascalCase:
      return SnakeToPascal as PropertyNameMapper<CasingConvention.SnakeCase, T>;
    case CasingConvention.CamelCase:
      return SnakeToCamel as PropertyNameMapper<CasingConvention.SnakeCase, T>;
    default:
      assertNever(target);
  }
  throw new Error(`Could not find mapping for target: ${target}`);
}

export function getNameMapper<
  TSource extends CasingConvention,
  TTarget extends CasingConvention
>(source: TSource, target: TTarget): PropertyNameMapper<TSource, TTarget> {
  const toSnake = getToSnakeCase(source);
  const fromSnake = getFromSnakeCase(target);
  return (str: CasedString<TSource>): CasedString<TTarget> => {
    return fromSnake(toSnake(str));
  };
}
