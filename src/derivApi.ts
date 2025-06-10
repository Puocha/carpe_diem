import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';

const APP_ID = '71979'; // Your Deriv App ID
const RECONNECT_INTERVAL = 1000; // 1 second
const PING_INTERVAL = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

interface Account {
  loginid: string;
  currency: string;
  balance: number;
  is_virtual: 0 | 1;
}

class DerivApiService {
  private api!: DerivAPIBasic;
  private connection!: WebSocket;
  private token: string | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isConnected: boolean = false;
  private authorizationPromise: Promise<any> | null = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.isConnecting) {
      console.log('Connection attempt already in progress. Skipping new connection.');
      return;
    }

    if (this.connection && (this.connection.readyState === WebSocket.OPEN || this.connection.readyState === WebSocket.CONNECTING)) {
      console.log('Connection already open or connecting. Skipping new connection.');
      return;
    }

    this.isConnecting = true;
    console.log('Attempting to establish Deriv WebSocket connection...');
    
    try {
      this.connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
      this.api = new DerivAPIBasic({ connection: this.connection });

      this.connection.onopen = async () => {
        console.log('Deriv WebSocket connection established.');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }

        if (this.token) {
          await this.authorize();
        }
      };

      this.connection.onclose = (event) => {
        console.log(`Deriv WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        this.isConnected = false;
        this.isConnecting = false;
        
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = null;
        }

        if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          if (!this.reconnectTimeout) {
            this.reconnectTimeout = setTimeout(() => this.connect(), RECONNECT_INTERVAL);
          }
        } else {
          console.error('Max reconnection attempts reached. Please refresh the page.');
        }
      };

      this.connection.onerror = (error) => {
        console.error('Deriv WebSocket error:', error);
        this.isConnected = false;
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.isConnecting = false;
    }
  }

  public setToken(token: string) {
    if (this.token === token) return;

    this.token = token;
    if (this.isConnected) {
      this.authorize();
    }
  }

  private async authorize(): Promise<any> {
    if (!this.token) {
      console.warn('No token available for authorization. Skipping authorization.');
      this.authorizationPromise = null;
      return null;
    }

    if (this.authorizationPromise) {
      console.log('Authorization already in progress. Awaiting existing promise.');
      return this.authorizationPromise;
    }
    
    console.log('Starting authorization with token...');
    this.authorizationPromise = new Promise(async (resolve, reject) => {
      try {
        const response = await this.api.authorize(this.token!);
        console.log('Authorization successful:', response);

        if (this.pingTimer) {
          clearInterval(this.pingTimer);
        }
        
        this.pingTimer = setInterval(() => {
          if (this.connection.readyState === WebSocket.OPEN) {
            this.api.ping().catch(error => {
              console.error('Ping failed:', error);
              if (this.pingTimer) {
                clearInterval(this.pingTimer);
                this.pingTimer = null;
              }
            });
          }
        }, PING_INTERVAL);

        resolve(response);
      } catch (error) {
        console.error('Authorization failed:', error);
        this.isConnected = false;
        reject(error);
      } finally {
        this.authorizationPromise = null;
      }
    });

    return this.authorizationPromise;
  }

  public async getAccountDetails(): Promise<Account[]> {
    if (!this.token) {
      console.warn('Cannot get account details: no token available.');
      return [];
    }

    try {
      // Wait for connection and authorization
      if (!this.isConnected) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 10000);

          const checkConnection = setInterval(() => {
            if (this.isConnected) {
              clearInterval(checkConnection);
              clearTimeout(timeout);
              resolve();
            }
          }, 100);
        });
      }

      if (this.authorizationPromise) {
        await this.authorizationPromise;
      } else if (this.token) {
        await this.authorize();
      }

      const accountListResponse = await this.api.send({
        "account_list": 1
      });
      console.log('Account list response:', accountListResponse);

      const accounts: Account[] = accountListResponse.account_list.map((acc: any) => ({
        loginid: acc.loginid,
        currency: acc.currency,
        balance: 0,
        is_virtual: acc.is_virtual
      }));

      const accountsWithBalances: Account[] = [];
      for (const account of accounts) {
        try {
          const balanceResponse = await this.api.balance({ account: account.loginid });
          accountsWithBalances.push({
            ...account,
            balance: balanceResponse.balance.balance
          });
        } catch (error) {
          console.error(`Error fetching balance for account ${account.loginid}:`, error);
          accountsWithBalances.push(account);
        }
      }
      
      return accountsWithBalances;

    } catch (error) {
      console.error('Error fetching account details:', error);
      throw error;
    }
  }

  public async switchAccount(loginid: string): Promise<any> {
    if (!this.token) {
      throw new Error('Cannot switch account: no token available.');
    }

    try {
      const switchResponse = await this.api.send({
        "switch_account": loginid
      });
      console.log('Switch account response:', switchResponse);

      if (switchResponse.authorize.token) {
        this.token = switchResponse.authorize.token;
        localStorage.setItem('deriv_token', switchResponse.authorize.token);
      }

      await this.authorize();
      return switchResponse;
    } catch (error) {
      console.error('Error switching account:', error);
      throw error;
    }
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.connection) {
      this.connection.close();
    }
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }
}

const derivApiService = new DerivApiService();
export default derivApiService; 