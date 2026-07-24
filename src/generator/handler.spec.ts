import {Api, Model} from "@automatons/parser";
import {emitHandler} from "./handler";
import {groupRoutes, routeName} from "./meta";

const newPet: Model = {
  title: "NewPet",
  filename: "newPet",
  imports: [],
  schema: {type: "object", properties: [{name: "name", required: true, schema: {type: "string"}}]},
};

const petsApi: Api = {
  title: "PetsApi",
  filename: "petsApi",
  servers: [],
  imports: [newPet],
  paths: [
    {
      name: "listPets",
      method: "get",
      path: "/pets",
      servers: [],
      queries: [
        {name: "limit", style: "form", schema: {type: "integer"}},
        {name: "status", style: "form", required: true, schema: {type: "string", enum: ["available", "sold"]}},
        {name: "deep", style: "form", schema: {type: "boolean"}},
        {name: "tags", style: "form", schema: {type: "array", items: {type: "string"}}},
      ],
      schema: {type: "array", items: {type: "model", name: "Pet"}},
    },
    {
      name: "createPet",
      method: "post",
      path: "/pets",
      servers: [],
      forms: [{types: ["application/json"], required: true, schema: {type: "model", name: "NewPet"}}],
      schema: {type: "model", name: "Pet"},
    },
    {
      name: "showPetById",
      method: "get",
      path: "/pets/{petId}",
      servers: [],
      parameters: [{name: "petId", style: "simple", schema: {type: "string"}}],
      schema: {type: "model", name: "Pet"},
    },
    {
      name: "deletePet",
      method: "delete",
      path: "/pets/{petId}",
      servers: [],
      parameters: [{name: "petId", style: "simple", schema: {type: "string"}}],
    },
  ],
};

const handlerFor = (api: Api[], path: string): string => {
  const route = groupRoutes(api).find((candidate) => candidate.path === path);
  if (!route) throw new Error(`no route for ${path}`);
  return emitHandler(route, routeName(route.path));
};

describe("emitHandler", () => {
  it("emits query extraction with coercion and a 400 guard for required queries", () => {
    const text = handlerFor([petsApi], "/pets");

    expect(text).toContain("createPetsHandlers");
    expect(text).toContain("service: PetsService");
    expect(text).toContain('request.nextUrl.searchParams.get("limit")');
    expect(text).toContain("limitRaw === null ? undefined : Number(limitRaw)");
    expect(text).toContain('"Missing required query parameter: status"');
    expect(text).toContain("{status: 400}");
    expect(text).toContain('statusRaw as "available" | "sold"');
    expect(text).toContain('deepRaw === "true"');
    expect(text).toContain('request.nextUrl.searchParams.getAll("tags")');
    expect(text).toContain("service.listPets(status, limit, deep, tags)");
  });

  it("parses the JSON body and answers 201 on post", () => {
    const text = handlerFor([petsApi], "/pets");

    expect(text).toContain("(await request.json()) as NewPet");
    expect(text).toContain("NextResponse.json(result, {status: 201})");
    expect(text).toContain('from "../models"');
    expect(text).toContain("NewPet");
  });

  it("awaits context.params and answers 204 when there is no response schema", () => {
    const text = handlerFor([petsApi], "/pets/{petId}");

    expect(text).toContain("createPetsPetIdHandlers");
    expect(text).toContain("const {petId} = await context.params;");
    expect(text).toContain("_request: NextRequest");
    expect(text).toContain("await service.deletePet(petId);");
    expect(text).toContain("new NextResponse(null, {status: 204})");
  });

  it("quotes hyphenated path params and coerces non-string ones", () => {
    const api: Api = {
      title: "ShopsApi",
      filename: "shopsApi",
      servers: [],
      imports: [],
      paths: [
        {
          name: "showShop",
          method: "get",
          path: "/shops/{shop-id}/{count}",
          servers: [],
          parameters: [
            {name: "shop-id", style: "simple", schema: {type: "string"}},
            {name: "count", style: "simple", schema: {type: "integer"}},
          ],
          schema: {type: "string"},
        },
      ],
    };
    const text = handlerFor([api], "/shops/{shop-id}/{count}");

    expect(text).toContain('const {"shop-id": shop_id, count: countRaw} = await context.params;');
    expect(text).toContain("const count = Number(countRaw);");
    expect(text).toContain('"shop-id": string; count: string');
    expect(text).toContain("service.showShop(shop_id, count)");
  });

  it("takes a service registry when operations of one path span multiple tags", () => {
    const adminApi: Api = {
      title: "AdminApi",
      filename: "adminApi",
      servers: [],
      imports: [],
      paths: [
        {
          name: "purgePets",
          method: "delete",
          path: "/pets",
          servers: [],
        },
      ],
    };
    const text = handlerFor([petsApi, adminApi], "/pets");

    expect(text).toContain("services: {pets: PetsService; admin: AdminService}");
    expect(text).toContain("services.pets.listPets(");
    expect(text).toContain("await services.admin.purgePets();");
  });
});
