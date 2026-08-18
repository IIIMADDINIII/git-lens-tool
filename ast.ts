import type { AssignmentExpression, AssignmentOperator, Expression, Literal, LogicalExpression, LogicalOperator, MemberExpression, ObjectExpression, Pattern, Property, ReturnStatement, SequenceExpression, SpreadElement, Super } from "acorn";

export function objectExpression(properties: Array<Property | SpreadElement>): ObjectExpression {
  return {
    type: "ObjectExpression",
    properties,
    start: -1,
    end: -1,
  };
}

export function spreadElement(argument: Expression): SpreadElement {
  return {
    type: "SpreadElement",
    argument,
    start: -1,
    end: -1,
  };
}

export function property(
  key: Expression | string,
  value: Expression,
  kind: "init" | "get" | "set" = "init",
  method: boolean = false,
  shorthand: boolean = false,
  computed: boolean = false
): Property {
  if (typeof key === "string")
    key = identifier(key);
  return {
    type: "Property",
    kind,
    method,
    shorthand,
    computed,
    key,
    value,
    start: -1,
    end: -1,
  };
}

export function identifier(name: string): Expression {
  return {
    type: "Identifier",
    name,
    start: -1,
    end: -1,
  };
}

export function literal(value: string | boolean | null | number | RegExp | bigint): Literal {
  return {
    type: "Literal",
    value,
    start: -1,
    end: -1,
  };
}

export function returnStatement(argument: Expression | null): ReturnStatement {
  return {
    type: "ReturnStatement",
    argument,
    start: -1,
    end: -1,
  };
}

export function memberExpression(object: Expression | Super, property: Expression | string, computed: boolean = false, optional: boolean = false): MemberExpression {
  if (typeof property === "string")
    property = identifier(property);
  return {
    type: "MemberExpression",
    object,
    property,
    computed,
    optional,
    start: -1,
    end: -1,
  };
}

export function sequenceExpression(expressions: Expression[]): SequenceExpression {
  return {
    type: "SequenceExpression",
    expressions,
    start: -1,
    end: -1,
  };
}

export function assignmentExpression(left: Pattern, right: Expression, operator: AssignmentOperator = "="): AssignmentExpression {
  return {
    type: "AssignmentExpression",
    operator,
    left,
    right,
    start: -1,
    end: -1,
  };
}

export function logicalExpression(left: Expression, operator: LogicalOperator, right: Expression): LogicalExpression {
  return {
    type: "LogicalExpression",
    operator,
    left,
    right,
    start: -1,
    end: -1,
  };
}