import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyInvestmentsScreen from '../screens/investments/MyInvestmentsScreen';
import NewFundRequestScreen from '../screens/investments/NewFundRequestScreen';
import InvestmentDetailsScreen from '../screens/investments/InvestmentDetailsScreen';
import WithdrawalsScreen from '../screens/withdrawals/WithdrawalsScreen';
import CreateWithdrawalRequestScreen from '../screens/withdrawals/CreateWithdrawalRequestScreen';
import WithdrawalDetailsScreen from '../screens/withdrawals/WithdrawalDetailsScreen';
import { AddFundsStackParamList } from './types';

const Stack = createNativeStackNavigator<AddFundsStackParamList>();

export default function AddFundsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyInvestments" component={MyInvestmentsScreen} />
      <Stack.Screen
        name="NewFundRequest"
        component={NewFundRequestScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="InvestmentDetails"
        component={InvestmentDetailsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen name="WithdrawalsList" component={WithdrawalsScreen} />
      <Stack.Screen name="CreateWithdrawalRequest" component={CreateWithdrawalRequestScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="WithdrawalDetails" component={WithdrawalDetailsScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}
