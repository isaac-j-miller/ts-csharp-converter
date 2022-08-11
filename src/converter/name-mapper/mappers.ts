import { assertNever } from "src/common/util";
import {
  CasedString,
  CasingConvention,
  NameOutputMapper,
  ParsedWord,
} from "./types";
import { capitalize, isCSharpPrimitive } from "./util";

export function parseNormalized(word: string): ParsedWord[] {
  const basicWords: string[] = [];
  let currentWord = "";
  let level = 0;
  for (let i = 0; i < word.length; i++) {
    const currentChar = word[i];
    if (currentChar === "<") {
      level++;
    }
    if (currentChar === ">") {
      level--;
    }
    if (currentChar === "_" && level === 0) {
      basicWords.push(currentWord);
      currentWord = "";
    } else {
      currentWord += currentChar;
    }
  }
  if (currentWord) {
    basicWords.push(currentWord);
    currentWord = "";
  }
  const parsedWords = basicWords.map((basicWord) => {
    let baseWord = basicWord;
    let arrayPart: string | undefined;
    let typeArguments: ParsedWord[][] | undefined;
    const hasArray = basicWord.endsWith("]");
    if (hasArray) {
      const arrayStart = basicWord.lastIndexOf("[");
      baseWord = basicWord.slice(0, arrayStart);
      arrayPart = basicWord.slice(arrayStart);
    }
    const genericStart = baseWord.indexOf("<");
    if (genericStart > -1) {
      const genericPart = baseWord.slice(genericStart);
      baseWord = baseWord.slice(0, genericStart);
      const lastAngleBracketIdx = genericPart.lastIndexOf(">");
      const genericPartToUse = genericPart.slice(1, lastAngleBracketIdx);
      typeArguments = genericPartToUse.split(", ").map((s) => {
        const trimmed = s.trim();
        return parseNormalized(trimmed);
      });
    }
    const parsed: ParsedWord = {
      base: baseWord,
    };
    if (arrayPart) {
      parsed.arrayPart = arrayPart;
    }
    if (typeArguments && typeArguments.length > 0) {
      parsed.typeArguments = typeArguments;
    }
    return parsed;
  });
  return parsedWords;
}

function format<T extends CasingConvention>(
  base: string,
  typeArgs: ParsedWord[][] | undefined,
  arrayPart: string | undefined,
  mapper: NameOutputMapper<T>
): string {
  const newTypeArgs = (typeArgs ?? []).map((t) => mapper(t));
  const typeSection = newTypeArgs.length ? `<${newTypeArgs.join(", ")}>` : "";
  const formattedWord = `${base}${typeSection}${arrayPart ?? ""}`;
  return formattedWord;
}

export const PascalOutputMapper: NameOutputMapper<
  CasingConvention.PascalCase
> = (words) => {
  const formattedWords = words.map((word, i) => {
    const { base, typeArguments, arrayPart } = word;
    const isPossiblyPrimitive = i === 0 && words.length === 1;
    const isPrimitive = isPossiblyPrimitive && isCSharpPrimitive(base);
    const newBase = isPrimitive ? base : capitalize(base);
    return format(newBase, typeArguments, arrayPart, PascalOutputMapper);
  });
  const outputWord = formattedWords.join("");
  return outputWord as unknown as CasedString<CasingConvention.PascalCase>;
};

export const CamelOutputMapper: NameOutputMapper<CasingConvention.CamelCase> = (
  words
) => {
  const formattedWords = words.map((word, i) => {
    const { base, typeArguments, arrayPart } = word;
    const isPossiblyPrimitive = i === 0 && words.length === 1;
    const isPrimitive = isPossiblyPrimitive && isCSharpPrimitive(base);
    const newBase = i > 0 && !isPrimitive ? capitalize(base) : base;
    return format(newBase, typeArguments, arrayPart, CamelOutputMapper);
  });
  const outputWord = formattedWords.join("");
  return outputWord as unknown as CasedString<CasingConvention.CamelCase>;
};

export const SnakeOutputMapper: NameOutputMapper<CasingConvention.SnakeCase> = (
  words
) => {
  const formattedWords = words.map((word) => {
    const { base, typeArguments, arrayPart } = word;
    return format(base, typeArguments, arrayPart, SnakeOutputMapper);
  });
  const outputWord = formattedWords.join("_");
  return outputWord as unknown as CasedString<CasingConvention.SnakeCase>;
};

export const KebabOutputMapper: NameOutputMapper<CasingConvention.KebabCase> = (
  words
) => {
  const formattedWords = words.map((word) => {
    const { base, typeArguments, arrayPart } = word;
    return format(base, typeArguments, arrayPart, KebabOutputMapper);
  });
  const outputWord = formattedWords.join("-");
  return outputWord as unknown as CasedString<CasingConvention.KebabCase>;
};

export function normalize(str: string): string {
  let currentWord = "";
  const ignoreChars = new Set<string>(["<", " ", ",", "-", "_"]);
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const lowerCase = char.toLocaleLowerCase();
    if (char !== lowerCase && i > 0 && !ignoreChars.has(str[i - 1])) {
      currentWord += "_";
    }
    currentWord += lowerCase;
  }
  const replaced = currentWord.replace(/-/g, "_");
  return replaced;
}
function isNumberOrLetterOrUnderscore(char: string): boolean {
  if (char.length !== 1) {
    throw new Error(`not a char: "${char}"`);
  }
  const charCode = char.toUpperCase().charCodeAt(0);
  const isNumber = charCode >= 48 && charCode <= 57;
  const isLetter = charCode >= 65 && charCode <= 90;
  return isNumber || isLetter || char === "_";
}
export function formatForEnum(
  str: string | CasedString<CasingConvention>,
  casing: CasingConvention
): string {
  let word: string = "";
  let previousCharIsNumberOrLetter: boolean | undefined;
  for (const char of str) {
    const charIsNumberOrLetter = isNumberOrLetterOrUnderscore(char);
    if (charIsNumberOrLetter) {
      if (
        previousCharIsNumberOrLetter !== undefined &&
        !previousCharIsNumberOrLetter
      ) {
        switch (casing) {
          case CasingConvention.CamelCase:
          case CasingConvention.PascalCase:
            word += char.toUpperCase();
            break;
          case CasingConvention.KebabCase:
            word += `-${char}`;
            break;
          case CasingConvention.SnakeCase:
            word += `_${char}`;
            break;
          default:
            assertNever(casing);
        }
      } else {
        word += char;
      }
    }
    previousCharIsNumberOrLetter = charIsNumberOrLetter;
  }
  return word;
}
