import {type Schema} from "jopi-toolkit/jk_schema";

//region Rows Arrays

export interface JFieldSorting {
    id: string;
    desc: boolean;
}

export interface JFieldFilter {
    value?: string | number | boolean;
    constraint: JFieldConstraintType;
    caseSensitive?: boolean;
}

export type JFieldConstraintType =
    | "$eq"    // Equals
    | "$ne"    // Not equals
    | "$gt"    // Greater than
    | "$gte"   // Greater than or equals
    | "$lt"    // Less than
    | "$lte"   // Less than or equals
    | "$in"    // In an array of values
    | "$nin"   // Not in an array of values
    | "$like"  // Like search %endsWith or startsWith%

export interface JRowsFilter {
    field?: string;
    value: string;
}

export interface JPageExtraction {
    pageIndex: number;
    pageSize: number;
}

export interface JRowArrayFilter {
    page?: JPageExtraction;
    filter?: JRowsFilter;
    sorting?: JFieldSorting[];
    fieldFilters?: Record<string, JFieldFilter[]>;
}

/**
 * Filter the row content according to rules.
 */
function simpleRowArrayFilter(rows: any[], params: JRowArrayFilter): JNamedTableReader_ReadResult {
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

//region JNamedTableReader

export interface JNamedTableReader_ReadParams extends JRowArrayFilter {
}

export interface JNamedTableReader_ReadResult {
    rows: any[];
    total?: number;
    offset?: number;
}

export interface JTableReader {
    get schema(): Schema;
    read(params: JNamedTableReader_ReadParams): Promise<JNamedTableReader_ReadResult>;
}

export interface JNamedTableReader extends JTableReader {
    get name(): string;
}

export class JTableReader_UseArray implements JTableReader {
    public constructor(public readonly schema: Schema, private readonly rows: any[]) {
    }

    async read(params: JNamedTableReader_ReadParams): Promise<JNamedTableReader_ReadResult> {
        return simpleRowArrayFilter(this.rows, params);
    }
}

export class JNamedTableReader_HttpProxy implements JNamedTableReader {
    public constructor(public readonly name: string, private readonly url: string, public readonly schema: Schema) {
    }

    async read(params: JNamedTableReader_ReadParams): Promise<JNamedTableReader_ReadResult> {
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
        return asJson as JNamedTableReader_ReadResult;
    }
}

//endregion
