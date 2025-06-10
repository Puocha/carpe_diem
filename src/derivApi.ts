import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';

const APP_ID = '71979'; // Your Deriv App ID
const RECONNECT_INTERVAL = 1000; // 1 second
const PING_INTERVAL = 30000; // 30 seconds

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
  private isConnected: boolean = false; // Track connection status
  private authorizationPromise: Promise<any> | null = null; // To track ongoing authorization

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.connection && (this.connection.readyState === WebSocket.OPEN || this.connection.readyState === WebSocket.CONNECTING)) {
        console.log('Connection already open or connecting. Skipping new connection.');
        return; // Already connected or connecting
    }
    console.log('Attempting to establish Deriv WebSocket connection...');
    this.connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
    this.api = new DerivAPIBasic({ connection: this.connection });

    this.connection.onopen = async () => {
      console.log('Deriv WebSocket connection established.');
      this.isConnected = true;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      // Attempt authorization if a token is available
      if (this.token) {
        await this.authorize();
      }
    };

    this.connection.onclose = (event) => {
      console.log(`Deriv WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      this.isConnected = false;
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      // Attempt to reconnect after a delay
      if (!this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(() => this.connect(), RECONNECT_INTERVAL);
      }
    };

    this.connection.onerror = (error) => {
      console.error('Deriv WebSocket error:', error);
      this.isConnected = false;
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      // Attempt to reconnect after a delay
      if (!this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(() => this.connect(), RECONNECT_INTERVAL);
      }
    };
  }

  public setToken(token: string) {
    if (this.token === token) return; // Token hasn't changed

    this.token = token;
    if (this.isConnected) {
      this.authorize();
    }
  }

  private async authorize(): Promise<any> {
    if (!this.token) {
      console.warn('No token available for authorization. Skipping authorization.');
      this.authorizationPromise = null; // Clear promise if no token
      return null;
    }

    if (this.authorizationPromise) {
      console.log('Authorization already in progress. Awaiting existing promise.');
      return this.authorizationPromise; // Return existing promise if already authorizing
    }
    
    console.log('Starting authorization with token...');
    this.authorizationPromise = new Promise(async (resolve, reject) => {
      try {
        const response = await this.api.authorize(this.token!);
        console.log('Authorization successful:', response);

        // Start pinging after successful authorization
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
        }
        this.pingTimer = setInterval(() => {
          if (this.connection.readyState === WebSocket.OPEN) {
              this.api.ping();
          }
        }, PING_INTERVAL);
        resolve(response);
      } catch (error) {
        console.error('Authorization failed:', error);
        reject(error);
      } finally {
        this.authorizationPromise = null; // Clear promise after completion
      }
    });
    return this.authorizationPromise;
  }

  public async getAccountDetails(): Promise<Account[]> {
    if (!this.token) {
      console.warn('Cannot get account details: no token available.');
      return [];
    }
    
    // Ensure authorization completes before fetching details
    if (!this.isConnected) {
        // Wait for connection to establish and potentially authorize
        await new Promise<void>(resolve => {
            const checkConnection = setInterval(() => {
                if (this.isConnected) {
                    clearInterval(checkConnection);
                    resolve();
                }
            }, 100);
        });
    }

    if (this.authorizationPromise) {
        await this.authorizationPromise;
    } else {
        // If not already authorizing, initiate authorization
        await this.authorize();
    }

    try {
      const accountListResponse = await this.api.send({
        "account_list": 1
      });
      console.log('Account list response:', accountListResponse);

      const accounts: Account[] = accountListResponse.account_list.map((acc: any) => ({
        loginid: acc.loginid,
        currency: acc.currency,
        balance: 0, // Initialize balance to 0, will fetch actual balance below
        is_virtual: acc.is_virtual
      }));

      const accountsWithBalances: Account[] = [];
      for (const account of accounts) {
        // Ensure the token is still valid for this account before fetching balance
        const balanceResponse = await this.api.balance({ account: account.loginid });
        accountsWithBalances.push({
          ...account,
          balance: balanceResponse.balance.balance
        });
      }
      
      return accountsWithBalances;

    } catch (error) {
      console.error('Error fetching account details:', error);
      return [];
    }
  }

  public async switchAccount(loginid: string): Promise<any> {
    if (!this.token) {
      console.warn('Cannot switch account: no token available.');
      return null;
    }
    try {
      const switchResponse = await this.api.send({
        "switch_account": loginid
      });
      console.log('Switch account response:', switchResponse);
      // Update the stored token if a new one is provided on switch
      if (switchResponse.authorize.token) {
        this.token = switchResponse.authorize.token;
        localStorage.setItem('deriv_token', switchResponse.authorize.token);
      }
      // Re-authorize after switch to update the API object's internal state
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
    this.isConnected = false; // Set connection status to false on explicit disconnect
  }
}

const derivApiService = new DerivApiService();
export default derivApiService; 