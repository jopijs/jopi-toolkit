// noinspection JSUnusedGlobalSymbols

import fs from "node:fs/promises";
import fss, {createReadStream} from "node:fs";
import {fileURLToPath as n_fileURLToPath, pathToFileURL as n_pathToFileURL } from "node:url";
import {lookup} from "mime-types";
import {Readable} from "node:stream";
import path from "node:path";
import {createHash} from "node:crypto";
import {isBunJS} from "jopi-toolkit/jk_what";
import type {DirItem, FileState} from "./common.ts";
import AdmZip from 'adm-zip';

class WebToNodeReadableStreamAdapter extends Readable {
    private webStreamReader: ReadableStreamDefaultReader<any>;

    constructor(webStream: ReadableStream<any>) {
        super();
        this.webStreamReader = webStream.getReader();
    }

    _read() {
        this.webStreamReader.read().then(({ done, value }) => {
            if (done) {this.push(null); return; }
            const buffer = Buffer.from(value);
            if (!this.push(buffer)) this.webStreamReader.cancel().then();
        }).catch(err => {
            this.destroy(err);
        });
    }

    _destroy(err: Error | null, callback: (error?: Error | null) => void): void {
        this.webStreamReader.cancel().finally(() => { callback(err) });
    }
}

async function writeResponseToFile_node(response: Response, filePath: string, createDir: boolean = true) {
    if (createDir) await mkDir(path.dirname(filePath));
    const bufferDonnees = await response.arrayBuffer();
    const bufferNode = Buffer.from(bufferDonnees);
    await fs.writeFile(filePath, bufferNode);
}

export const writeResponseToFile = isBunJS
    ? async (r: Response, p: string) => { await Bun.file(p).write(r); }
    : writeResponseToFile_node;

export function nodeStreamToWebStream(nodeStream: Readable, debugInfos?: string): ReadableStream {
    let dataListener: (chunk: Buffer) => void;
    let endListener: () => void;
    let errorListener: (err: Error) => void;

    return new ReadableStream({
        start(controller) {
            dataListener = (chunk: Buffer) => {
                try {
                    controller.enqueue(chunk);
                } catch (e) {
                    if (debugInfos) {
                        console.log("nodeStreamToWebStream - enqueue failed for " + debugInfos, e);
                    }

                    nodeStream.destroy(new Error("WebStream controller closed unexpectedly"));
                    nodeStream.off('data', dataListener);
                    nodeStream.off('end', endListener);
                    nodeStream.off('error', errorListener);
                }
            };

            endListener = () => {
                try {
                    controller.close();
                } catch (e) {
                    if (debugInfos) {
                        console.log("nodeStreamToWebStream - close failed for " + debugInfos, e);
                    }
                }
            };

            errorListener = (err: Error) => {
                controller.error(err);
                nodeStream.off('data', dataListener);
                nodeStream.off('end', endListener);
            };

            nodeStream.on('data', dataListener);
            nodeStream.on('end', endListener);
            nodeStream.on('error', errorListener);
        },

        cancel(reason) {
            if (debugInfos) {
                console.log(`nodeStreamToWebStream - stream cancelled for ${debugInfos}. Reason: ${reason || 'Client disconnected'}`,);
            }

            if (dataListener) nodeStream.off('data', dataListener);
            if (endListener) nodeStream.off('end', endListener);
            if (errorListener) nodeStream.off('error', errorListener);

            if (typeof nodeStream.destroy === 'function') {
                nodeStream.destroy();
            }
        }
    });
}

export function webStreamToNodeStream(webStream: ReadableStream): Readable {
    return new WebToNodeReadableStreamAdapter(webStream);
}

function createResponseFromFile_node(filePath: string, status: number = 200, headers?: {[key: string]: string}|Headers): Response {
    const nodeReadStream = createReadStream(filePath);
    const webReadableStream = nodeStreamToWebStream(nodeReadStream, filePath);
    return new Response(webReadableStream, {status: status, headers: headers});
}

export const createResponseFromFile = isBunJS
    ? (filePath: string, status: number = 200, headers?: {[key: string]: string}|Headers) => new Response(Bun.file(filePath), {status, headers})
    : createResponseFromFile_node;

export async function getFileSize(filePath: string): Promise<number> {
    try { return (await fs.stat(filePath)).size; }
    catch { return 0; }
}

export async function getFileStat(filePath: string): Promise<FileState|undefined> {
    try { return await fs.stat(filePath); }
    catch { return undefined; }
}

export function getMimeTypeFromName(fileName: string) {
    const found = lookup(fileName);
    if (found===false) return "";
    return found;
}

export async function mkDir(dirPath: string): Promise<boolean> {
    try {
        await fs.mkdir(dirPath, {recursive: true});
        return true;
    }
    catch {
        return false;
    }
}

export async function rmDir(dirPath: string): Promise<boolean> {
    try {
        await fs.rm(dirPath, {recursive: true, force: true});
        return true;
    }
    catch {
        return false;
    }
}

export const fileURLToPath = isBunJS
    ? (url: string) => Bun.fileURLToPath(url)
    : n_fileURLToPath;

export const pathToFileURL = isBunJS
    ? (fsPath: string) => Bun.pathToFileURL(fsPath)
    : n_pathToFileURL;

export async function unlink(filePath: string): Promise<boolean> {
    try { await fs.unlink(filePath); return true; }
    catch { return false; }
}

export async function writeTextToFile(filePath: string, text: string, createDir: boolean = true): Promise<void> {
    if (createDir) await mkDir(path.dirname(filePath));
    await fs.writeFile(filePath, text, {encoding: 'utf8', flag: 'w'});
}

export async function appendTextToFile(filePath: string, text: string): Promise<void> {
    try {
        await fs.appendFile(filePath, text, {encoding: 'utf8'});
    } catch {
        await mkDir(path.dirname(filePath));
        await fs.appendFile(filePath, text, {encoding: 'utf8'});
    }
}

export function writeTextToFileSync(filePath: string, text: string, createDir: boolean = true): void {
    if (createDir) {
        try {
            fss.mkdirSync(path.dirname(filePath), {recursive: true});
        } catch {}
    }
    fss.writeFileSync(filePath, text, {encoding: 'utf8', flag: 'w'});
}

export async function readTextFromFile(filePath: string, throwError: boolean = false): Promise<string> {
    if (throwError) {
        return fs.readFile(filePath, 'utf8');
    }

    try {
        return await fs.readFile(filePath, 'utf8');
    }
    catch {
        // @ts-ignore
        return undefined;
    }
}

export function readTextFromFileSync(filePath: string, throwError: boolean = false): string {
    if (throwError) {
        return fss.readFileSync(filePath, 'utf8');
    }

    try {
        return fss.readFileSync(filePath, 'utf8');
    }
    catch {
        // @ts-ignore
        return undefined;
    }
}

export async function readJsonFromFile<T = any>(filePath: string, throwError: boolean = false): Promise<T> {
    if (throwError) {
        let txt = await readTextFromFile(filePath, true);
        return JSON.parse(txt) as T;
    } else {
        try {
            let txt = await readTextFromFile(filePath);
            return JSON.parse(txt) as T;
        }
        catch {
            // @ts-ignore
            return undefined;
        }
    }
}

export function readJsonFromFileSync<T = any>(filePath: string, throwError: boolean = false): T {
    if (throwError) {
        let txt = readTextFromFileSync(filePath);
        return JSON.parse(txt) as T;
    } else {
        try {
            let txt = readTextFromFileSync(filePath);
            return JSON.parse(txt) as T;
        }
        catch {
            // @ts-ignore
            return undefined;
        }
    }
}

export async function isFile(filePath: string): Promise<boolean> {
    const stats = await getFileStat(filePath);
    if (!stats) return false;
    return stats.isFile();
}

export async function isDirectory(filePath: string): Promise<boolean> {
    const stats = await getFileStat(filePath);
    if (!stats) return false;
    return stats.isDirectory();
}

export function isDirectorySync(dirPath: string) {
    try {
        const stats = fss.statSync(dirPath);
        return stats.isDirectory();
    }
    catch {
    }

    return false;
}

export function isFileSync(dirPath: string) {
    try {
        const stats = fss.statSync(dirPath);
        return stats.isFile();
    }
    catch {
    }

    return false;
}

async function readFileToBytes_node(filePath: string): Promise<Uint8Array> {
    const buffer = await fs.readFile(filePath);
    return new Uint8Array(buffer);
}

export const readFileToBytes = isBunJS
    ? async (filePath: string) => Bun.file(filePath).bytes()
    : readFileToBytes_node

export function getRelativePath(fromDir: string, absolutePath: string) {
    return path.relative(fromDir, absolutePath);
}

export function dirItemFromFile(filePath: string): DirItem {
    return {
        name: basename(filePath),
        fullPath: filePath,
        isFile: true, isDirectory: false, isSymbolicLink: false
    }
}

export function dirItemFromDir(dirPath: string): DirItem {
    return {
        name: basename(dirPath),
        fullPath: dirPath,
        isFile: false, isDirectory: true, isSymbolicLink: false
    }
}

export async function listDir(dirPath: string): Promise<DirItem[]> {
    if (!await isDirectory(dirPath)) return [];

    const ditItems = await fs.readdir(dirPath);
    const result: DirItem[] = [];

    for (const dirItem of ditItems) {
        let toAdd: DirItem = {
            name: dirItem,
            fullPath: path.join(dirPath, dirItem),
            isFile: false, isDirectory: false, isSymbolicLink: false
        };

        const stats = await fs.stat(toAdd.fullPath);

        if (stats.isFile()) {
            toAdd.isFile = true;
            toAdd.isDirectory = false;
            toAdd.isSymbolicLink = false;
        } else if (stats.isDirectory()) {
            toAdd.isDirectory = true;
            toAdd.isFile = false;
            toAdd.isSymbolicLink = false;
        } else if (stats.isSymbolicLink()) {
            toAdd.isSymbolicLink = true;
            toAdd.isDirectory = false;
            toAdd.isFile = false;
        } else {
            continue;
        }

        result.push(toAdd);
    }

    return result;
}

const MEGA = 1024 * 1024;

async function calcFileHash_bun(filePath: string): Promise<string|undefined> {
    const file = Bun.file(filePath);
    if (!await file.exists()) return undefined;

    if (file.size>10 * MEGA) {
        return calcFileHash_bun_streamed(file)
    }

    return Bun.hash(await file.arrayBuffer(), 12346).toString();
}

async function calcFileHash_bun_streamed(file: Bun.BunFile): Promise<string|undefined> {
    const stream = file.stream();
    const reader = stream.getReader();
    const hasher = new Bun.CryptoHasher("sha256");

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            hasher.update(value);
        }

        return hasher.digest("hex");
    } finally {
        reader.releaseLock();
    }
}

function calcFileHash_node(filePath: string): Promise<string|undefined> {
    if (!isFile(filePath)) return Promise.resolve(undefined);

    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (error) => reject(error));
    });
}

/**
 * Calculate the hash of a file.
 * Allows using it for HTTP ETag or another change proof.
 * This version is optimized to use streams and avoid loading the whole file in memory.
 */
export const calcFileHash = isBunJS ? calcFileHash_bun : calcFileHash_node;

/**
 * Convert a simple win32 path to a linux path.
 */
export function win32ToLinuxPath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

/**
 * Copy a directory recursively.
 * Is optimized for large files.
 */
export async function copyDirectory(srcDir: string, destDir: string): Promise<void> {
    if (!await isDirectory(srcDir)) {
        throw new Error(`Directory doesn't exist : ${srcDir}`);
    }

    await mkDir(destDir);
    const entries = await fs.readdir(srcDir, { withFileTypes: true });

    await Promise.all(entries.map(async (entry) => {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            try {
                await copyFile(srcPath, destPath);
            } catch {
                console.warn(`jk_fs.copyDirectory - Failed to copy file ${srcPath}`);
            }
        }
    }));
}

/**
 * Copy of a file.
 * Is optimized for large files.
 */
export async function copyFile(srcPath: string, destPath: string): Promise<void> {
    /*let stat = await getFileStat(srcPath);
    if (!stat) return;

    // Assert the symlink exist.
    if (stat.isSymbolicLink()) {
        const symStat = await fs.lstat(srcPath);
        if (!symStat) return;
        if (!symStat.isFile()) return;
    }

    return new Promise<void>((resolve, reject) => {
        const readStream = createReadStream(srcPath);
        const writeStream = createWriteStream(destPath);

        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);

        readStream.pipe(writeStream);
    });*/

    // > Impl compatible with a Windows bug.
    
    const stat = await getFileStat(srcPath);
    if (!stat) return;
    await fs.copyFile(srcPath, destPath);
}

/**
 * Unzip a .zip file in an optimized way.
 * Note was using : "@types/unzipper": "^0.10.11"
 * which has some bug, files/folders was forgottens.
 * import * as unzipper from "unzipper";
 */
/*export async function unzipFile_old(zipFilePath: string, outputDir: string): Promise<void> {
    if (!await isFile(zipFilePath)) {
        throw new Error(`File doesn't exist : ${zipFilePath}`);
    }

    if (!await isDirectory(outputDir)) {
        await mkDir(outputDir);
    }

    await createReadStream(zipFilePath)
        .pipe(unzipper.Extract({path: outputDir}))
        .promise();
}*/

/**
 * Unzip a .zip file in an optimized way.
 */
export async function unzipFile(zipFilePath: string, outputDir: string): Promise<void> {
    if (!await isFile(zipFilePath)) {
        throw new Error(`File doesn't exist : ${zipFilePath}`);
    }

    if (!await isDirectory(outputDir)) {
        await mkDir(outputDir);
    }

    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(outputDir, true);
}

/**
 * Create a temporary directory.
 * Return an object containing the directory path and a cleanup function.
 */
export async function createTempDir(prefix: string): Promise<{path: string, remove: ()=>Promise<void>}> {
    const dirPath = await fs.mkdtemp(prefix);

    return {
        path: dirPath,
        remove: async () => {
            return fs.rm(dirPath, {recursive: true, force: true});
        }
    }
}

//region Node.js functions

export const join = path.join;
export const resolve = path.resolve;
export const dirname = path.dirname;
export const extname = path.extname;
export const relative = path.relative;

export const sep = path.sep;
export const isAbsolute = path.isAbsolute;
export const normalize = path.normalize;
export const basename = path.basename;

export const symlink = fs.symlink;
export const rename = fs.rename;

//endregion