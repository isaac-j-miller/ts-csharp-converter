import { jsDocNumberTypes } from "src/converter/consts";

export const cSharpPrimitives = ["string", "bool", "object", "null", ...jsDocNumberTypes] as const;
