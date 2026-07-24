import {exec} from "node:child_process";
import {writeFileSync} from "node:fs";

const config = `import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {files: ['**/*.ts'], languageOptions: {parser: tseslint.parser}},
  prettier,
  {rules: {'prefer-const': 'warn'}},
);
`;

export const eslint = () => {
  writeFileSync('tmp/eslint.config.mjs', config, {encoding: 'utf-8'});

  return new Promise((resolve, reject) =>
    exec("node_modules/.bin/eslint tmp --no-config-lookup --config tmp/eslint.config.mjs", (error, stdout, stderr) => {
      if (error) {
        console.error(stdout);
        return reject(error);
      }
      if (stderr) {
        return reject(stderr);
      }
      resolve(stdout);
    }));
};
