import { type Schema } from "jopi-toolkit/jk_schema";

export interface JFieldSorting {
    id: string;
    desc: boolean;
}

export interface IActionContext {
    refresh: () => void;
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
    ;

export interface JGlobalFilter {
    field?: string;
    value: string;
}

export interface JPageExtraction {
    pageIndex: number;
    pageSize: number;
}

export interface JRowArrayFilter {
    page?: JPageExtraction;
    filter?: JGlobalFilter;
    sorting?: JFieldSorting[];
    fieldFilters?: Record<string, JFieldFilter[]>;
}

export interface JDataReadParams extends JRowArrayFilter {
}

export interface JDataReadResult {
    rows: any[];
    total?: number;
    offset?: number;
}

export interface JActionDef {
    id: string;
    lang: Record<string, string>;
}

export interface JopiDataTable {
    readonly schema: Schema;
    readonly actions?: JActionDef[];
    read(params: JDataReadParams): Promise<JDataReadResult>;
}

export interface JDataTable extends JopiDataTable {
    readonly name: string;
    executeAction?: (rows: any[], actionName: string, context?: IActionContext) => Promise<JActionResult|void>
}

export interface JActionPreProcessParams {
    rows: any[];
    context?: IActionContext;
}

export interface JActionResult {
    isOk?: boolean;
    errorCode?: string;
    errorMessage?: string;
    userMessage?: string;
    data?: any;
}

export interface JActionPreProcessResult extends JActionResult {
    rows?: any[];
}

export interface JActionPostProcessParams {
    rows: any[];
    context?: IActionContext;
    
    data?: any[];
    userMessage?: string;
}

export type JopiTableBrowserActions = Record<string, {
    onError?: (params: JActionResult) => Promise<void>,
    action?: (params: JActionPreProcessParams) => Promise<JActionPreProcessResult|void>,
    afterServerCall?: (params: JActionPostProcessParams) => Promise<void>;
    disableServerCall?: boolean;
}>