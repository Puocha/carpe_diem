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
      throw new Error('No token available for authorization');
    }

    if (this.authorizationPromise) {
      console.log('Authorization already in progress. Awaiting existing promise.');
      return this.authorizationPromise;
    }
    
    console.log('Starting authorization with token...');
    this.authorizationPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('Sending authorization request...');
        const response = await this.api.authorize(this.token!);
        console.log('Authorization response received:', response);

        if (response.error) {
          console.error('Authorization error:', response.error);
          throw new Error(response.error.message || 'Authorization failed');
        }

        if (!response.authorize) {
          console.error('Invalid authorization response:', response);
          throw new Error('Invalid authorization response format');
        }

        console.log('Authorization successful, setting up ping...');
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
        }
        
        this.pingTimer = setInterval(() => {
          if (this.connection.readyState === WebSocket.OPEN) {
            console.log('Sending ping...');
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
      } catch (error: any) {
        console.error('Authorization failed:', error);
        this.isConnected = false;
        
        // Check if the error is due to an invalid token
        if (error.message?.toLowerCase().includes('token') || 
            error.message?.toLowerCase().includes('authorize') ||
            error.message?.toLowerCase().includes('invalid')) {
          console.error('Token validation failed:', error.message);
          throw new Error('Invalid or expired token');
        }
        
        reject(error);
      } finally {
        this.authorizationPromise = null;
      }
    });

    return this.authorizationPromise;
  }

  public async getAccountDetails(): Promise<Account[]> {
    if (!this.token) {
      throw new Error('No token available');
    }

    try {
      console.log('Starting getAccountDetails...');
      
      // Wait for connection and authorization with timeout
      if (!this.isConnected) {
        console.log('Waiting for connection...');
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log('Connection timeout reached');
            reject(new Error('Connection timeout'));
          }, 10000);

          const checkConnection = setInterval(() => {
            if (this.isConnected) {
              console.log('Connection established');
              clearInterval(checkConnection);
              clearTimeout(timeout);
              resolve();
            }
          }, 100);
        });
      }

      if (this.authorizationPromise) {
        console.log('Waiting for existing authorization...');
        await this.authorizationPromise;
      } else if (this.token) {
        console.log('Starting new authorization...');
        await this.authorize();
      }

      console.log('Sending account_list request...');
      const accountListResponse = await this.api.send({
        "account_list": 1
      });
      console.log('Account list response received:', accountListResponse);

      if (accountListResponse.error) {
        console.error('Account list error:', accountListResponse.error);
        throw new Error(accountListResponse.error.message || 'Failed to fetch account list');
      }

      if (!accountListResponse.account_list || !Array.isArray(accountListResponse.account_list)) {
        console.error('Invalid account list response:', accountListResponse);
        throw new Error('Invalid account list response format');
      }

      console.log('Processing account list...');
      const accounts: Account[] = accountListResponse.account_list.map((acc: any) => ({
        loginid: acc.loginid,
        currency: acc.currency,
        balance: 0,
        is_virtual: acc.is_virtual
      }));

      console.log('Fetching balances for accounts...');
      const accountsWithBalances: Account[] = [];
      for (const account of accounts) {
        try {
          console.log(`Fetching balance for account ${account.loginid}...`);
          const balanceResponse = await this.api.balance({ account: account.loginid });
          
          if (balanceResponse.error) {
            console.error(`Error fetching balance for account ${account.loginid}:`, balanceResponse.error);
            accountsWithBalances.push(account);
            continue;
          }

          if (!balanceResponse.balance || typeof balanceResponse.balance.balance !== 'number') {
            console.error(`Invalid balance response for account ${account.loginid}:`, balanceResponse);
            accountsWithBalances.push(account);
            continue;
          }

          accountsWithBalances.push({
            ...account,
            balance: balanceResponse.balance.balance
          });
          console.log(`Successfully fetched balance for account ${account.loginid}`);
        } catch (error) {
          console.error(`Error fetching balance for account ${account.loginid}:`, error);
          accountsWithBalances.push(account);
        }
      }
      
      console.log('Account details fetch completed successfully');
      return accountsWithBalances;

    } catch (error: any) {
      console.error('Error in getAccountDetails:', error);
      if (error.message?.toLowerCase().includes('token') || 
          error.message?.toLowerCase().includes('authorize') ||
          error.message?.toLowerCase().includes('invalid')) {
        throw new Error('Invalid or expired token');
      }
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