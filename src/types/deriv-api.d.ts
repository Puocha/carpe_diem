declare module '@deriv/deriv-api/dist/DerivAPIBasic' {
  interface ConnectionOptions {
    connection: WebSocket;
  }

  export default class DerivAPIBasic {
    constructor(options: ConnectionOptions);
    authorize(token: string): Promise<any>;
    send(request: any): Promise<any>;
    balance(request: { account: string }): Promise<any>;
    residence_list(): Promise<any>;
    disconnect(): void;
    ping(): Promise<any>;
    subscribe(request: any): any;
  }
} 