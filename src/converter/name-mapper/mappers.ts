import { CasedString, CasingConvention, PropertyNameMapper } from "./types";
import { capitalize } from "./util";

export const SnakeToPascal: PropertyNameMapper<
  CasingConvention.SnakeCase,
  CasingConvention.PascalCase
> = (str) => {
  const words = str.toLocaleLowerCase().split("_");
  const capitalized = words.map(capitalize);
  return capitalized.join() as unknown as CasedString<CasingConvention.PascalCase>;
};

export const SnakeToCamel: PropertyNameMapper<
  CasingConvention.SnakeCase,
  CasingConvention.CamelCase
> = (str) => {
  const words = str.toLocaleLowerCase().split("_");
  const [firstWord, ...rest] = words;
  const capitalized = rest.map(capitalize);
  return [
    firstWord,
    capitalized.join(),
  ].join() as unknown as CasedString<CasingConvention.CamelCase>;
};

export const PascalToSnake: PropertyNameMapper<
  CasingConvention.PascalCase,
  CasingConvention.SnakeCase
> = (str) => {
  const words: string[] = [];
  let currentWord = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const lowerCase = char.toLocaleLowerCase();
    if (char !== lowerCase && currentWord && i > 0) {
      words.push(currentWord);
      currentWord = "";
    }
    currentWord += lowerCase;
  }
  if (currentWord) {
    words.push(currentWord);
  }
  return words.join("_") as unknown as CasedString<CasingConvention.SnakeCase>;
};

export const CamelToSnake: PropertyNameMapper<
  CasingConvention.CamelCase,
  CasingConvention.SnakeCase
> = (str) => {
  const words: string[] = [];
  let currentWord = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const lowerCase = char.toLocaleLowerCase();
    if (char !== lowerCase && currentWord) {
      words.push(currentWord);
      currentWord = "";
    }
    currentWord += lowerCase;
  }
  if (currentWord) {
    words.push(currentWord);
  }
  return words.join("_") as unknown as CasedString<CasingConvention.SnakeCase>;
};
