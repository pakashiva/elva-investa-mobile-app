export type CustomerPayload = {
  id: string;
  fullName: string;
  mobileNumber: string;
  emailAddress: string;
  customerCode: string;
  referralCode: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  mobileVerified: boolean;
  enabledModules?: string[];
  customerType?: 'investor' | 'borrower' | 'both' | string;
  hasBorrowerAccount?: boolean;
};

export type AppSession = {
  access_token: string;
  user: {
    id: string;
    email?: string;
    last_sign_in_at?: string;
  };
  customer: CustomerPayload;
};
