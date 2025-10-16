// src/navigation/AuthStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/Auth/LoginScreen';
import VerifyOTPScreen from '../screens/Auth/VerifyOTPScreen';
import CreateUsernameScreen from '../screens/Auth/CreateUsernameScreen.js'; 

const Stack = createStackNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
      <Stack.Screen name="CreateUsername" component={CreateUsernameScreen} /> 
    </Stack.Navigator>
  );
};

export default AuthStack;
