import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export interface ContractForOther {
  id: string;
  name: string;
  phone: string;
  contractDate: string;
  planType: string;
}

interface ContractsForOthersListProps {
  contracts: ContractForOther[];
  styles: Record<string, any>;
  onPressCoverage: () => void;
  onCancel: (id: string) => void;
}

export function ContractsForOthersList({
  contracts,
  styles,
  onPressCoverage,
  onCancel,
}: ContractsForOthersListProps) {
  if (!contracts.length) {
    return null;
  }

  return (
    <View style={styles.contractedSection}>
      <Text style={styles.orangeSectionTitle}>Contratos que has hecho para otros</Text>
      <View style={{ height: 8 }} />

      {contracts.map((contract) => (
        <View key={contract.id} style={styles.orangeCard}>
          <View style={styles.contractedHeader}>
            <View style={styles.orangeShield}>
              <Feather name="shield" size={24} color="white" />
            </View>
            <View style={styles.contractedInfo}>
              <Text style={styles.contractedPlanTitle}>
                Plan {contract.planType} para {contract.name}
              </Text>
              <Text style={styles.contractedDate}>{contract.contractDate}</Text>
            </View>
          </View>

          <View style={styles.contractedDetails}>
            {/* Leyenda sobre inicio y renovación */}
            <View style={[styles.detailCard, { backgroundColor: '#FFF3E0', borderColor: '#FF9800', borderWidth: 1, marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Ionicons name="information-circle" size={18} color="#FF9800" style={{ marginRight: 6 }} />
                <Text style={[styles.detailTitle, { color: '#FF9800', fontSize: 13, fontWeight: '600' }]}>Información importante</Text>
              </View>
              <Text style={{ color: '#E65100', fontSize: 11, lineHeight: 16 }}>
                El contrato inicia el primer día de cada mes y se renueva automáticamente el primer día de cada mes.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.detailCard}
              onPress={onPressCoverage}
              activeOpacity={0.7}
            >
              <Text style={[styles.detailTitle, { color: '#FF9800' }]}>Ver coberturas</Text>
            </TouchableOpacity>
            <View style={styles.detailCard}>
              <Text style={[styles.detailTitle, { color: '#FF9800' }]}>Contratado para</Text>
              <Text style={styles.detailText}>{contract.name}</Text>
              <Text style={styles.detailText}>{contract.phone}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => onCancel(contract.id)}
          >
            <Text style={styles.cancelButtonText}>Cancelar Contrato</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}


