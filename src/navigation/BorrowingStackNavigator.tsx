import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BorrowingDashboardScreen from '../screens/borrowing/BorrowingDashboardScreen';
import BorrowingLoanDetailsScreen from '../screens/borrowing/BorrowingLoanDetailsScreen';
import BorrowingScreen from '../screens/borrowing/BorrowingScreen';
import { BorrowingStackParamList } from './types';

const Stack = createNativeStackNavigator<BorrowingStackParamList>();

export default function BorrowingStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BorrowingHome" component={BorrowingDashboardScreen} />
      <Stack.Screen name="BorrowingLoanDetails" component={BorrowingLoanDetailsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="LoanRequest" component={BorrowingScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}
