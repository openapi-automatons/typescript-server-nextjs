import {exec} from "node:child_process";
import {writeFileSync} from "node:fs";

export const tsc = () => {
  writeFileSync('tmp/tsconfig.json', JSON.stringify(tsconfig), {encoding: 'utf-8'});
  return new Promise((resolve, reject) =>
    exec("node_modules/.bin/tsc --project tmp/tsconfig.json", (error, stdout, stderr) => {
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

const tsconfig = {
  compilerOptions: {
    module: "esnext",
    moduleResolution: "bundler",
    ignoreDeprecations: "6.0",
    target: "es2022",
    lib: ["es2022", "dom"],
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    strictBindCallApply: true,
    strictPropertyInitialization: true,
    noImplicitThis: true,
    alwaysStrict: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    types: ["node"],
    noEmit: true
  },
  exclude: [
    "node_modules"
  ]
};
