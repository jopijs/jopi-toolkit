// noinspection JSUnusedGlobalSymbols

import * as jk_thread from "jopi-toolkit/jk_thread";
import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_timer from "jopi-toolkit/jk_timer";
import {isBunJS, isNodeJS} from "jopi-toolkit/jk_what";
import {isUsingWorker} from "jopi-toolkit/jk_thread";

export type Listener = ()=>void|Promise<void>;

async function execListeners(listeners: Listener[]) {
    const list = [...listeners];
    listeners.splice(0);

    for (const listener of list) {
        try {
            const res = listener();
            if (res instanceof Promise) await res;
        }
        catch (e) {
            console.error(e);
        }
    }
}

//region Life cycle

declare global {
    var jopiHotReload: HotReloadType;
}

const gOnServerSideReady: Listener[] = [];
const gOnAppExiting: Listener[] = [];
const gOnAppExited: Listener[] = [];
const gOnAppStart: Listener[] = [];
let gIsServerSideReady = !(isNodeJS || isBunJS);

let gIsHotReload = globalThis.jopiHotReload !== undefined;
let gIsAppStarted = false;

export interface HotReloadType {
    onHotReload: Listener[];
    memory: { [key: string]: any };
}

if (gIsHotReload) {
    execListeners(globalThis.jopiHotReload.onHotReload).then();
} else {
    globalThis.jopiHotReload = {
        onHotReload: [],
        memory: {}
    }
}

const gOnHotReload = globalThis.jopiHotReload.onHotReload;
const gMemory = globalThis.jopiHotReload.memory;

export function onServerSideReady(listener: Listener) {
    if (gIsServerSideReady) listener();
    else gOnServerSideReady.push(listener);
}

export function waitServerSideReady() {
    if (gIsServerSideReady) {
        return Promise.resolve();
    }

    return new Promise<void>(r => {
        onServerSideReady(r);
    });
}

export async function declareServerSideReady() {
    gIsServerSideReady = true;
    await execListeners(gOnServerSideReady);
}

export function onAppStart(listener: Listener) {
    if (gIsAppStarted) listener();
    else gOnAppStart.push(listener);
}

export function onAppExiting(listener: Listener) {
    if (gIsExited) listener();
    else gOnAppExiting.push(listener);
}

export function onAppExited(listener: Listener) {
    if (gIsExited) listener();
    else gOnAppExited.push(listener);
}

export async function declareAppStarted() {
    gIsAppStarted = true;
    await execListeners(gOnAppStart);
}

export async function declareAppExiting() {
    if (gIsExited) return;
    gIsExited = true;

    if (isUsingWorker()) {
        // Wait 1 sec, which allows the worker to correctly initialize.
        await jk_timer.tick(1000);
    }

    gIsAppStarted = false;

    await execListeners(gOnAppExiting);

    if (isUsingWorker()) {
        // Allows to worker to correctly stop their activity.
        await jk_timer.tick(100);
    }

    if (!jk_thread.isMainThread) {
        // Allows to worker to correctly stop their activity.
        await jk_timer.tick(50);
    }

    await execListeners(gOnAppExited);
}

export async function executeApp(app: Listener) {
    await waitServerSideReady();
    declareAppStarted();

    try {
        const res = app();
        if (res instanceof Promise) await res;
    }
    finally {
        declareAppExiting();
    }
}

//endregion

//region Hot-reload

export function onHotReload(listener: Listener) {
    gOnHotReload.push(listener);
}

export function keepOnHotReload<T>(key: string, provider: ()=>T): T {
    let current = gMemory[key];
    if (current!==undefined) return current;
    return gMemory[key] = provider();
}

export function clearHotReloadKey(key: string) {
    delete(gMemory[key]);
}

//endregion

//region Temp dir

export function getTempDir(): string {
    if (!gTempDir) {
        gTempDir = jk_fs.resolve(process.cwd(), "temp")!;
    }

    return gTempDir;
}

export function setTempDir(dir: string) {
    gTempDir = dir;
}

let gIsExited = false;
let gTempDir: string|undefined;

//endregion

//region Resolving

export async function findNodePackageDir(packageName: string, searchFromDir = getCodeSourceDirHint()): Promise<string | undefined> {
    let currentDir = jk_fs.resolve(searchFromDir);

    while (true) {
        let packagePath = jk_fs.join(currentDir, 'node_modules', packageName);
        if (await jk_fs.isDirectory(packagePath)) return packagePath;
        const parentDir = jk_fs.dirname(currentDir);
        if (parentDir === currentDir) break;
        currentDir = parentDir;
    }

    return undefined;
}

export async function requireNodePackageDir(packageName: string, searchFromDir = getCodeSourceDirHint()): Promise<string> {
    let pkgDir = await findNodePackageDir(packageName, searchFromDir);
    if (!pkgDir) throw new Error("Package '" + packageName + "' not found");
    return pkgDir;
}

export function findRequiredPackageJsonDir(searchFromDir = getCodeSourceDirHint()): string {
    let pkgJsonPath = findRequiredPackageJson(searchFromDir);
    return jk_fs.dirname(pkgJsonPath);
}

export function findPackageJsonDir(searchFromDir = getCodeSourceDirHint()): string|undefined {
    let pkgJsonPath = findPackageJson(searchFromDir);
    if (!pkgJsonPath) return undefined;
    return jk_fs.dirname(pkgJsonPath);
}

export function findRequiredPackageJson(searchFromDir = getCodeSourceDirHint()): string {
    let res = findPackageJson(searchFromDir);
    if (!res) throw new Error("No package.json found.");
    return res;
}

export function findPackageJson(searchFromDir = getCodeSourceDirHint()): string|undefined {
    if (!searchFromDir && (gPackageJsonPath!==undefined)) {
        return gPackageJsonPath;
    }

    let currentDir = searchFromDir;

    while (true) {
        const packagePath = jk_fs.join(currentDir, 'package.json');

        if (jk_fs.isFileSync(packagePath)) return gPackageJsonPath = packagePath;

        const parentDir = jk_fs.dirname(currentDir);

        // Reached root directory
        if (parentDir === currentDir) break;

        currentDir = parentDir;
    }

    return undefined;
}
//
let gPackageJsonPath: string|undefined;

export function setApplicationMainFile(applicationMainFile: string) {
    gApplicationMainFile = applicationMainFile;
    gCodeSourceDirHint = jk_fs.dirname(applicationMainFile);
}

export function getApplicationMainFile(): string|undefined {
    return gApplicationMainFile;
}

export function getCodeSourceDirHint() {
    if (!gCodeSourceDirHint) return process.cwd();
    return gCodeSourceDirHint;
}

export function getSourceCodeDir(): string {
    if (gSourceCodeDir) return gSourceCodeDir;

    let pkgJsonPath = findRequiredPackageJson();
    let dirName = jk_fs.join(jk_fs.dirname(pkgJsonPath), "src");

    if (jk_fs.isDirectorySync(dirName)) {
        return gSourceCodeDir = dirName;
    }

    return gSourceCodeDir = jk_fs.dirname(pkgJsonPath);
}

export function getCompiledCodeDir(): string {
    if (gCompiledSourcesDir) return gCompiledSourcesDir;
    const sourceCodeDir = getSourceCodeDir();

    if (!sourceCodeDir.endsWith("src")) {
        return gCompiledSourcesDir = sourceCodeDir;
    }

    // This means that it's Bun.js, and it directly uses the TypeScript version.
    if (gApplicationMainFile && isBunJS && gApplicationMainFile.startsWith(sourceCodeDir)) {
        return gCompiledSourcesDir = sourceCodeDir;
    }

    let pkgJsonPath = findRequiredPackageJson();

    let rootDir = jk_fs.dirname(pkgJsonPath);

    for (let toTest of ["dist", "build", "out"]) {
        if (jk_fs.isDirectorySync(jk_fs.join(rootDir, toTest))) {
            return gCompiledSourcesDir = jk_fs.join(rootDir, toTest);
        }
    }

    // No output dir? Assume we compiled on the same dir.
    return rootDir;
}

export function toSourceCodeDir(itemPath: string): string {
    const compiledDir = getCompiledCodeDir();

    if (itemPath.startsWith(compiledDir)) {
        return getSourceCodeDir() + itemPath.substring(compiledDir.length);
    }

    return itemPath;
}

export function getCompiledFilePathFor(sourceFilePath: string, replaceExtension = true): string {
    const compiledCodeDir = getCompiledCodeDir();
    const sourceCodeDir = getSourceCodeDir();

    if (!sourceFilePath.startsWith(sourceCodeDir)) {
        return sourceFilePath;
    }

    let filePath = sourceFilePath.substring(sourceCodeDir.length);

    if (replaceExtension && !filePath.endsWith(".js")) {
        let idx = filePath.lastIndexOf(".");
        let ext = filePath.substring(idx);

        // This avoid case where there is no extension but a punct in the name.
        // Ex: importing "@/lib/jopijs.menu.getManager"
        //
        if ((ext === ".ts") || (ext === ".tsx")) {
            filePath = filePath.substring(0, idx) + ".js";
        }
    }

    return jk_fs.join(compiledCodeDir, filePath);
}

export function getSourcesCodePathFor(compiledFilePath: string): string {
    const compiledCodeDir = getCompiledCodeDir();
    const sourceCodeDir = getSourceCodeDir();

    if (!compiledFilePath.startsWith(compiledCodeDir)) {
        return compiledCodeDir;
    }

    let filePath =  jk_fs.join(sourceCodeDir, compiledFilePath.substring(compiledCodeDir.length));

    let idx = filePath.lastIndexOf(".");
    if (idx !== -1) filePath = filePath.substring(0, idx);

    if (jk_fs.isFileSync(filePath + ".tsx")) {
        return filePath + ".tsx";
    }

    if (jk_fs.isFileSync(filePath + ".ts")) {
        return filePath + ".ts";
    }

    return filePath + ".js";
}

export function requireSourceOf(scriptPath: string): string {
    let src = searchSourceOf(scriptPath);
    if (!src) throw new Error("Cannot find source of " + scriptPath);
    return src;
}

/**
 * Search the source of the component if it's a JavaScript and not a TypeScript.
 * Why? Because EsBuild doesn't work well on already transpiled code.
 */
export function searchSourceOf(scriptPath: string): string|undefined {
    function tryResolve(filePath: string, outDir: string) {
        let out = jk_fs.sep + outDir + jk_fs.sep;
        let idx = filePath.lastIndexOf(out);

        if (idx !== -1) {
            filePath = filePath.slice(0, idx) + jk_fs.sep + "src" + jk_fs.sep + filePath.slice(idx + out.length);
            if (jk_fs.isFileSync(filePath)) return filePath;
        }

        return undefined;
    }

    let scriptExt = jk_fs.extname(scriptPath);

    if ((scriptExt===".ts") || (scriptExt===".tsx")) {
        // Is already the source.
        return scriptPath;
    }

    const originalScriptPath = scriptPath;
    let isJavascript = (scriptPath.endsWith(".js")||(scriptPath.endsWith(".jsx")));

    if (isJavascript) {
        // Remove his extension.
        scriptPath = scriptPath.slice(0, -scriptExt.length);
    }

    let tryDirs = ["dist", "build"];

    for (let toTry of tryDirs) {
        if (isJavascript) {
            let found = tryResolve(scriptPath + ".tsx", toTry);
            if (found) return found;

            found = tryResolve(scriptPath + ".ts", toTry);
            if (found) return found;
        } else {
            let found = tryResolve(scriptPath, toTry);
            if (found) return found;
        }
    }

    return originalScriptPath;
}

let gSourceCodeDir: string|undefined;
let gCodeSourceDirHint: string|undefined;
let gApplicationMainFile: string|undefined;
let gCompiledSourcesDir: string|undefined;

//endregion