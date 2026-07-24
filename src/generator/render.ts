import path from "node:path";
import {mkdir, writeFile} from "node:fs/promises";
import {IndentationText, Project, QuoteKind, SourceFile} from "ts-morph";
import {format} from "prettier";

const project = new Project({
  useInMemoryFileSystem: true,
  manipulationSettings: {
    quoteKind: QuoteKind.Double,
    indentationText: IndentationText.TwoSpaces,
    useTrailingCommas: true,
  },
});

let counter = 0;

/**
 * Build a TypeScript source string by manipulating a throwaway ts-morph SourceFile.
 */
export const render = (build: (sf: SourceFile) => void): string => {
  const sf = project.createSourceFile(`__gen_${counter++}.ts`, "", {overwrite: true});
  build(sf);
  const text = sf.getFullText();
  project.removeSourceFile(sf);
  return text;
};

/**
 * Format with prettier and write the file under outDir.
 */
export const write = async (outDir: string, relPath: string, text: string): Promise<void> => {
  const outputPath = path.resolve(outDir, relPath);
  await mkdir(path.dirname(outputPath), {recursive: true});
  const formatted = await format(text, {parser: "typescript"});
  await writeFile(outputPath, formatted, {encoding: "utf-8"});
};
