import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';

export interface ContractedBySomeoneData {
  hasContract: boolean;
  contractedBy: string;
  phone: string;
  contractDate: string;
  policyNumber?: string;
}

interface ContractedForYouCardProps {
  data: ContractedBySomeoneData | null;
  styles: Record<string, any>;
  onPressCoverage: () => void;
}

export function ContractedForYouCard({ data, styles, onPressCoverage }: ContractedForYouCardProps) {
  if (!data?.hasContract) {
    return null;
  }

  const handleCall = async () => {
    const phoneNumber = 'tel:8000000000';
    try {
      const supported = await Linking.canOpenURL(phoneNumber);
      if (supported) {
        await Linking.openURL(phoneNumber);
      } else {
        Alert.alert('Error', 'No se puede realizar la llamada desde este dispositivo');
      }
    } catch {
      Alert.alert('Error', 'No se pudo realizar la llamada');
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No se pudo abrir el enlace');
      }
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Error', 'No se pudo abrir el enlace. Por favor, inténtalo de nuevo.');
      }
    }
  };

  return (
    <View style={styles.contractedSection}>
      <Text style={styles.contractedTitle}>Plan contratado para ti</Text>

      <View style={styles.purpleCard}>
        <View style={styles.contractedHeader}>
          <View style={styles.contractedShield}>
            <Feather name="shield" size={24} color="white" />
          </View>
          <View style={styles.contractedInfo}>
            <Text style={styles.contractedPlanTitle}>
              Plan contratado por {data.contractedBy}
            </Text>
            <Text style={styles.contractedDate}>{data.contractDate}</Text>
          </View>
        </View>

        <View style={styles.contractedDetails}>
          {/* Leyenda sobre inicio y renovación */}
          <View style={[styles.detailCard, { backgroundColor: '#F3E5F5', borderColor: '#9C27B0', borderWidth: 1, marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="information-circle" size={18} color="#9C27B0" style={{ marginRight: 6 }} />
              <Text style={[styles.detailTitle, { color: '#9C27B0', fontSize: 13, fontWeight: '600' }]}>Información importante</Text>
            </View>
            <Text style={{ color: '#7B1FA2', fontSize: 11, lineHeight: 16 }}>
              El contrato inicia el primer día de cada mes y se renueva automáticamente el primer día de cada mes.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.detailCard}
            onPress={onPressCoverage}
            activeOpacity={0.7}
          >
            <Text style={[styles.detailTitle, { color: '#9C27B0' }]}>Ver coberturas</Text>
          </TouchableOpacity>

          <Text style={[styles.benefitsTitle, { color: '#CE93D8', marginTop: 16 }]}>Beneficios para ti</Text>

          <View style={styles.detailCard}>
            <Text style={[styles.detailTitle, { color: '#9C27B0' }]}>
              Contacto THONA Seguros
            </Text>
            <Text style={styles.detailText}>
              • Para solicitar atención y pago directo en caso de un accidente, llama al Call Center de THONA Seguros: 800 400 9911
            </Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailText}>
              Para usar tus asistencias (Estudios, Descuentos Médicos, Ambulancia, etc.):
            </Text>
            <Text style={styles.detailText}>
              • Debes comunicarte a la Línea de Asistencias SSIST al 01800 400 8462 o 551518 0681
            </Text>
          </View>

          <View style={styles.detailCard}>
            <Text style={[styles.detailTitle, { color: '#9C27B0' }]}>
              Número de póliza - asegurado
            </Text>
            <Text style={styles.detailText}>
              {data.policyNumber || '70865-00'}
            </Text>
          </View>

          <Text style={[styles.benefitsTitle, { color: '#CE93D8', marginTop: 16 }]}>Beneficios para ti y tu familia</Text>

          <View style={styles.detailCard}>
            <Text style={[styles.detailTitle, { color: '#9C27B0' }]}>
              PLAN DE TELEFONIA CENT X INTERNET PARA EL BIENESTAR
            </Text>
            <TouchableOpacity
              style={styles.telephonyPlanButtonBranding}
              onPress={() =>
                handleOpenUrl('https://www.internetbienestarmex.com/prueba-gratis?chid=12&cid=6')
              }
            >
              <Text style={styles.telephonyPlanButtonText}>Internet del Bienestar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailCard}>
            <Text style={[styles.detailTitle, { color: '#9C27B0' }]}>TRESQU</Text>
            <TouchableOpacity
              style={styles.telephonyPlanButtonBranding}
              onPress={() =>
                handleOpenUrl(
                  'https://wa.me/5200000000000?text=Hola'
                )
              }
            >
              <Text style={styles.telephonyPlanButtonText}>Abrir Tresqu</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailCard}>
            <Text style={[styles.detailTitle, { color: '#9C27B0' }]}>
              VICENTE + ASISTENTE FINANCIERO
            </Text>
            <TouchableOpacity
              style={styles.telephonyPlanButtonBranding}
              onPress={() =>
                handleOpenUrl(
                  'https://example.com/vicente'
                )
              }
            >
              <Text style={styles.telephonyPlanButtonText}>Abrir Vicente +</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailCard}>
            <Text style={[styles.detailTitle, { color: '#9C27B0' }]}>
              Finanzas con CENTido: Código de descuento- CIENTE+
            </Text>
            <TouchableOpacity
              style={styles.telephonyPlanButtonBranding}
              onPress={() =>
                handleOpenUrl(
                  'https://hotmart.com/es/marketplace/productos/finanzas-con-centido-toma-el-control-de-tus-finanzas/X102890710C'
                )
              }
            >
              <Text style={styles.telephonyPlanButtonText}>Abrir Finanzas con CENTido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}


