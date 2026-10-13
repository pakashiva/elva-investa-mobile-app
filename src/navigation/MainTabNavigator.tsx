import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/home/HomeScreen';
import AddFundsStackNavigator from './AddFundsStackNavigator';
import WithdrawalsStackNavigator from './WithdrawalsStackNavigator';
import MoreStackNavigator from './MoreStackNavigator';
import BottomTabBar from '../components/BottomTabBar';
import { MainTabParamList } from './types';
import { useAuth } from '../contexts/AuthContext';
import { getBorrowingAccess } from '../services/borrowingService';
import BorrowingStackNavigator from './BorrowingStackNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { session } = useAuth();
  const sessionAllowsBorrowing = Boolean(session?.customer?.enabledModules?.includes('borrow') &&
    (['borrower', 'both'].includes(session.customer.customerType ?? '') || session.customer.hasBorrowerAccount));
  const [borrowingEnabled, setBorrowingEnabled] = useState(sessionAllowsBorrowing);

  useEffect(() => {
    let active = true;
    setBorrowingEnabled(sessionAllowsBorrowing);
    if (session?.customer?.clientId) {
      getBorrowingAccess().then((enabled) => {
        if (active) setBorrowingEnabled(enabled);
      }).catch(() => { if (active) setBorrowingEnabled(false); });
    }
    return () => { active = false; };
  }, [session?.customer?.clientId, session?.customer?.id, sessionAllowsBorrowing]);

  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="AddFunds" component={AddFundsStackNavigator} />
      <Tab.Screen name="Withdrawals" component={WithdrawalsStackNavigator} />
      {borrowingEnabled ? <Tab.Screen name="Borrowing" component={BorrowingStackNavigator} /> : null}
      <Tab.Screen name="More" component={MoreStackNavigator} />
    </Tab.Navigator>
  );
}
