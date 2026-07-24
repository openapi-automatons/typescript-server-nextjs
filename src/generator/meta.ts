import {AffectPath, Api, Model, Path, Schema} from "@automatons/parser";
import {quoteKey, schemaToType} from "./schema";

/** `PetsApi` -> `Pets` (the service base name). */
export const baseName = (api: Api): string => api.title.replace(/Api$/, "");
/** `petsApi` -> `pets` (the service file name). */
export const baseFilename = (api: Api): string => api.filename.replace(/Api$/, "");

export const upperFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
export const lowerFirst = (value: string): string => value.charAt(0).toLowerCase() + value.slice(1);

/** `Pets` -> `pets` (the key of a service in a multi-service handler factory). */
export const serviceKey = (api: Api): string => lowerFirst(baseName(api));

/** Make an OpenAPI parameter name safe to use as a JS identifier. */
export const identifier = (name: string): string => name.replace(/[^A-Za-z0-9_$]/g, "_");

export const isAffect = (path: Path): path is AffectPath => "forms" in path;

const pascalSegment = (segment: string): string =>
  segment
    .replace(/[{}]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(upperFirst)
    .join("");

/** `/pets/{petId}` -> `PetsPetId` (the base of the handler factory name). */
export const routeName = (routePath: string): string => routePath.split("/").map(pascalSegment).join("") || "Root";

/** `/pets/{petId}` -> `app/pets/[petId]/route.ts` (where the user mounts the handlers). */
export const appRoutePath = (routePath: string): string => {
  const segments = routePath
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/\{([^}]+)}/g, "[$1]"));
  return ["app", ...segments, "route.ts"].join("/");
};

export type RouteOperation = {api: Api; path: Path};
/** All operations sharing one literal OpenAPI path (one Next.js route file). */
export type Route = {path: string; operations: RouteOperation[]};

/** Group every operation of every api by its literal OpenAPI path. */
export const groupRoutes = (apis: Api[]): Route[] => {
  const routes = new Map<string, RouteOperation[]>();
  apis.forEach((api) =>
    api.paths.forEach((path) => {
      const operations = routes.get(path.path) ?? [];
      operations.push({api, path});
      routes.set(path.path, operations);
    }),
  );
  return [...routes.entries()].map(([path, operations]) => ({path, operations}));
};

/** The distinct apis serving a route, in first-appearance order. */
export const routeApis = (route: Route): Api[] => {
  const apis: Api[] = [];
  route.operations.forEach(({api}) => {
    if (!apis.includes(api)) apis.push(api);
  });
  return apis;
};

export type EndpointParam = {
  kind: "path" | "query" | "body";
  /** JS identifier used in the service signature and the handler body. */
  id: string;
  /** Original OpenAPI parameter name. */
  name: string;
  type: string;
  optional: boolean;
};

/** Build the parameter list of an operation, required-first (path, body, then queries). */
export const endpointParams = (path: Path): EndpointParam[] => {
  const params: EndpointParam[] = [];

  (path.parameters ?? []).forEach((parameter) =>
    params.push({
      kind: "path",
      id: identifier(parameter.name),
      name: parameter.name,
      type: schemaToType(parameter.schema),
      optional: false,
    }),
  );

  const forms = isAffect(path) ? (path.forms ?? []) : [];
  if (forms.length) {
    params.push({
      kind: "body",
      id: "body",
      name: "body",
      type: forms.map((form) => schemaToType(form.schema)).join(" | "),
      optional: !forms.some((form) => form.required),
    });
  }

  (path.queries ?? []).forEach((query) =>
    params.push({
      kind: "query",
      id: identifier(query.name),
      name: query.name,
      type: schemaToType(query.schema),
      optional: !query.required,
    }),
  );

  return params.sort((a, b) => Number(a.optional) - Number(b.optional));
};

/** The response type of an operation (`void` when there is no body schema). */
export const responseType = (path: Path): string => (path.schema ? schemaToType(path.schema) : "void");

/** The HTTP status the handler responds with (the parser exposes only the success schema). */
export const successStatus = (path: Path): number =>
  path.schema ? (path.method.toLowerCase() === "post" ? 201 : 200) : 204;

const collectFromSchema = (schema: Schema | undefined, names: Set<string>): void => {
  if (!schema) return;
  switch (schema.type) {
    case "model":
      names.add(schema.name);
      break;
    case "array":
      collectFromSchema(schema.items, names);
      break;
    case "object":
      (schema.properties ?? []).forEach((property) => collectFromSchema(property.schema, names));
      break;
    case "allOf":
    case "oneOf":
    case "anyOf":
      schema.schemas.forEach((inner) => collectFromSchema(inner, names));
      break;
    default:
      break;
  }
};

/** The models referenced by an api's operation signatures (imported by its service file). */
export const referencedModels = (api: Api): Model[] => {
  const names = new Set<string>();
  api.paths.forEach((path) => {
    (path.parameters ?? []).forEach((parameter) => collectFromSchema(parameter.schema, names));
    (path.queries ?? []).forEach((query) => collectFromSchema(query.schema, names));
    if (isAffect(path)) (path.forms ?? []).forEach((form) => collectFromSchema(form.schema, names));
    collectFromSchema(path.schema, names);
  });
  return api.imports.filter((model) => names.has(model.title));
};

/**
 * The models whose names appear in a route's handler code: request bodies and parameter
 * coercions only — response types never show up in handler text.
 */
export const routeModels = (route: Route): Model[] => {
  const names = new Set<string>();
  route.operations.forEach(({path}) => {
    (path.parameters ?? []).forEach((parameter) => collectFromSchema(parameter.schema, names));
    (path.queries ?? []).forEach((query) => collectFromSchema(query.schema, names));
    if (isAffect(path)) (path.forms ?? []).forEach((form) => collectFromSchema(form.schema, names));
  });
  const seen = new Set<string>();
  const models: Model[] = [];
  routeApis(route).forEach((api) =>
    api.imports.forEach((model) => {
      if (names.has(model.title) && !seen.has(model.title)) {
        seen.add(model.title);
        models.push(model);
      }
    }),
  );
  return models;
};

export {quoteKey};
