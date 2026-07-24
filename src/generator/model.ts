import {Model} from "@automatons/parser";
import {render} from "./render";
import {schemaToType} from "./schema";

/**
 * Emit a single model file: imports for referenced models + an exported type alias.
 */
export const emitModel = (model: Model): string =>
  render((sf) => {
    model.imports.forEach((imported) =>
      sf.addImportDeclaration({
        isTypeOnly: true,
        namedImports: [imported.title],
        moduleSpecifier: `./${imported.filename}`,
      }),
    );
    sf.addTypeAlias({
      isExported: true,
      name: model.title,
      type: schemaToType(model.schema),
    });
  });

/**
 * Emit models/index.ts re-exporting every model.
 */
export const emitModelsIndex = (models: Model[]): string =>
  render((sf) => models.forEach((model) => sf.addExportDeclaration({moduleSpecifier: `./${model.filename}`})));
