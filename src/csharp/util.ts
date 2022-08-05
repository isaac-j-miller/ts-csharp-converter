import { TAB_WIDTH } from "./types";

export function formatCommentString(
  commentString: string | undefined,
  indent: number
): string {
  if (!commentString) {
    return "";
  }
  const indentString = getIndentString(indent);
  let inComment = false;
  return (
    commentString
      .split("\n")
      .map((line) => {
        let trimmed = line.trim();
        const startsWithBeginMultilineComment = trimmed.startsWith("/*");
        const startsWithEndMultilineComment = trimmed.match(/^\*+\//);
        const endsWithEndMultilineComment = trimmed.endsWith("*/");
        const startsWithSingleLineComment = trimmed.startsWith("//");
        if (inComment) {
          if (startsWithEndMultilineComment) {
            inComment = false;
          }
        } else if (
          startsWithBeginMultilineComment &&
          !endsWithEndMultilineComment
        ) {
          inComment = true;
        }

        if (
          !inComment &&
          !startsWithSingleLineComment &&
          !startsWithEndMultilineComment
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
