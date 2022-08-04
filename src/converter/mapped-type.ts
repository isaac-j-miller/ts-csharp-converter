import { Node, SyntaxKind, Type } from "ts-morph";
import { PrimitiveTypeName } from "./types";

function isMappedType(type: Type): boolean {
  return type.getApparentProperties().length === 0;
}

export function getIndexAndValueType(
  node: Node
): [
  [Type | PrimitiveTypeName | undefined, Node | undefined],
  [Type | PrimitiveTypeName | undefined, Node | undefined]
] {
  const type = node.getType().getApparentType();
  if (type.getStringIndexType()) {
    return [
      ["string", undefined],
      [type.getStringIndexType(), undefined],
    ];
  }
  if (type.getNumberIndexType()) {
    return [
      ["number", undefined],
      [type.getNumberIndexType(), undefined],
    ];
  }
  if (!type.isObject()) {
    return [
      [undefined, undefined],
      [undefined, undefined],
    ];
  }
  if (!isMappedType(type)) {
    return [
      [undefined, undefined],
      [undefined, undefined],
    ];
  }
  const symbol = type.getAliasSymbol() ?? type.getSymbol();
  if (!symbol) {
    return [
      [undefined, undefined],
      [undefined, undefined],
    ];
  }
  const declaration = symbol.getDeclarations()[0];
  if (!declaration) {
    return [
      [undefined, undefined],
      [undefined, undefined],
    ];
  }
  let inBrackets = false;
  let afterColon = false;
  let afterInStatement = false;
  let afterSemicolon = false;
  const keyItems: Node[] = [];
  const valueItems: Node[] = [];
  const declarationDescendantToUse = declaration.getFirstDescendantByKind(
    SyntaxKind.MappedType
  );
  if (!declarationDescendantToUse) {
    return [
      [undefined, undefined],
      [undefined, undefined],
    ];
  }
  const descendants = declarationDescendantToUse.getChildren();
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
        afterInStatement = false;
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

  let detectedIndex: [Type | undefined | PrimitiveTypeName, Node | undefined] =
    [undefined, undefined];
  let detectedValue: [Type | undefined | PrimitiveTypeName, Node | undefined] =
    [undefined, undefined];
  if (keyItems.length === 1) {
    const toUse = keyItems[0];
    const asTypeParamDec = toUse.asKind(SyntaxKind.TypeParameter);
    if (asTypeParamDec) {
      detectedIndex[0] = asTypeParamDec.getConstraintOrThrow().getType();
      detectedIndex[1] = asTypeParamDec;
    } else {
      console.warn(`Key item not a type parameter declaration`);
    }
  } else {
    console.warn(`More than one key item detected`);
  }
  if (valueItems.length === 1) {
    const toUse = valueItems[0];
    detectedValue[0] = toUse.getType();
    detectedValue[1] = toUse;
  } else {
    console.warn(`More than one value item detected`);
  }
  return [detectedIndex, detectedValue];
}