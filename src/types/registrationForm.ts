import { BankAccountType } from './bankAccount';

export type DocumentUploadValue = {
  uri: string | null;
  fileName: string;
  isUserSelected: boolean;
};

export type RegistrationFormValues = {
  clientCode: string;
  customerType: 'investor' | 'borrower' | 'both';
  fullName: string;
  mobileNumber: string;
  emailAddress: string;
  dateOfBirth: string;
  address: string;
  aadhaarNumber: string;
  panNumber: string;
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string;
  accountType: BankAccountType;
  nomineeName: string;
  relationship: string;
  nomineeAadhaar: string;
  nomineeMobile: string;
  nomineePan: string;
  password: string;
  confirmPassword: string;
  mpin: string;
  confirmMpin: string;
  authorized: boolean;
};

export type RegistrationFormErrors = Partial<
  Record<keyof RegistrationFormValues, string>
>;
