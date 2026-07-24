import {Openapi} from '@automatons/tools';
import {rm} from "node:fs/promises";
import {join} from "path";
import {expectFormat} from "../expects/expectFormat";
import {generate} from "../../generator";
import paths from "../../paths";

const outDir = join(paths.tmp, 'minimum');

it('should generate with minimum', async () => {
  await generate(openapi, {path: '', openapiPath: '', outDir});

  await expectFormat();
});

beforeEach(async () => {
  await rm(outDir, {recursive: true, force: true});
});

const openapi: Openapi = {
  openapi: '3.0.3',
  info: {
    title: 'example',
    version: '0.0.0'
  },
  paths: {}
};
