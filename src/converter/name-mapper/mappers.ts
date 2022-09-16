import { assertNever, capitalize } from "src/common/util";
import { CasedString, CasingConvention, NameOutputMapper, NameType, ParsedWord } from "./types";
import { countOccurences, isCSharpPrimitive } from "./util";

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
  const parsedWords = basicWords.map(basicWord => {
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
      const tempTypeArguments = genericPartToUse.split(",").map(s => s.trim());
      const typeArgumentsInput: string[] = [];
      let currentStrs: string[] = [];
      let currentLeftAngleBrackets = 0;
      let currentRightAngleBrackets = 0;
      tempTypeArguments.forEach(arg => {
        currentLeftAngleBrackets += countOccurences(arg, "<");
        currentRightAngleBrackets += countOccurences(arg, ">");
        if (currentLeftAngleBrackets > currentRightAngleBrackets) {
          currentStrs.push(arg);
        } else if (currentLeftAngleBrackets === currentRightAngleBrackets) {
          if (currentStrs.length) {
            currentStrs.push(arg);
            const joined = currentStrs.join(", ");
            typeArgumentsInput.push(joined);
            currentStrs = [];
          } else {
            typeArgumentsInput.push(arg);
          }
        } else {
          throw new Error(`More right brackets than left brackets in ${genericPartToUse}`);
        }
      });
      typeArguments = typeArgumentsInput.map(s => parseNormalized(s));
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
  mapper: NameOutputMapper<T>,
  nameType: NameType
): string {
  const newTypeArgs = (typeArgs ?? []).map(t => mapper(t, nameType));
  const typeSection = newTypeArgs.length ? `<${newTypeArgs.join(", ")}>` : "";
  const formattedWord = `${base}${typeSection}${arrayPart ?? ""}`;
  return formattedWord;
}
const capitalizeWithPeriods = (str: string): string => {
  if (!str.includes(".")) {
    return capitalize(str);
  }
  const split = str.split(".");
  return split.map(capitalize).join(".");
};

export const PascalOutputMapper: NameOutputMapper<CasingConvention.PascalCase> = (
  words,
  nameType
) => {
  const formattedWords = words.map((word, i) => {
    const { base, typeArguments, arrayPart } = word;
    const isPossiblyPrimitive = i === 0 && words.length === 1;
    const isPrimitive =
      isPossiblyPrimitive && isCSharpPrimitive(base) && nameType === NameType.DeclarationName;
    const newBase = isPrimitive ? base : capitalizeWithPeriods(base);
    return format(newBase, typeArguments, arrayPart, PascalOutputMapper, nameType);
  });
  const outputWord = formattedWords.join("");
  return outputWord as unknown as CasedString<CasingConvention.PascalCase>;
};

export const CamelOutputMapper: NameOutputMapper<CasingConvention.CamelCase> = (
  words,
  nameType
) => {
  const formattedWords = words.map((word, i) => {
    const { base, typeArguments, arrayPart } = word;
    const isPossiblyPrimitive = i === 0 && words.length === 1;
    const isPrimitive =
      isPossiblyPrimitive && isCSharpPrimitive(base) && nameType === NameType.DeclarationName;
    const newBase = i > 0 && !isPrimitive ? capitalizeWithPeriods(base) : base;
    return format(newBase, typeArguments, arrayPart, CamelOutputMapper, nameType);
  });
  const outputWord = formattedWords.join("");
  return outputWord as unknown as CasedString<CasingConvention.CamelCase>;
};

export const SnakeOutputMapper: NameOutputMapper<CasingConvention.SnakeCase> = (
  words,
  nameType
) => {
  const formattedWords = words.map(word => {
    const { base, typeArguments, arrayPart } = word;
    return format(base, typeArguments, arrayPart, SnakeOutputMapper, nameType);
  });
  const outputWord = formattedWords.join("_");
  return outputWord as unknown as CasedString<CasingConvention.SnakeCase>;
};

export const KebabOutputMapper: NameOutputMapper<CasingConvention.KebabCase> = (
  words,
  nameType
) => {
  const formattedWords = words.map(word => {
    const { base, typeArguments, arrayPart } = word;
    return format(base, typeArguments, arrayPart, KebabOutputMapper, nameType);
  });
  const outputWord = formattedWords.join("-");
  return outputWord as unknown as CasedString<CasingConvention.KebabCase>;
};

export function normalize(str: string): string {
  let currentWord = "";
  const ignoreChars = new Set<string>(["<", " ", ",", "-", "_", ".", ":", "/"]);
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const lowerCase = char.toLocaleLowerCase();
    if (char !== lowerCase && i > 0 && !ignoreChars.has(str[i - 1])) {
      currentWord += "_";
    }
    currentWord += lowerCase;
  }
  const replaced = currentWord.replace(/-|:|\//g, "_");
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
  Array.from(str).forEach(char => {
    const charIsNumberOrLetter = isNumberOrLetterOrUnderscore(char);
    if (charIsNumberOrLetter) {
      if (previousCharIsNumberOrLetter !== undefined && !previousCharIsNumberOrLetter) {
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
  });
  return word;
}
