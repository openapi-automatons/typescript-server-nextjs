import {Schema} from "@automatons/parser";

/** Quote an object key / destructuring key unless it is a valid identifier. */
export const quoteKey = (name: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);

const nullable = (schema: {nullable?: boolean}): string => (schema.nullable ? " | null" : "");

/**
 * Render a parser Schema as a TypeScript type string. Model references resolve to
 * the generated model type names.
 */
export const schemaToType = (schema: Schema): string => {
  switch (schema.type) {
    case "model":
      return `${schema.name}${nullable(schema)}`;
    case "object": {
      if (schema.properties && schema.properties.length) {
        const props = schema.properties
          .map(
            (property) =>
              `${quoteKey(property.name)}${property.required ? "" : "?"}: ${schemaToType(property.schema)};`,
          )
          .join("\n");
        return `{\n${props}\n}${nullable(schema)}`;
      }
      return `Record<string, unknown>${nullable(schema)}`;
    }
    case "allOf":
      return `(${schema.schemas.map(schemaToType).join(" & ")})${nullable(schema)}`;
    case "oneOf":
    case "anyOf":
      return `(${schema.schemas.map(schemaToType).join(" | ")})${nullable(schema)}`;
    case "array":
      return `${schema.items ? `Array<${schemaToType(schema.items)}>` : "any[]"}${nullable(schema)}`;
    case "boolean":
      return `boolean${nullable(schema)}`;
    case "string": {
      const base =
        schema.enum && schema.enum.length
          ? schema.enum.map((value) => `"${value}"`).join(" | ")
          : schema.format === "date" || schema.format === "date-time"
            ? "Date"
            : schema.format === "url"
              ? "URL"
              : "string";
      return `${base}${nullable(schema)}`;
    }
    case "integer":
    case "number": {
      const base = schema.enum && schema.enum.length ? schema.enum.join(" | ") : "number";
      return `${base}${nullable(schema)}`;
    }
    default:
      throw new Error(`Unsupported schema type: ${(schema as {type: string}).type}`);
  }
};
