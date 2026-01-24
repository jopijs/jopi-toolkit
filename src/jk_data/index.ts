import {type Schema, schema} from "jopi-toolkit/jk_schema";
import type { IActionContext, JDataBinding, JDataReadParams, JDataReadResult, JDataTable, JRowArrayFilter } from "./interfaces.ts";
import type { JRowAction } from "./jBundler_ifServer.ts";
export * from "./jBundler_ifServer.ts";
export * from "./interfaces.ts";

//region Rows Arrays

/**
 * Filter the row content according to rules.
 */
function simpleRowArrayFilter(rows: any[], params: JRowArrayFilter): JDataReadResult {
    // > Apply filter.

    if (params.filter) {
        const f = params.filter;

        rows = rows.filter(r => {
            if (f.field) {
                let v = r[f.field];
                if (v===undefined) return false;
                return String(v).includes(f.value);
            } else {
                for (let v of Object.values(r)) {
                    if (v===undefined) continue;
                    if (String(v).includes(f.value)) return true;
                }

                return false;
            }
        });
    }

    // > Apply sorting.

    if (params.sorting && params.sorting.length) {
        const sorting = params.sorting[0];
        const sortField = sorting.id;
        const sortDesc = sorting.desc;

        rows = rows.sort((a, b) => {
            let av = a[sortField];
            let bv = b[sortField];

            if (av === undefined) av = "";
            if (bv === undefined) bv = "";

            const avIsNumber = typeof av === "number";
            const bvIsNumber = typeof bv === "number";

            if (avIsNumber && bvIsNumber) {
                if (sortDesc) {
                    return bv - av;
                } else {
                    return av - bv;
                }
            } else {
                const avStr = String(av);
                const bvStr = String(bv);

                if (sortDesc) {
                    return bvStr.localeCompare(avStr);
                } else {
                    return avStr.localeCompare(bvStr);
                }
            }
        });
    }

    const totalWithoutPagination = rows.length;
    let offset = 0;

    if (params.page) {
        offset = params.page.pageIndex * params.page.pageSize;
        rows = rows.slice(offset, offset + params.page.pageSize);
    }

    return {rows, total: totalWithoutPagination, offset};
}

//endregion

//region JDataBinding

export class JDataBinding_UseArray implements JDataBinding {
    public constructor(public readonly schema: Schema, private readonly rows: any[]) {
    }

    async read(params: JDataReadParams): Promise<JDataReadResult> {
        return simpleRowArrayFilter(this.rows, params);
    }
}

export interface JDataBinding_HttpProxyParams {
    name: string;
    apiUrl: string;
    schema: { meta: any; desc: any; };
    rowActions?: JHttpRowAction[];
    checkRoles?: (action: string, userRoles: string[]) => boolean;
}

export interface JHttpRowAction extends Omit<JRowAction, "serverAction"> {
    hasServerAction: boolean;
}

export class JDataBinding_HttpProxy implements JDataTable {
    readonly name: string;
    readonly schema: Schema;
    private readonly url: string;
    readonly rowActions?: JHttpRowAction[];
    readonly checkRoles?: (action: string, userRoles: string[]) => boolean;
    
    public constructor(params: JDataBinding_HttpProxyParams) {
        this.name = params.name;
        this.url = params.apiUrl;
        this.schema = schema(params.schema.desc, params.schema.meta);
        this.rowActions = params.rowActions;
        this.checkRoles = params.checkRoles;
    }

    async read(params: JDataReadParams): Promise<JDataReadResult> {
        let toSend = {dsName: this.name, read: params};

        let res = await fetch(this.url, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(toSend)
        });

        if (res.status !== 200) {
            throw new Error(`Error while reading data source "${this.name}"`);
        }

        let asJson = await res.json();
        return asJson as JDataReadResult;
    }

    async executeAction(rows: any[], actionName: string, context: IActionContext) {
        let actionEntry = this.rowActions?.find(a => a.name === actionName);
        if (!actionEntry) return;

        if (actionEntry.preProcess) {
            let res = await actionEntry.preProcess?.({ rows });

            if (res) {
                if (res.rows !== undefined) rows = res.rows;
            }
        }

        if (actionEntry.hasServerAction) {
            // TODO
        }

        if (actionEntry.postProcess) {
            await actionEntry.postProcess?.({ rows, context });
        }
    }
}

//endregion
