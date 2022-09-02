import { TAB_WIDTH } from "./types";

export function formatCommentString(commentString: string | undefined, indent: number): string {
  if (!commentString) {
    return "";
  }
  const indentString = getIndentString(indent);
  let inComment = false;
  return (
    commentString
      .split("\n")
      .map(line => {
        let trimmed = line.trim();
        const startsWithBeginMultilineComment = trimmed.startsWith("/*");
        const startsWithEndMultilineComment = trimmed.match(/^\*+\//);
        const endsWithEndMultilineComment = trimmed.endsWith("*/");
        const startsWithSingleLineComment = trimmed.startsWith("//");
        const isOneSingleLineMultilineComment =
          startsWithBeginMultilineComment && endsWithEndMultilineComment;
        if (inComment) {
          if (startsWithEndMultilineComment) {
            inComment = false;
          }
        } else if (startsWithBeginMultilineComment && !endsWithEndMultilineComment) {
          inComment = true;
        }

        if (
          !inComment &&
          !startsWithSingleLineComment &&
          !startsWithEndMultilineComment &&
          !isOneSingleLineMultilineComment
        ) {
          trimmed = "// " + trimmed;
        }
        return indentString + trimmed;
      })
      .join("\n") + "\n"
  );
}

export function getIndentString(indent: number): string {
  return " ".repeat((indent ?? 0) * TAB_WIDTH);
}

export function getFirstNUppercaseLetters(n: number) {
  const letters: string[] = [];
  const minIdx = 65;
  const maxIdx = 90;

  for (let i = 0; i < n; i++) {
    if (i <= maxIdx) {
      letters.push(String.fromCharCode(minIdx + i));
    } else {
      // TODO: start adding numbers
      throw new Error(
        `n (${n}) > ${maxIdx - minIdx}, can't get letter with ASCII index of ${
          minIdx + i
        } because it is not a letter`
      );
    }
  }
  return letters;
}
