export function generateUUIDv4(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function isUUIDv4(text: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text);
}

export function getErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    return "" + e;
}

export function applyDefaults<T>(source: T|undefined, defaults: T): T {
    if (!source) source = {} as T;
    return {...defaults, ...source};
}

/**
 * Allow knowing the file path of the function calling us.
 */
export function getCallerFilePath(): string|undefined {
    try {
        throw new Error("");
    } catch (e: any) {
        let error: Error = e;

        if (!error.stack) return undefined;

        const stackLines = error.stack.split('\n');
        if (stackLines.length < 4) return undefined;

        // Here we have something like:
        // at file:///Users/johan/Projets/jopijs-workspace/__tests/jopi-ui-sample/dist/mod_sample/routes/tests/test3.page.js:4:1
        //
        let fileUrl = stackLines[3].trim();

        let idx = fileUrl.indexOf("file://");
        fileUrl = fileUrl.substring(idx);

        idx = fileUrl.lastIndexOf(":");
        fileUrl = fileUrl.substring(0, idx);

        idx = fileUrl.lastIndexOf(":");
        if (idx!==-1) fileUrl = fileUrl.substring(0, idx);

        return fileUrl;
    }
}

export enum PriorityLevel {
    veryLow = -200,
    low = -100,
    default = 0,
    high = 100,
    veryHigh = 200,
}

export interface ValueWithPriority<T> {
    value: T;
    priority: PriorityLevel;
}

/**
 * Sorts a list of items based on their priority level in ascending order.
 * Items with lower priority values (e.g., -200) will appear first in the returned array.
 * @param values The list of items to sort, each containing a value and a priority.
 * @returns An array of just the values, sorted by priority. Returns undefined if the input is undefined.
 */
export function sortByPriority<T>(values: undefined|ValueWithPriority<T>[]): undefined|(T[]) {
    if (values === undefined) return undefined;

    values.sort((a, b) => {
        if (a.priority < b.priority) return -1;
        if (a.priority > b.priority) return 1;
        return 0;
    });

    return values.map(v => v.value);
}

/**
 * Allows avoiding calling a function before n-milliseconds is elapsed.
 */
export class DontCallBeforeElapsed {
    private lastTime = 0;

    constructor(public readonly requireMs = 1000) {
    }

    check(): boolean {
        let now = Date.now();
        if (now-this.lastTime<this.requireMs) return false;
        this.lastTime = now;
        return true;
    }
}