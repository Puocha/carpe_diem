import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';

const APP_ID = '71979'; // Your Deriv App ID

interface Account {
  loginid: string;
  currency: string;
  balance: number;
  is_virtual: 0 | 1;
}

class DerivApiService {
  private api: DerivAPIBasic;
  private connection: WebSocket;
  private token: string | null = null;

  constructor() {
    this.connection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
    this.api = new DerivAPIBasic({ connection: this.connection });

    this.connection.onopen = () => {
      console.log('Deriv WebSocket connection established.');
      this.authorize();
    };

    this.connection.onclose = () => {
      console.log('Deriv WebSocket connection closed.');
      // Implement reconnection logic if needed
    };

    this.connection.onerror = (error) => {
      console.error('Deriv WebSocket error:', error);
    };
  }

  public setToken(token: string) {
    this.token = token;
    if (this.connection.readyState === WebSocket.OPEN) {
      this.authorize();
    }
  }

  private async authorize(): Promise<any> {
    if (this.token) {
      console.log('Authorizing with token...');
      try {
        const response = await this.api.authorize(this.token);
        console.log('Authorization successful:', response);
        return response;
      } catch (error) {
        console.error('Authorization failed:', error);
        throw error;
      }
    } else {
      console.warn('No token available for authorization.');
      return null;
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
      const response = await this.api.send({
        "get_account_status": 1
      });
      console.log('Account status response:', response);

      const accountListResponse = await this.api.send({
        "account_list": 1
      });

      const accounts: Account[] = accountListResponse.account_list.map((acc: any) => ({
        loginid: acc.loginid,
        currency: acc.currency,
        balance: acc.balance,
        is_virtual: acc.is_virtual
      }));

      // Now get balances for each account
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
      const response = await this.api.residence_list(); // Get residence list first
      const default_currency = response.residence_list[0].currency_details.find((c:any) => c.is_default)?.code || 'USD';
      
      const switchResponse = await this.api.send({
        "switch_account": loginid,
        "default_currency": default_currency
      });
      console.log('Switch account response:', switchResponse);
      // Update the stored token if a new one is provided on switch
      if (switchResponse.authorize.token) {
        this.token = switchResponse.authorize.token;
        localStorage.setItem('deriv_token', switchResponse.authorize.token);
      }
      return switchResponse;
    } catch (error) {
      console.error('Error switching account:', error);
      throw error;
    }
  }

  public disconnect() {
    this.api.disconnect();
  }
}

const derivApiService = new DerivApiService();
export default derivApiService; 