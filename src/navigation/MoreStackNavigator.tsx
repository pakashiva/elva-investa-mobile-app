import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MoreScreen from '../screens/more/MoreScreen';
import MyBankAccountsScreen from '../screens/more/MyBankAccountsScreen';
import AddBankAccountScreen from '../screens/more/AddBankAccountScreen';
import MyNomineesScreen from '../screens/more/MyNomineesScreen';
import AddNomineeScreen from '../screens/more/AddNomineeScreen';
import AgreementsScreen from '../screens/more/AgreementsScreen';
import EarningsScreen from '../screens/more/EarningsScreen';
import ReferEarnScreen from '../screens/more/ReferEarnScreen';
import MyProfileScreen from '../screens/more/MyProfileScreen';
import SettingsScreen from '../screens/more/SettingsScreen';
import AccountCapabilitiesScreen from '../screens/more/AccountCapabilitiesScreen';
import TransactionsScreen from '../screens/more/TransactionsScreen';
import FaqScreen from '../screens/more/FaqScreen';
import HelpSupportScreen from '../screens/more/HelpSupportScreen';
import LegalDocumentScreen from '../screens/more/LegalDocumentScreen';
import { MoreStackParamList } from './types';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export default function MoreStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Menu" component={MoreScreen} />
      <Stack.Screen
        name="MyBankAccounts"
        component={MyBankAccountsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AddBankAccount"
        component={AddBankAccountScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="MyNominees"
        component={MyNomineesScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AddNominee"
        component={AddNomineeScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Agreements"
        component={AgreementsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ReferEarn"
        component={ReferEarnScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="MyProfile"
        component={MyProfileScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AccountCapabilities"
        component={AccountCapabilitiesScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="LegalDocument"
        component={LegalDocumentScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="FAQ"
        component={FaqScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="HelpSupport"
        component={HelpSupportScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
