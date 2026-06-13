import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Finance() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finanzas Personales</Text>
      <Text style={styles.description}>
    Gestiona tus finazas de forma simple
      </Text>

      <View style={styles.blueCard}>
        <View style={styles.cardHeader}>
          <Feather name="target" size={24} color="white" style={styles.cardIcon} />
          <Text style={styles.cardTitle}>Primeros pasos</Text>
        </View>
        
        <Text style={styles.cardDescription}>
      Configura tu perfil financiero para obtener recomendaciones personalizadas.
        </Text>

        <TouchableOpacity style={styles.startButton}>
          <View style={styles.buttonContent}>
            <Feather name="target" size={20} color="#2A4DD0" style={styles.buttonIcon} />
            <Text style={styles.startButtonText}>Empezar</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F7',
    padding: 16,
    marginTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 24,
  },
  blueCard: {
    backgroundColor: '#2A4DD0',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#2A4DD0',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  cardDescription: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    lineHeight: 22,
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#2A4DD0',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 4,
  },
}); 