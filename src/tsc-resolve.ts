import * as path from "path";
const tsconfig = require("tsconfig");

import {
    CONFIG_FILENAME, convertToUnixPath, endsWith, getJSFiles,
    IFileReplace, ITypescriptModule, replaceInFile, rtrim, validateTsConfig
} from "./utils";

function getFileReplaceTask(outDir: string, filePath: string, modules: ITypescriptModule[]) {
    const replaces: IFileReplace[] = [];

    for (const module of modules) {
        const moduleDir = path.resolve(outDir, module.path);

        let diff = path.relative(path.resolve(moduleDir, path.dirname(filePath)), moduleDir);
        diff = convertToUnixPath(diff);

        if (!(diff.lastIndexOf(".", 0) === 0)) {
            diff = "./" + diff;
        }
        const regex = new RegExp(`(require\\(")(${module.name})(.*)`, "g");

        replaces.push({ regExp: regex, text: diff });
    }
    return replaceInFile(filePath, replaces);
}

export async function resolve(tsConfigFilePath: string) {
    if (!endsWith(tsConfigFilePath, ".json")) {
        tsConfigFilePath = path.join(tsConfigFilePath, CONFIG_FILENAME);
    }

    const config: any = await tsconfig.readFile(tsConfigFilePath);
    validateTsConfig(config);

    const outDir = path.resolve(path.dirname(tsConfigFilePath), config.compilerOptions.outDir);

    const jsFiles: string[] = getJSFiles(outDir);
    if (!jsFiles.length) {
        throw new Error("No .js files found");
    }
    const modules = Object.keys(config.compilerOptions.paths);
    await Promise.all(
        jsFiles.map((filePath: string) => {
            const tsModules: ITypescriptModule[] = [];
            for (const moduleName of modules) {
                const modulePath = rtrim(config.compilerOptions.paths[moduleName][0], "*"); // Remove trailing *s
                const normalisedModuleName = moduleName.replace(/([^\/*]+)([\/]?[*]?)/g, "$1");
                tsModules.push({ name: normalisedModuleName, path: modulePath });
            }
            return getFileReplaceTask(outDir, filePath, tsModules);
        })
    );
}
