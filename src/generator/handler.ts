import {Form, Path, PathParameter, QueryParameter, Schema} from "@automatons/parser";
import {VariableDeclarationKind} from "ts-morph";
import {render} from "./render";
import {
  appRoutePath,
  baseName,
  endpointParams,
  identifier,
  isAffect,
  quoteKey,
  Route,
  routeApis,
  routeModels,
  serviceKey,
  successStatus,
} from "./meta";
import {schemaToType} from "./schema";

/**
 * Expression converting a raw path/query string to the declared schema type.
 * `null` means the raw string is already the right type.
 */
const convertExpr = (schema: Schema, raw: string): string | null => {
  switch (schema.type) {
    case "string":
      if (schema.enum && schema.enum.length) return `${raw} as ${schemaToType(schema)}`;
      if (schema.format === "date" || schema.format === "date-time") return `new Date(${raw})`;
      if (schema.format === "url") return `new URL(${raw})`;
      return null;
    case "integer":
    case "number":
      return schema.enum && schema.enum.length ? `Number(${raw}) as ${schemaToType(schema)}` : `Number(${raw})`;
    case "boolean":
      return `${raw} === "true"`;
    default:
      return `${raw} as unknown as ${schemaToType(schema)}`;
  }
};

/** Expression converting the `string[]` of `searchParams.getAll` to the declared item type. */
const convertArrayExpr = (items: Schema | undefined, raw: string): string => {
  if (!items) return raw;
  switch (items.type) {
    case "integer":
    case "number":
      return items.enum && items.enum.length
        ? `${raw}.map(Number) as Array<${schemaToType(items)}>`
        : `${raw}.map(Number)`;
    case "boolean":
      return `${raw}.map((value) => value === "true")`;
    case "string":
      if (items.enum && items.enum.length) return `${raw} as Array<${schemaToType(items)}>`;
      if (items.format === "date" || items.format === "date-time") return `${raw}.map((value) => new Date(value))`;
      if (items.format === "url") return `${raw}.map((value) => new URL(value))`;
      return raw;
    default:
      return `${raw} as unknown as Array<${schemaToType(items)}>`;
  }
};

const needsContext = (path: Path): boolean => (path.parameters ?? []).length > 0;
const usesRequest = (path: Path): boolean =>
  (path.queries ?? []).length > 0 || (isAffect(path) && (path.forms ?? []).length > 0);

/** `const {petId} = await context.params;` plus coercions for non-string params. */
const pathParamStatements = (parameters: PathParameter[]): string[] => {
  const elements = parameters.map((parameter) => {
    const id = identifier(parameter.name);
    const target = convertExpr(parameter.schema, "raw") === null ? id : `${id}Raw`;
    return parameter.name === target ? parameter.name : `${quoteKey(parameter.name)}: ${target}`;
  });
  const statements = [`const {${elements.join(", ")}} = await context.params;`];
  parameters.forEach((parameter) => {
    const id = identifier(parameter.name);
    const converted = convertExpr(parameter.schema, `${id}Raw`);
    if (converted !== null) statements.push(`const ${id} = ${converted};`);
  });
  return statements;
};

/** Read one query parameter off `request.nextUrl.searchParams`, 400 when a required one is missing. */
const queryStatements = (query: QueryParameter): string[] => {
  const id = identifier(query.name);
  if (query.schema.type === "array") {
    const getAll = `request.nextUrl.searchParams.getAll(${JSON.stringify(query.name)})`;
    return [`const ${id} = ${convertArrayExpr(query.schema.items, getAll)};`];
  }

  const get = `request.nextUrl.searchParams.get(${JSON.stringify(query.name)})`;
  const missing = `return NextResponse.json({message: ${JSON.stringify(
    `Missing required query parameter: ${query.name}`,
  )}}, {status: 400});`;
  const converted = convertExpr(query.schema, `${id}Raw`);

  if (converted === null) {
    if (query.required) {
      return [`const ${id} = ${get};`, `if (${id} === null) {`, missing, `}`];
    }
    return [`const ${id} = ${get} ?? undefined;`];
  }
  if (query.required) {
    return [`const ${id}Raw = ${get};`, `if (${id}Raw === null) {`, missing, `}`, `const ${id} = ${converted};`];
  }
  return [`const ${id}Raw = ${get};`, `const ${id} = ${id}Raw === null ? undefined : ${converted};`];
};

/** Parse the JSON request body, cast to the declared form type(s). */
const bodyStatement = (forms: Form[]): string => {
  const type = forms.map((form) => schemaToType(form.schema)).join(" | ");
  return forms.some((form) => form.required)
    ? `const body = (await request.json()) as ${type};`
    : `const body = (await request.json().catch(() => undefined)) as ${type} | undefined;`;
};

/** One `METHOD: async (...) => {...}` property of the handlers object. */
const operationText = (path: Path, serviceExpr: string): string => {
  const parameters = path.parameters ?? [];
  const queries = path.queries ?? [];
  const forms = isAffect(path) ? (path.forms ?? []) : [];

  const statements: string[] = [];
  if (parameters.length) statements.push(...pathParamStatements(parameters));
  queries.forEach((query) => statements.push(...queryStatements(query)));
  if (forms.length) statements.push(bodyStatement(forms));

  const args = endpointParams(path)
    .map((param) => param.id)
    .join(", ");
  if (path.schema) {
    statements.push(`const result = await ${serviceExpr}.${path.name}(${args});`);
    statements.push(`return NextResponse.json(result, {status: ${successStatus(path)}});`);
  } else {
    statements.push(`await ${serviceExpr}.${path.name}(${args});`);
    statements.push(`return new NextResponse(null, {status: 204});`);
  }

  const signature = needsContext(path)
    ? `async (${usesRequest(path) ? "request" : "_request"}: NextRequest, context: {params: Promise<{${parameters
        .map((parameter) => `${quoteKey(parameter.name)}: string`)
        .join("; ")}}>}): Promise<NextResponse>`
    : usesRequest(path)
      ? `async (request: NextRequest): Promise<NextResponse>`
      : `async (): Promise<NextResponse>`;

  return `${path.method.toUpperCase()}: ${signature} => {\n${statements.join("\n")}\n}`;
};

/**
 * Emit handlers/<route>.ts: a factory building the route-handler object for one OpenAPI path.
 * The user re-exports the returned handlers from the matching app/.../route.ts file.
 */
export const emitHandler = (route: Route, name: string): string =>
  render((sf) => {
    const apis = routeApis(route);
    const multi = apis.length > 1;

    const anyNextRequest = route.operations.some(({path}) => needsContext(path) || usesRequest(path));
    sf.addImportDeclaration({
      moduleSpecifier: "next/server",
      namedImports: [...(anyNextRequest ? [{name: "NextRequest", isTypeOnly: true}] : []), {name: "NextResponse"}],
    });

    sf.addImportDeclaration({
      isTypeOnly: true,
      namedImports: apis.map((api) => `${baseName(api)}Service`),
      moduleSpecifier: "../services",
    });

    const models = routeModels(route);
    if (models.length) {
      sf.addImportDeclaration({
        isTypeOnly: true,
        namedImports: models.map((model) => model.title),
        moduleSpecifier: "../models",
      });
    }

    const factoryParam = multi
      ? `services: {${apis.map((api) => `${serviceKey(api)}: ${baseName(api)}Service`).join("; ")}}`
      : `service: ${apis.map((api) => `${baseName(api)}Service`).join("")}`;

    const operations = route.operations.map(({api, path}) =>
      operationText(path, multi ? `services.${serviceKey(api)}` : "service"),
    );

    sf.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      docs: [`Route handlers for \`${route.path}\` — re-export them from \`${appRoutePath(route.path)}\`.`],
      declarations: [
        {
          name: `create${name}Handlers`,
          initializer: `(${factoryParam}) => ({\n${operations.join(",\n")},\n})`,
        },
      ],
    });
  });

/**
 * Emit handlers/index.ts re-exporting every handler factory.
 */
export const emitHandlersIndex = (filenames: string[]): string =>
  render((sf) => filenames.forEach((filename) => sf.addExportDeclaration({moduleSpecifier: `./${filename}`})));
