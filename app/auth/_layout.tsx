import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="welcome" 
        options={{
          title: 'Welcome',
        }}
      />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup-wizard" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
