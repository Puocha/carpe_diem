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

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.connection && (this.connection.readyState === WebSocket.OPEN || this.connection.readyState === WebSocket.CONNECTING)) {
        return; // Already connected or connecting
    }
    console.log('Attempting to establish Deriv WebSocket connection...');
    this.connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
    this.api = new DerivAPIBasic({ connection: this.connection });

    this.connection.onopen = () => {
      console.log('Deriv WebSocket connection established.');
      this.isConnected = true;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      // Authorize only if token is already available
      if (this.token) {
        this.authorize();
      }
    };

    this.connection.onclose = () => {
      console.log('Deriv WebSocket connection closed.');
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
    this.token = token;
    if (this.isConnected) {
      this.authorize();
    }
  }

  private async authorize(): Promise<any> {
    if (!this.token) {
      console.warn('No token available for authorization.');
      return null;
    }
    
    console.log('Authorizing with token...');
    try {
      const response = await this.api.authorize(this.token);
      console.log('Authorization successful:', response);

      // Start pinging after successful authorization
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
      }
      this.pingTimer = setInterval(() => {
        this.api.ping();
      }, PING_INTERVAL);

      return response;
    } catch (error) {
      console.error('Authorization failed:', error);
      throw error;
    }
  }

  public async getAccountDetails(): Promise<Account[]> {
    if (!this.token) {
      console.warn('Cannot get account details: no token available.');
      return [];
    }
    
    // Ensure authorization before fetching details
    await this.authorize();

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
    this.connection.close();
  }
}

const derivApiService = new DerivApiService();
export default derivApiService; 