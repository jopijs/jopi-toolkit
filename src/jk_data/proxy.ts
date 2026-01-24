import type { IActionContext, JopiTableBrowserActions, JDataReadParams, JDataReadResult, JDataTable, JActionDef, JActionResult } from "./interfaces.ts";
import { schema, type Schema } from "jopi-toolkit/jk_schema";

export interface ProxyParams {
    name: string;
    apiUrl: string;
    actions?: JActionDef[];
    schema: { meta: any; desc: any; };
}

export class Proxy implements JDataTable {
    readonly name: string;
    readonly schema: Schema;
    readonly actions?: JActionDef[];
    private readonly url: string;

    readonly browserActions: JopiTableBrowserActions;
    
    constructor(params: ProxyParams, browserActions: JopiTableBrowserActions) {
        this.name = params.name;
        this.url = params.apiUrl;
        this.actions = params.actions;
        this.schema = schema(params.schema.desc, params.schema.meta);
        this.browserActions = browserActions;
    }

    async read(params: JDataReadParams): Promise<JDataReadResult> {
        const asJson = await this.callServer({ dsName: this.name, read: params });
        return asJson as JDataReadResult;
    }

    async executeAction(rows: any[], actionName: string, context?: IActionContext): Promise<JActionResult|void> {
        async function processError(res: JActionResult | undefined) {
            if (!res) return true;
            
            if (res.isOk===false||res.errorCode||res.errorMessage) {
                if (actionEntry.onError) {
                    await actionEntry.onError(res);
                    return false;
                }
            }
            
            return true;
        }

        let actionEntry = this.browserActions[actionName];
        if (!actionEntry) return;

        if (actionEntry.action) {
            let res = await actionEntry.action({ rows, context });

            if (res) {
                if (!processError(res)) return;

                if (res.rows !== undefined) {
                    rows = res.rows;
                }
            }
        }

        if (actionEntry.disableServerCall === true) {
            return;
        }
         
        let serverRes = await this.callServer({ action: actionName, rows });
        if (!processError(serverRes)) return;

        if (actionEntry.afterServerCall) {
            await actionEntry.afterServerCall({
                rows,
                context,
                data: serverRes?.data,
                userMessage: serverRes?.userMessage
            });
        }
    }

    async callServer(data: any): Promise<any> {
        debugger;

        let res = await fetch(this.url, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        });

        if (res.status !== 200) {
            throw new Error(`Error while calling data source "${this.name}"`);
        }

        return await res.json();
    }
}

export function toDataTableProxy(params: ProxyParams, browserActions: JopiTableBrowserActions): JDataTable {
    return new Proxy(params, browserActions);
}