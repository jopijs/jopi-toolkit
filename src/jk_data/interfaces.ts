import { type Schema } from "jopi-toolkit/jk_schema";
import type {Translatable} from "../jk_tools";

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
    | "$like";  // Like search %endsWith or startsWith%

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
    title?: Translatable;
    separator?: boolean;
}

export interface JopiDataTable {
    readonly schema: Schema;
    readonly actions?: JActionDef[];
    read(params: JDataReadParams): Promise<JDataReadResult>;
}

export interface JDataTable extends JopiDataTable {
    readonly name: string;
    executeAction?: (rows: any[], actionName: string, context?: IActionContext) => Promise<JActionResult | void>
    isActionEnabled?: (actionName: string, rows: any[], context?: IActionContext) => boolean;
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

/**
 * Defines the behavior of a custom action in the browser for a Jopi table.
 * allowing to hook into the action lifecycle (pre-process, server call, post-process).
 */
export interface JopiTableBrowserActionItem {
    /**
     * Callback invoked when an error occurs during the action execution.
     * This can be triggered by a failure in the `action` handler or a server-side error.
     */
    onError?: (params: JActionResult) => Promise<void>,

    /**
     * The main client-side action handler.
     * - Can be used to perform checks or data transformation before sending to the server.
     * - Can be used as a standalone action if `disableServerCall` is true.
     * - Return `void` to proceed with the default flow.
     * - Return a `JActionPreProcessResult` to control flow (e.g., stop execution if `isOk` is false) or modify data sent to server.
     */
    action?: (params: JActionPreProcessParams) => Promise<JActionPreProcessResult|void>,

    /**
     * Callback invoked after the server-side action has successfully completed.
     * Useful for showing notifications, refreshing data, or triggering other UI updates.
     */
    afterServerCall?: (params: JActionPostProcessParams) => Promise<void>;

    /**
     * Function to determine if the action should be enabled/clickable.
     * Based on the currently selected rows and the current action context.
     * If not provided, the action is assumed to be always enabled.
     */
    canEnable?: (rows: any[], context?: IActionContext) => boolean;

    /**
     * If set to true, the framework will NOT assume there is a corresponding server-side action to call.
     * Use this for actions that are purely client-side (e.g., "Copy to clipboard").
     */
    disableServerCall?: boolean;
}

export type JopiTableBrowserActions = Record<string, JopiTableBrowserActionItem>