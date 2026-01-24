import type { IActionContext, JopiTableBrowserActions, JDataReadParams, JDataReadResult, JDataTable } from "./interfaces.ts";
import { schema, type Schema } from "jopi-toolkit/jk_schema";

export interface ProxyParams {
    name: string;
    apiUrl: string;
    schema: { meta: any; desc: any; };
}

export class Proxy implements JDataTable {
    readonly name: string;
    readonly schema: Schema;
    private readonly url: string;
    readonly browserActions: JopiTableBrowserActions;
    readonly checkRoles?: (action: string, userRoles: string[]) => boolean;
    
    constructor(params: ProxyParams, browserActions: JopiTableBrowserActions) {
        this.name = params.name;
        this.url = params.apiUrl;
        this.schema = schema(params.schema.desc, params.schema.meta);
        this.browserActions = browserActions;
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
        let actionEntry = this.browserActions[actionName];
        if (!actionEntry) return;

        if (actionEntry.pre) {
            let res = await actionEntry.pre({ rows });

            if (res) {
                if (res.rows !== undefined) rows = res.rows;
            }
        }

        //if (actionEntry.hasServerAction) {
            // TODO
        //}

        if (actionEntry.post) {
            await actionEntry.post({ rows, context });
        }
    }
}

export function toDataTableProxy(params: ProxyParams, browserActions: JopiTableBrowserActions): JDataTable {
    return new Proxy(params, browserActions);
}