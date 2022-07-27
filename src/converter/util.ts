import { assertNever } from "src/common/util";
import { CSharpPrimitiveType } from "src/csharp/elements";
import { PrimitiveTypeName } from "./types";

export function toCSharpPrimitive(
  primitive: PrimitiveTypeName
): CSharpPrimitiveType {
  switch (primitive) {
    case "Boolean":
    case "boolean":
      return "bool";
    case "Number":
    case "number":
      // TODO: somehow determine or guess whether should be int or double
      return "int";
    case "String":
    case "string":
      return "string";
    case "any":
    case "object":
    case "unknown":
      return "object";
    case "null":
    case "undefined":
      return "null";
    default:
      assertNever(primitive);
  }
  throw new Error("Somehow this fell through");
}
