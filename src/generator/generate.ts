import {AutomatonSettings, Openapi} from "@automatons/tools";
import {parser} from "@automatons/parser";
import {render, write} from "./render";
import {emitModel, emitModelsIndex} from "./model";
import {emitService, emitServicesIndex} from "./service";
import {emitHandler, emitHandlersIndex} from "./handler";
import {baseFilename, groupRoutes, lowerFirst, routeName} from "./meta";

const emitIndex = (hasModels: boolean, hasApis: boolean): string =>
  render((sf) => {
    if (hasModels) sf.addExportDeclaration({moduleSpecifier: "./models"});
    if (hasApis) {
      sf.addExportDeclaration({moduleSpecifier: "./services"});
      sf.addExportDeclaration({moduleSpecifier: "./handlers"});
    }
  });

export const generate = async (openapi: Openapi, settings: AutomatonSettings): Promise<void[]> => {
  const {outDir} = settings;
  const {models, apis} = await parser(openapi, settings);
  const tasks: Promise<void>[] = [];

  if (models.length) {
    tasks.push(write(outDir, "models/index.ts", emitModelsIndex(models)));
    models.forEach((model) => tasks.push(write(outDir, `models/${model.filename}.ts`, emitModel(model))));
  }

  if (apis.length) {
    tasks.push(write(outDir, "services/index.ts", emitServicesIndex(apis)));
    apis.forEach((api) => tasks.push(write(outDir, `services/${baseFilename(api)}.service.ts`, emitService(api))));

    // Distinct paths can collapse to the same name (`/pets-x` vs `/pets/x`); suffix duplicates.
    const names = new Set<string>();
    const handlers = groupRoutes(apis).map((route) => {
      let name = routeName(route.path);
      for (let n = 2; names.has(name); n++) name = `${routeName(route.path)}${n}`;
      names.add(name);
      return {route, name};
    });
    tasks.push(write(outDir, "handlers/index.ts", emitHandlersIndex(handlers.map(({name}) => lowerFirst(name)))));
    handlers.forEach(({route, name}) =>
      tasks.push(write(outDir, `handlers/${lowerFirst(name)}.ts`, emitHandler(route, name))),
    );
  }

  tasks.push(write(outDir, "index.ts", emitIndex(models.length > 0, apis.length > 0)));

  return Promise.all(tasks);
};
