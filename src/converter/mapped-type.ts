import { LoggerFactory } from "src/common/logging/factory";
import { Node, SyntaxKind, Type } from "ts-morph";
import { PrimitiveTypeName } from "./types";
import { getArrayDepth, getFinalArrayType, getFinalSymbol, getFinalSymbolOfType } from "./util";

function isMappedType(type: Type): boolean {
  return type.getApparentProperties().length === 0;
}
type IndexAndValueTypeInfo = {
  index: MappedTypeInfo;
  value: MappedTypeInfo;
};

export type MappedTypeInfo = {
  type?: Type | PrimitiveTypeName;
  node?: Node;
  isArray: boolean;
  arrayDepth?: number;
};
export function getIndexAndValueType(node: Node): IndexAndValueTypeInfo | undefined {
  const logger = LoggerFactory.getLogger("mapped-type-inferrer");
  const type = node.getType().getApparentType();
  if (type.getStringIndexType()) {
    const stringIndexType = getFinalArrayType(type.getStringIndexType()!);
    return {
      index: {
        type: "string",
        node,
        isArray: false,
      },
      value: {
        type: stringIndexType,
        isArray: !!stringIndexType!.isArray(),
        arrayDepth: getArrayDepth(stringIndexType!),
      },
    };
  }
  if (type.getNumberIndexType()) {
    const numIndexType = getFinalArrayType(type.getNumberIndexType()!);
    return {
      index: {
        type: "number",
        node,
        isArray: false,
      },
      value: {
        type: numIndexType,
        isArray: !!numIndexType!.isArray(),
        arrayDepth: getArrayDepth(numIndexType!),
      },
    };
  }
  const sym = getFinalSymbolOfType(type);
  if (!type.isObject() || !isMappedType(type) || !sym || !sym.getDeclarations()[0]) {
    return;
  }
  const declaration = sym.getDeclarations()[0];
  let inBrackets = false;
  let afterColon = false;
  let afterSemicolon = false;
  const keyItems: Node[] = [];
  const valueItems: Node[] = [];
  if (!declaration) {
    return;
  }
  const descendants = declaration.getChildren();
  for (const descendant of descendants) {
    const kind = descendant.getKind();
    switch (kind) {
      case SyntaxKind.OpenBracketToken:
        afterSemicolon = false;
        inBrackets = true;
        break;
      case SyntaxKind.CloseBracketToken:
        inBrackets = false;
        afterColon = false;
        break;
      case SyntaxKind.ColonToken:
        afterColon = true;
        break;
      case SyntaxKind.SemicolonToken:
        afterSemicolon = true;
        break;
      case SyntaxKind.TypeReference:
      case SyntaxKind.TypeAliasDeclaration:
      case SyntaxKind.TypeLiteral:
      case SyntaxKind.ArrayLiteralExpression:
      case SyntaxKind.StringKeyword:
      case SyntaxKind.StringLiteral:
      case SyntaxKind.NumberKeyword:
      case SyntaxKind.NumericLiteral:
      case SyntaxKind.BooleanKeyword:
      case SyntaxKind.LiteralType:
      case SyntaxKind.AnyKeyword:
      case SyntaxKind.ObjectKeyword:
      case SyntaxKind.ObjectLiteralExpression:
      case SyntaxKind.TypeParameter:
      case SyntaxKind.UnionType:
      case SyntaxKind.ArrayType:
      case SyntaxKind.TupleType:
      case SyntaxKind.InferType:
      case SyntaxKind.ConditionalType:
        if (afterSemicolon) {
          break;
        }
        if (inBrackets) {
          keyItems.push(descendant);
        } else if (afterColon) {
          valueItems.push(descendant);
        }
        break;
      default:
        break;
    }
  }

  const detectedIndex: MappedTypeInfo = {
    isArray: false,
  };
  const detectedValue: MappedTypeInfo = {
    isArray: false,
  };
  const nodeSymbol = node.getSymbol();
  const finalSynbol = nodeSymbol ? getFinalSymbol(nodeSymbol).getName() : "<anon>";
  if (keyItems.length === 1) {
    const toUse = keyItems[0];
    const asTypeParamDec = toUse.asKind(SyntaxKind.TypeParameter);
    if (asTypeParamDec) {
      detectedIndex.type = asTypeParamDec.getConstraintOrThrow().getType();
      detectedIndex.node = asTypeParamDec;
    } else {
      logger.warn("Key item not a type parameter declaration");
    }
  } else if (keyItems.length > 0) {
    logger.warn(`More than one key item detected for ${finalSynbol}:`, keyItems);
  }
  if (valueItems.length === 1) {
    const toUse = valueItems[0];
    detectedValue.type = toUse.getType();
    detectedValue.node = toUse;
  } else if (valueItems.length > 0) {
    logger.warn(`More than one value item detected for ${finalSynbol}:`, valueItems);
  }
  return {
    index: detectedIndex,
    value: detectedValue,
  };
}
