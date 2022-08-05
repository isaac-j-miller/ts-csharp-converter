import {
  CasedString,
  CasingConvention,
  NameInputMapper,
  NameOutputMapper,
} from "./types";
import { capitalize } from "./util";

// TODO: handle reference names (including arrays, generics, etc)

export const PascalOutputMapper: NameOutputMapper<
  CasingConvention.PascalCase
> = (words) => {
  const capitalized = words.map(capitalize);
  return capitalized.join(
    ""
  ) as unknown as CasedString<CasingConvention.PascalCase>;
};

export const CamelOutputMapper: NameOutputMapper<CasingConvention.CamelCase> = (
  words
) => {
  const [firstWord, ...rest] = words;
  const capitalized = rest.map(capitalize);
  return [firstWord, capitalized.join("")].join(
    ""
  ) as unknown as CasedString<CasingConvention.CamelCase>;
};

export const SnakeOutputMapper: NameOutputMapper<CasingConvention.SnakeCase> = (
  words
) => {
  return words.join("_") as unknown as CasedString<CasingConvention.SnakeCase>;
};

export const KebabOutputMapper: NameOutputMapper<CasingConvention.KebabCase> = (
  words
) => {
  return words.join("-") as unknown as CasedString<CasingConvention.KebabCase>;
};
export const PascalInputMapper: NameInputMapper<CasingConvention.PascalCase> = (
  str
) => {
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
  return words;
};

export const CamelInputMapper: NameInputMapper<CasingConvention.CamelCase> = (
  str
) => {
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
  return words;
};

export const SnakeInputMapper: NameInputMapper<CasingConvention.SnakeCase> = (
  str
) => {
  return str.toLocaleLowerCase().split("_");
};

export const KebabInputMapper: NameInputMapper<CasingConvention.KebabCase> = (
  str
) => {
  return str.toLocaleLowerCase().split("-");
};
