/********************************************************************************
 * Copyright (C) 2019 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import URI from '../../common/uri';
import { injectable, inject, named } from 'inversify';
import { WebSocketChannel } from '../../common/messaging/web-socket-channel';
import { WebSocketConnectionProvider, WebSocketOptions } from '../../browser/messaging/ws-connection-provider';
import { FrontendApplicationContribution } from '../../browser/frontend-application';
import { ElectronSecurityToken } from '../../electron-common/electron-token';
import { DeferredSync } from '../../common/promise-util';

@injectable()
export class ElectronWebSocketConnectionProvider extends WebSocketConnectionProvider implements FrontendApplicationContribution {

    @inject(DeferredSync) @named(ElectronSecurityToken)
    protected readonly tokenRequest: DeferredSync<ElectronSecurityToken>;

    /**
     * Do not try to reconnect when the frontend application is stopping. The browser is navigating away from this page.
     */
    protected stopping = false;

    async configure(): Promise<void> {
        await this.tokenRequest.promise;
    }

    onStop(): void {
        this.stopping = true;
        // Close the websocket connection `onStop`. Otherwise, the channels will be closed with 30 sec (`MessagingContribution#checkAliveTimeout`) delay.
        // https://github.com/eclipse-theia/theia/issues/6499
        for (const channel of [...this.channels.values()]) {
            // `1001` indicates that an endpoint is "going away", such as a server going down or a browser having navigated away from a page.
            // But we cannot use `1001`: https://github.com/TypeFox/vscode-ws-jsonrpc/issues/15
            channel.close(1000, 'The frontend is "going away"...');
        }
    }

    openChannel(path: string, handler: (channel: WebSocketChannel) => void, options?: WebSocketOptions): void {
        if (!this.stopping) {
            super.openChannel(path, handler, options);
        }
    }

    protected createWebSocketUrl(path: string): string {
        const token = this.tokenRequest.value!;
        const uri = new URI(path);
        const query = uri.query.split('&');
        query.push(`${encodeURIComponent(ElectronSecurityToken)}=${encodeURIComponent(token.value)}`);
        return super.createWebSocketUrl(uri.withQuery(query.join('&')).toString());
    }

}
