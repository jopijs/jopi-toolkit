// noinspection JSUnusedGlobalSymbols

import * as jk_terms from "jopi-toolkit/jk_term";
import {init} from "./jBundler_ifServer.ts";

//region Common

export interface LogEntry {
    level: LogLevel;
    logger: string;

    date: number;
    title?: string;
    data?: any;

    timeDif?: number;
}

export type LogEntryFormater = (entry: LogEntry) => string;

export enum LogLevel {
    SPAM = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    NONE = 10
}

export type LogCall = string | ((w: LogLevelHandler)=>void);

//endregion

//region Formater

const RED = jk_terms.C_RED;
const ORANGE = jk_terms.C_ORANGE;
const GREY = jk_terms.C_GREY;
const LIGHT_BLUE = jk_terms.C_LIGHT_BLUE;
const RESET = jk_terms.T_RESET;

export function formatDate1(timeStamp: number): string {
    const date = new Date(timeStamp);
    return date.toISOString();
}

export const formater_simpleJson: LogEntryFormater = (entry: LogEntry) => {
    return JSON.stringify(entry);
};

export const formater_dateTypeTitleSourceData: LogEntryFormater = (entry: LogEntry) => {
    const date = formatDate1(entry.date);

    let json = entry.data ? JSON.stringify(entry.data) : "";
    const title = String(entry.title || "").padEnd(50, " ");

    json = entry.logger + " |>" + json;

    switch (entry.level) {
        case LogLevel.ERROR:
            return `${date} - ERROR - ${title}${json}`;
        case LogLevel.WARN:
            return `${date} - WARN  - ${title}${json}`;
        case LogLevel.INFO:
            return `${date} - INFO  - ${title}${json}`;
        case LogLevel.SPAM:
            return `${date} - SPAM  - ${title}${json}`;
        default:
            return "";
    }
}

export const formater_typeTitleSourceData_colored: LogEntryFormater = (entry: LogEntry) => {
    let json = entry.data ? JSON.stringify(entry.data) : "";
    const title = String(entry.title || "").padEnd(50, " ");

    json = entry.timeDif === undefined
        ? `${entry.logger} ${json}` : `${entry.logger} (${entry.timeDif} ms) ${json}`;

    switch (entry.level) {
        case LogLevel.ERROR:
            return `${RED}error${RESET} - ${title}${GREY}${json}${RESET}`;
        case LogLevel.WARN:
            return `${ORANGE}warn ${RESET} - ${title}${GREY}${json}${RESET}`;
        case LogLevel.INFO:
            return `${LIGHT_BLUE}info ${RESET} - ${title}${GREY}${json}${RESET}`;
        case LogLevel.SPAM:
            return `${GREY}spam ${RESET} - ${title}${GREY}${json}${RESET}`;
        default:
            return "";
    }
}

//endregion

//region LogWriter

export interface LogWriter {
    addEntry(entry: LogEntry): void;
    addBatch(entries: LogEntry[]): void;
}

class ConsoleLogWriter implements LogWriter {
    constructor(private readonly formater: LogEntryFormater = gDefaultFormater) {
    }

    addEntry(entry: LogEntry): void {
        console.log(this.formater(entry));
    }

    addBatch(entries: LogEntry[]) {
        entries.forEach(e => this.addEntry(e));
    }
}

export class VoidLogWriter implements LogWriter {
    addBatch(_entries: LogEntry[]): void {
    }

    addEntry(_entry: LogEntry): void {
    }
}

export function setDefaultWriter(writer: LogWriter) {
    gDefaultWriter = writer;
}

export function getDefaultWriter(): LogWriter {
    return gDefaultWriter;
}

export function setDefaultFormater(formater: LogEntryFormater) {
    gDefaultFormater = formater;
}

export function getDefaultFormater(): LogEntryFormater {
    return gDefaultFormater;
}

let gDefaultFormater: LogEntryFormater = formater_typeTitleSourceData_colored;
let gDefaultWriter: LogWriter = new ConsoleLogWriter();

//endregion

//region JopiLogger

export interface Logger {
    get fullName(): string;

    spam(_l?: LogCall): boolean;
    info(_l?: LogCall): boolean;
    warn(_l?: LogCall): boolean;
    error(_l?: LogCall): boolean

    beginSpam(l: LogCall): LoggerGroupCallback;
    beginInfo(l: LogCall): LoggerGroupCallback;
}

export function getLogger(name: string, parent?: Logger): Logger {
    let fullName = name;
    if (parent) fullName = parent.fullName + '.' + name;

    let level = getLogLevelFor(fullName);

    switch (level) {
        case LogLevel.SPAM:
            return new Logger_Spam(parent as JopiLogger, name);
        case LogLevel.INFO:
            return new Logger_Info(parent as JopiLogger, name);
        case LogLevel.WARN:
            return new Logger_Warn(parent as JopiLogger, name);
        case LogLevel.ERROR:
            return new Logger_Error(parent as JopiLogger, name);
    }

    return new Logger_None(parent as JopiLogger, name);
}

abstract class JopiLogger implements Logger {
    public readonly fullName: string;
    private _onLog: LogWriter = gDefaultWriter;

    protected readonly hSpam: LogLevelHandler;
    protected readonly hInfo: LogLevelHandler;
    protected readonly hWarn: LogLevelHandler;
    protected readonly hError: LogLevelHandler;

    private timeDif?: number;
    private extraData?: any;

    constructor(parent: JopiLogger|null, public readonly name: string) {
        this.fullName = parent ? parent.fullName + '.' + name : name;

        if (parent) {
            this._onLog = parent._onLog;
        }

        const me = this;

        this.hSpam = (title?: string, data?: any) => {
            let td = this.timeDif;
            this.timeDif = undefined;
            data = this.mergeData(data);

            me._onLog.addEntry({
                level: LogLevel.SPAM,
                logger: me.fullName, date: Date.now(), title, data, timeDif: td });
        };

        this.hInfo = (title?: string, data?: any) => {
            let td = this.timeDif;
            this.timeDif = undefined;
            data = this.mergeData(data);

            me._onLog.addEntry({
                level: LogLevel.INFO,
                logger: me.fullName, date: Date.now(), title, data, timeDif: td });
        };

        this.hWarn = (title?: string, data?: any) => {
            let td = this.timeDif;
            this.timeDif = undefined;
            data = this.mergeData(data);

            me._onLog.addEntry({
                level: LogLevel.WARN,
                logger: me.fullName, date: Date.now(), title, data, timeDif: td });
        };

        this.hError = (title?: string, data?: any) => {
            let td = this.timeDif;
            this.timeDif = undefined;
            data = this.mergeData(data);

            me._onLog.addEntry({
                level: LogLevel.ERROR,
                logger: me.fullName, date: Date.now(), title, data, timeDif: td });
        };
    }

    private mergeData(data?: any): any|undefined {
        if (!this.extraData) return data;
        const extraData = this.extraData;
        this.extraData = undefined;

        if (!data) return extraData;
        for (let p in extraData) data[p] = extraData[p];

        return data;
    }

    setLogWriter(callback: LogWriter) {
        if (!callback) callback = gDefaultWriter;
        this._onLog = callback;
    }

    spam(_l?: (w: LogLevelHandler)=>void): boolean {
        return false;
    }

    info(_l?: (w: LogLevelHandler)=>void): boolean {
        return false;
    }

    warn(_l?: (w: LogLevelHandler)=>void) {
        return false;
    }

    error(_l?: (w: LogLevelHandler)=>void) {
        return false;
    }

    beginSpam(l: (w: LogLevelHandler)=>void): LoggerGroupCallback {
        return gVoidLoggerGroupCallback;
    }

    beginInfo(l: (w: LogLevelHandler)=>void): LoggerGroupCallback {
        return gVoidLoggerGroupCallback;
    }

    protected doBegin(l: LogCall, w: LogLevelHandler): LoggerGroupCallback {
        const startTime = Date.now();

        return (data?: any) => {
            this.timeDif = Date.now() - startTime;
            this.doCall(l, w, data);
        }
    }

    protected doCall(l: LogCall|undefined, w: LogLevelHandler, data?: any) {
        this.extraData = data;

        if (l) {
            if (l instanceof Function) {
                l(w);
            }
            else {
                w(l as string);
            }
        }

        return true;
    }
}

class Logger_None extends JopiLogger {
}

class Logger_Spam extends JopiLogger {
    override spam(l?: LogCall) {
        return this.doCall(l, this.hSpam);
    }

    override info(l?: LogCall) {
        return this.doCall(l, this.hInfo);
    }

    override warn(l?: LogCall) {
        return this.doCall(l, this.hWarn);
    }

    override error(l?: LogCall) {
        return this.doCall(l, this.hError);
    }

    override beginSpam(l: LogCall) {
        return this.doBegin(l, this.hSpam);
    }

    override beginInfo(l: LogCall): LoggerGroupCallback {
        return this.doBegin(l, this.hInfo);
    }
}

class Logger_Info extends JopiLogger {
    override info(l?: LogCall) {
        return this.doCall(l, this.hInfo);
    }

    override warn(l?: LogCall) {
        return this.doCall(l, this.hWarn);
    }

    override error(l?: LogCall) {
        return this.doCall(l, this.hError);
    }

    override beginInfo(l: LogCall): LoggerGroupCallback {
        return this.doBegin(l, this.hInfo);
    }
}

class Logger_Warn extends JopiLogger {
    override warn(l?: LogCall) {
        return this.doCall(l, this.hWarn);
    }

    override error(l?: LogCall) {
        return this.doCall(l, this.hError);
    }
}

class Logger_Error extends JopiLogger {
    override error(l?: LogCall) {
        return this.doCall(l, this.hError);
    }
}

export type LoggerGroupCallback = (data?: any) => void;
const gVoidLoggerGroupCallback = () => {};

//endregion

//region Log levels

type LogLevelHandler = (title?: string, data?: any|undefined)=>void;

function getLogLevelName(level: LogLevel) {
    switch (level) {
        case LogLevel.SPAM:
            return "SPAM";
        case LogLevel.ERROR:
            return "ERROR";
        case LogLevel.INFO:
            return "INFO";
        case LogLevel.WARN:
            return "WARN";
        case LogLevel.NONE:
            return "NONE";
    }
}

function getLogLevelByName(name: string): LogLevel | undefined {
    switch (name) {
        case "NONE": return LogLevel.NONE;
        case "SPAM": return LogLevel.SPAM;
        case "INFO": return LogLevel.INFO;
        case "WARN": return LogLevel.WARN;
        case "ERROR": return LogLevel.ERROR;
    }

    return undefined;
}

//endregion

//region Registry

export interface LogConfig {
    level?: string;
    writer?: string;
    formater?: string;
}

export interface LogInitializer {
    setLogLevel(name: string, config: LogConfig): void;
}

class Initializer implements LogInitializer {
    setLogLevel(name: string, config: LogConfig): void {
        let logLevel = getLogLevelByName(config.level || "NONE");
        if (!logLevel) logLevel = LogLevel.NONE;
        gRegistry[name] = logLevel;
    }
}

function getLogLevelFor(name: string) {
    let entry = gRegistry[name];
    if (entry!==undefined) return entry;

    for (let prefix in gRegistry) {
        if (name.startsWith(prefix + ".")) {
            return gRegistry[prefix];
        }
    }

    return gDefaultLogLevel;
}

const gDefaultLogLevel: LogLevel = LogLevel.WARN;
const gRegistry: Record<string, LogLevel> = {};

//endregion

init(new Initializer());