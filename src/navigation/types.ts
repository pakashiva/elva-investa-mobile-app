import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';

import { VerifyMobileNumberParams } from '../types/otp';

export type AddFundsStackParamList = {
  MyInvestments: undefined;
  NewFundRequest: undefined;
  InvestmentDetails: { investmentId: string };
  WithdrawalsList: undefined;
  CreateWithdrawalRequest: undefined;
  WithdrawalDetails: { withdrawalId: string };
};

/** @deprecated Withdrawal routes now live in the shared Invest tab stack. */
export type WithdrawalsStackParamList = Pick<AddFundsStackParamList,
  'WithdrawalsList' | 'CreateWithdrawalRequest' | 'WithdrawalDetails'>;

export type BorrowingStackParamList = {
  BorrowingHome: undefined;
  BorrowingLoanDetails: { loanId: string };
  LoanRequest: undefined;
};

export type MoreStackParamList = {
  Menu: undefined;
  MyBankAccounts: undefined;
  AddBankAccount: undefined;
  MyNominees: undefined;
  AddNominee: undefined;
  Agreements: undefined;
  Earnings: undefined;
  ReferEarn: undefined;
  MyProfile: undefined;
  Settings: undefined;
  AccountCapabilities: undefined;
  LegalDocument: { documentId: 'terms' | 'privacy' | 'about' };
  Transactions: undefined;
  FAQ: undefined;
  HelpSupport: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  AddFunds: NavigatorScreenParams<AddFundsStackParamList>;
  Borrowing: NavigatorScreenParams<BorrowingStackParamList>;
  More: NavigatorScreenParams<MoreStackParamList>;
};

export type RootStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  MpinLock: undefined;
  CreateAccount: undefined;
  VerifyMobileNumber: VerifyMobileNumberParams;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Notifications: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;

export type AddFundsStackScreenProps<T extends keyof AddFundsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AddFundsStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type BorrowingStackScreenProps<T extends keyof BorrowingStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<BorrowingStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type MoreStackScreenProps<T extends keyof MoreStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<MoreStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
