import type { JRowActionBase } from "./interfaces.ts";

export interface JActionServerParams {
    rows: any[];
}

export interface JActionServerResult {
    isOk: boolean;
    value?: any;
}

export interface JRowAction extends JRowActionBase {
    serverAction?: (params: JActionServerParams) => Promise<JActionServerResult | void>;
}