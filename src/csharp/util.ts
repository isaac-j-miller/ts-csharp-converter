import { TAB_WIDTH } from "./elements/types";

export function formatCommentString(
  commentString: string | undefined,
  indent: number
): string {
  if (!commentString) {
    return "";
  }
  const indentString = getIndentString(indent);
  let inComment =false;
  return (
    commentString
      .split("\n")
      .map((line) => {
        let trimmed = line.trim();
        if(inComment) {
            if(trimmed.startsWith("/*") && !trimmed.endsWith("*/")) {
                inComment = true;
            }
        } else {
            if(trimmed.startsWith("*/")) {
                inComment = false;
            }
            if(!trimmed.startsWith("//")) {
                trimmed = "// " + trimmed;
            }
        }
        return indentString + trimmed
      })
      .join("\n") + "\n"
  );
}

export function getIndentString(indent: number): string {
  return " ".repeat((indent ?? 0) * TAB_WIDTH);
}
