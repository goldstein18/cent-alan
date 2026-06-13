import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';

export interface MyContractData {
  hasContract: boolean;
  contractDate: string;
  planType: string;
  id?: string;
  status?: string;
  policyNumber?: string;
}

interface MyContractCardProps {
  data: MyContractData | null;
  styles: Record<string, any>;
  onPressCoverage: () => void;
  onCancel: () => void;
}

export function MyContractCard({ data, styles, onPressCoverage, onCancel }: MyContractCardProps) {
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
        Alert.alert('Error', 'No se pudo abrir el enlace');
      }
    }
  };

  return (
    <View style={styles.contractedSection}>
      <Text style={styles.greenSectionTitle}>Tu plan contratado</Text>

      <View style={styles.greenCard}>
        <View style={styles.contractedHeader}>
          <View style={styles.greenShield}>
            <Feather name="shield" size={24} color="white" />
          </View>
          <View style={styles.contractedInfo}>
            <Text style={styles.contractedPlanTitle}>Plan {data.planType} contratado</Text>
            <Text style={styles.contractedDate}>{data.contractDate}</Text>
          </View>
        </View>

        <View style={styles.contractedDetails}>
          {/* Leyenda sobre inicio y renovación */}
          <View style={[styles.detailCard, { backgroundColor: '#E8F8F5', borderColor: '#2ecc71', borderWidth: 1, marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="information-circle" size={18} color="#2ecc71" style={{ marginRight: 6 }} />
              <Text style={[styles.detailTitle, { color: '#2ecc71', fontSize: 13, fontWeight: '600' }]}>Información importante</Text>
            </View>
            <Text style={{ color: '#27AE60', fontSize: 11, lineHeight: 16 }}>
              El contrato inicia el primer día de cada mes y se renueva automáticamente el primer día de cada mes.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.detailCard}
            onPress={onPressCoverage}
            activeOpacity={0.7}
          >
            <Text style={[styles.detailTitle, { color: '#2ecc71' }]}>Ver coberturas</Text>
          </TouchableOpacity>

          <Text style={[styles.benefitsTitle, { color: '#FFFFFF', marginTop: 16 }]}>Beneficios para ti</Text>

          <View style={styles.detailCard}>
            <Text style={[styles.detailTitle, { color: '#2ecc71' }]}>
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
            <Text style={[styles.detailTitle, { color: '#2ecc71' }]}>
              Número de póliza de seguro
            </Text>
            <Text style={styles.detailText}>
              {data.policyNumber || '70865-00'}
            </Text>
          </View>

          <Text style={[styles.benefitsTitle, { color: '#FFFFFF', marginTop: 16 }]}>Beneficios para ti y tu familia</Text>

          <View style={styles.detailCard}>
            <Text style={[styles.detailTitle, { color: '#2ecc71' }]}>
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
            <Text style={[styles.detailTitle, { color: '#2ecc71' }]}>TRESQU</Text>
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
            <Text style={[styles.detailTitle, { color: '#2ecc71' }]}>
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
            <Text style={[styles.detailTitle, { color: '#2ecc71' }]}>
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

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar Contrato</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


