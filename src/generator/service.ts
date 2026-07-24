import {Api} from "@automatons/parser";
import {render} from "./render";
import {baseFilename, baseName, endpointParams, referencedModels, responseType} from "./meta";

/**
 * Emit services/<tag>.service.ts: the interface declaring the contract the user must implement.
 * Regenerating this file never touches the user's concrete implementation.
 */
export const emitService = (api: Api): string =>
  render((sf) => {
    const models = referencedModels(api);
    if (models.length) {
      sf.addImportDeclaration({
        isTypeOnly: true,
        namedImports: models.map((model) => model.title),
        moduleSpecifier: "../models",
      });
    }

    const serviceInterface = sf.addInterface({isExported: true, name: `${baseName(api)}Service`});
    api.paths.forEach((path) =>
      serviceInterface.addMethod({
        name: path.name,
        parameters: endpointParams(path).map((param) => ({
          name: param.id,
          type: param.type,
          hasQuestionToken: param.optional,
        })),
        returnType: `Promise<${responseType(path)}>`,
      }),
    );
  });

/**
 * Emit services/index.ts re-exporting every service.
 */
export const emitServicesIndex = (apis: Api[]): string =>
  render((sf) => apis.forEach((api) => sf.addExportDeclaration({moduleSpecifier: `./${baseFilename(api)}.service`})));
