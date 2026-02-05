import type { JDataReadResult, JRowArrayFilter } from "./interfaces.ts";

//region Rows Arrays

/**
 * Filter the row content according to rules.
 */
export function simpleRowArrayFilter(rows: any[], params: JRowArrayFilter): JDataReadResult {
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
