import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export default function Welcome() {
  
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoBackground}>
          <Image 
            source={require('../../assets/images/iconremove.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>
      <Text style={styles.title}>WELCOME SCREEN TEST</Text>
      <Text style={styles.subtitle}>If you see this, the auth flow is working!</Text>
      <Text style={styles.subtitle}>Red background means auth stack is working!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'green',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  logoBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
    backgroundColor: '#f0f0f0', // A light background for the logo
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
