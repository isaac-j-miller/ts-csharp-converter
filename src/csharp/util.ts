import { TAB_WIDTH } from "./elements/types";

export function formatCommentString(
  commentString: string | undefined,
  indent: number
): string {
  if (!commentString) {
    return "";
  }
  const indentString = getIndentString(indent);
  return (
    commentString
      .split("\n")
      .map((line) => indentString + line.trim())
      .join("\n") + "\n"
  );
}

export function getIndentString(indent: number): string {
  return " ".repeat((indent ?? 0) * TAB_WIDTH);
}
