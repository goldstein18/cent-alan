import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ContractedBySomeoneData, ContractedForYouCard } from '../components/insurance/ContractedForYouCard';
import { ContractForOther, ContractsForOthersList } from '../components/insurance/ContractsForOthersList';
import { MyContractCard, MyContractData } from '../components/insurance/MyContractCard';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { InsuranceService } from '../services/insuranceService';

export default function Insurance() {
  const [showCosts, setShowCosts] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCalculatorHelpModal, setShowCalculatorHelpModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractStep, setContractStep] = useState(1); // 1: Personal info, 2: Plan options, 3: PIN confirmation
  const { user } = useAuth();
  const { availableBalance, reloadData } = useData();

  const formatCurrency = (value?: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value ?? 0);
  
  // Estados para diferentes tipos de contratos
  const [contractedBySomeone, setContractedBySomeone] = useState<ContractedBySomeoneData>({
    hasContract: false,
    contractedBy: '',
    phone: '',
    contractDate: ''
  });
  
  const [myOwnContract, setMyOwnContract] = useState<MyContractData>({
    hasContract: false,
    contractDate: '',
    planType: '',
    id: '',
    status: undefined,
  });
  
  const [contractsForOthers, setContractsForOthers] = useState<ContractForOther[]>([]);
  const [contractData, setContractData] = useState({
    phone: '',
    email: '',
    firstName: '',
    secondName: '',
    paternalLastName: '',
    maternalLastName: '',
    birthDate: '',
    rfc: '',
    curp: '',
    gender: '',
    planType: '', // 'mensual' o 'anual'
    beneficiary: '', // 'para-mi' o 'tercero'
    pin: ''
  });
  const [genderDropdownVisible, setGenderDropdownVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const coverageSectionRef = useRef<View>(null);
  const [insurancePlans, setInsurancePlans] = useState<any[]>([]);
  const [userContracts, setUserContracts] = useState<any[]>([]);
  const [isLoadingInsurance, setIsLoadingInsurance] = useState(false);
  const userDefaults = useMemo(() => ({
    firstName: user?.firstName ?? '',
    paternalLastName: user?.lastName ?? '',
    phone: user?.phoneNumber ?? '',
    email: user?.email ?? '',
  }), [user]);

  const loadInsuranceData = useCallback(async () => {
    setIsLoadingInsurance(true);
    try {
      const [plansResponse, contractsResponse] = await Promise.all([
        InsuranceService.getPlans(),
        InsuranceService.getContracts(),
      ]);

      if (plansResponse.success && plansResponse.data) {
        setInsurancePlans(plansResponse.data);
      }

      if (contractsResponse.success && contractsResponse.data) {
        const contracts = contractsResponse.data;
        setMyOwnContract({ hasContract: false, contractDate: '', planType: '', id: '', status: undefined });
        setContractedBySomeone({ hasContract: false, contractedBy: '', phone: '', contractDate: '' });
        setContractsForOthers([]);

        // Filtrar contratos: mostrar activos y cancelados que aún estén en vigencia
        // Los cancelados desaparecerán solo después de su fecha de vencimiento
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalizar a inicio del día para comparación
        
        const activeContracts = contracts.filter(c => {
          const status = c.status?.toLowerCase() || '';
          
          // Mostrar contratos activos
          if (status === 'active' || status === 'activo') {
            return true;
          }
          
          // Para contratos cancelados, verificar si aún están en vigencia
          if (status === 'cancelled' || status === 'cancelado') {
            // Si tiene fecha de vencimiento, verificar si aún no ha vencido
            if (c.endDate) {
              const endDate = new Date(c.endDate);
              endDate.setHours(0, 0, 0, 0); // Normalizar a inicio del día
              // Mostrar si la fecha de vencimiento es hoy o después
              return endDate >= today;
            }
            // Si no tiene fecha de vencimiento, no mostrar (por seguridad)
            return false;
          }
          
          return false;
        });

        // Reglas de visualización:
        // - Morado: alguien te contrató (beneficiary_user_id = current user, user_id != current user)
        // - Verde: tú te contrataste (user_id = current user, beneficiaryType distinto de 'tercero', isBeneficiary = false)
        // - Naranja: tú contrataste a otros (user_id = current user, beneficiaryType = 'tercero')

        const contractedBySomeone = activeContracts.filter(
          c => c.isBeneficiary && c.beneficiaryUserId === user?.id && c.userId !== user?.id
        );

        const selfContracts = activeContracts.filter(
          c => c.userId === user?.id && !c.isBeneficiary && c.beneficiaryType !== 'tercero'
        );

        const contractsForOthersRaw = activeContracts.filter(
          c => c.userId === user?.id && c.beneficiaryType === 'tercero'
        );

        if (selfContracts.length > 0) {
          const own = selfContracts[0];
          setMyOwnContract({
            hasContract: true,
            contractDate: own.contractDate,
            planType: own.planType || 'mensual',
            id: own.id || '',
            status: own.status,
            policyNumber: own.policyNumber,
          });
        }

        if (contractedBySomeone.length > 0) {
          const beneficiary = contractedBySomeone[0];
          setContractedBySomeone({
            hasContract: true,
            contractedBy: beneficiary.ownerName || 'Usuario',
            phone: beneficiary.ownerPhone || '',
            contractDate: beneficiary.contractDate,
            policyNumber: beneficiary.policyNumber,
          });
        }

        if (contractsForOthersRaw.length > 0) {
          setContractsForOthers(contractsForOthersRaw.map((c, index) => ({
            id: String(c.id ?? index),
            name: c.beneficiaryName || 'Beneficiario',
            phone: c.beneficiaryPhone || '',
            contractDate: c.contractDate || c.created_at,
            planType: c.planType || 'mensual',
          })));
        }
      }
    } catch (error) {
      console.error('Error loading insurance data:', error);
    } finally {
      setIsLoadingInsurance(false);
    }
  }, [user?.id]);

  // Recargar datos cuando la pantalla recibe foco (usuario navega a ella)
  useFocusEffect(
    useCallback(() => {
      loadInsuranceData();
      
      // Actualizar automáticamente cada 5 minutos mientras estás en la pantalla
      const interval = setInterval(() => {
        loadInsuranceData();
      }, 5 * 60 * 1000); // 5 minutos (5 * 60 * 1000 ms)
      
      return () => clearInterval(interval);
    }, [loadInsuranceData])
  );

  // También recargar al montar el componente
  useEffect(() => {
    loadInsuranceData();
  }, [loadInsuranceData]);

  useEffect(() => {
    if (contractData.beneficiary !== 'para-mi') {
      return;
    }

    setContractData(prev => ({
      ...prev,
      firstName: prev.firstName || userDefaults.firstName,
      paternalLastName: prev.paternalLastName || userDefaults.paternalLastName,
      phone: prev.phone || userDefaults.phone,
      email: prev.email || userDefaults.email,
    }));
  }, [contractData.beneficiary, userDefaults]);

  const scrollToCoverage = () => {
    
    // Try to measure the coverage section position
    if (coverageSectionRef.current && scrollViewRef.current) {
      coverageSectionRef.current.measure((x, y, width, height, pageX, pageY) => {
        scrollViewRef.current?.scrollTo({ y: pageY - 100, animated: true });
      });
    } else {
      // Fallback to fixed position
      scrollViewRef.current?.scrollTo({ y: 200, animated: true });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setContractData(prev => {
      // Si se cambia el beneficiario a 'tercero', limpiar todos los campos de información personal
      if (field === 'beneficiary' && value === 'tercero') {
        return {
          ...prev,
          [field]: value,
          firstName: '',
          secondName: '',
          paternalLastName: '',
          maternalLastName: '',
          birthDate: '',
          phone: '',
          email: '',
          rfc: '',
          curp: '',
          gender: '',
        };
      }
      // Si se cambia a 'para-mi', prellenar con datos del usuario
      if (field === 'beneficiary' && value === 'para-mi') {
        return {
          ...prev,
          [field]: value,
          firstName: userDefaults.firstName,
          paternalLastName: userDefaults.paternalLastName,
          phone: userDefaults.phone,
          email: userDefaults.email,
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleBirthDateChange = (text: string) => {
    // Remove all non-numeric characters
    const numbers = text.replace(/\D/g, '');
    
    // Format as DD/MM/YYYY while typing
    let formatted = '';
    if (numbers.length > 0) {
      formatted = numbers.substring(0, 2);
      if (numbers.length > 2) {
        formatted += '/' + numbers.substring(2, 4);
      }
      if (numbers.length > 4) {
        formatted += '/' + numbers.substring(4, 8);
      }
    }
    
    handleInputChange('birthDate', formatted);
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD for backend
  const convertDateToBackendFormat = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 10) return dateStr;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  // Funciones para manejar contratos
  const handleCancelMyContract = () => {
    if (!myOwnContract.id) {
      Alert.alert('Error', 'No se encontró el contrato a cancelar');
      return;
    }

    Alert.alert(
      'Cancelar Contrato',
      '¿Estás seguro de que quieres cancelar tu contrato de seguro?\n\nEl contrato permanecerá activo hasta el final del período de vigencia actual y se desactivará el primer día del siguiente mes. Podrás reactivarlo nuevamente el primer día de cualquier mes.',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Sí, cancelar', 
          onPress: async () => {
            try {
              const response = await InsuranceService.cancelContract(myOwnContract.id!);
              if (!response.success) {
                Alert.alert('Error', response.error || 'No fue posible cancelar el contrato');
                return;
              }
              await loadInsuranceData();
              Alert.alert(
                'Contrato cancelado', 
                'Tu contrato de seguro ha sido cancelado. Permanecerá activo hasta el final del período actual y se desactivará el primer día del siguiente mes.'
              );
            } catch (error) {
              console.error('Error canceling contract:', error);
              Alert.alert('Error', 'No fue posible cancelar el contrato');
            }
          }
        }
      ]
    );
  };

  const handleCancelContractForOther = (contractId: string) => {
    Alert.alert(
      'Cancelar Contrato',
      '¿Estás seguro de que quieres cancelar este contrato?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Sí, cancelar', 
          onPress: async () => {
            try {
              const response = await InsuranceService.cancelContract(contractId);
              if (!response.success) {
                Alert.alert('Error', response.error || 'No fue posible cancelar el contrato');
                return;
              }
              await loadInsuranceData();
              Alert.alert('Contrato cancelado', 'El contrato ha sido cancelado exitosamente');
            } catch (error) {
              console.error('Error canceling contract:', error);
              Alert.alert('Error', 'No fue posible cancelar el contrato');
            }
          }
        }
      ]
    );
  };

  const handleCancelAllContractsForOthers = () => {
    Alert.alert(
      'Cancelar Todos los Contratos',
      '¿Estás seguro de que quieres cancelar todos los contratos que has hecho para otros?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Sí, cancelar todos', 
          onPress: () => {
            setContractsForOthers([]);
            Alert.alert('Contratos cancelados', 'Todos los contratos han sido cancelados exitosamente');
          }
        }
      ]
    );
  };

  const handleSubmitContract = async () => {
    if (contractStep === 1) {
      // Validar selección de plan y beneficiario (Paso 1: Opciones del Plan)
      if (!contractData.planType) {
        Alert.alert('Tipo de plan requerido', 'Por favor selecciona si quieres el plan mensual o anual.');
        return;
      }
      
      if (!contractData.beneficiary) {
        Alert.alert('Beneficiario requerido', 'Por favor selecciona si el plan es para ti o para un tercero.');
        return;
      }

      // Validar que no se pueda contratar más de un seguro para sí mismo
      if (contractData.beneficiary === 'para-mi' && myOwnContract.hasContract) {
        Alert.alert(
          'Ya tienes un seguro activo',
          'Solo puedes tener un seguro contratado para ti mismo. Si deseas contratar otro seguro, primero debes cancelar el seguro actual.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Avanzar al siguiente paso
      setContractStep(2);
    } else if (contractStep === 2) {
      // Validar campos obligatorios del paso 2 (Información Personal)
      const requiredFields = ['phone', 'email', 'firstName', 'paternalLastName', 'maternalLastName', 'birthDate'];
      const missingFields = requiredFields.filter(field => !contractData[field as keyof typeof contractData]);
      
      if (missingFields.length > 0) {
        Alert.alert('Campos requeridos', 'Por favor completa todos los campos obligatorios.');
        return;
      }

      // Validar RFC o CURP según la edad
      // Convert DD/MM/YYYY to Date object
      const dateParts = contractData.birthDate.split('/');
      const birthDate = dateParts.length === 3 
        ? new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]))
        : new Date(contractData.birthDate);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age >= 18 && !contractData.rfc) {
        Alert.alert('RFC requerido', 'El RFC con homoclave es obligatorio para mayores de edad.');
        return;
      }
      
      if (age < 18 && !contractData.curp) {
        Alert.alert('CURP requerido', 'El CURP es obligatorio para menores de edad.');
        return;
      }

      // Validar género
      if (!contractData.gender) {
        Alert.alert('Género requerido', 'Por favor selecciona tu género.');
        return;
      }

      // Avanzar al paso de PIN
      setContractStep(3);
    } else if (contractStep === 3) {
      // Validar PIN - es obligatorio y debe tener 4 dígitos
      if (!contractData.pin || contractData.pin.length !== 4) {
        Alert.alert('PIN requerido', 'Por favor ingresa un PIN de 4 dígitos para confirmar la contratación.');
        return;
      }

      if (isSubmitting) return;
      setIsSubmitting(true);

      try {
        // Seleccionar el primer plan disponible (o usar un planId por defecto)
        const selectedPlanId = insurancePlans.length > 0 ? insurancePlans[0].id : 'default-plan';

        // Procesar la contratación final
        // Convert birthDate from DD/MM/YYYY to YYYY-MM-DD for backend
        const formattedBirthDate = convertDateToBackendFormat(contractData.birthDate);
        const response = await InsuranceService.contractInsurance({
          planId: selectedPlanId,
          beneficiary: contractData.beneficiary as 'para-mi' | 'tercero',
          phone: contractData.phone,
          email: contractData.email,
          firstName: contractData.firstName,
          secondName: contractData.secondName,
          paternalLastName: contractData.paternalLastName,
          maternalLastName: contractData.maternalLastName,
          birthDate: formattedBirthDate,
          rfc: contractData.rfc,
          curp: contractData.curp,
          gender: contractData.gender,
          planType: contractData.planType as 'mensual' | 'anual',
          pin: contractData.pin,
        });

        if (response.success) {
          // Recargar datos para actualizar el balance disponible y los contratos
          await reloadData();
          await loadInsuranceData();
          
          Alert.alert(
            'Contratación exitosa',
            `Tu plan CiENTe+ ${contractData.planType} ha sido contratado exitosamente ${contractData.beneficiary === 'para-mi' ? 'para ti' : 'para un tercero'}. Recibirás un correo de confirmación.\n\n⚠️ Importante: El contrato inicia el primer día de cada mes y se renueva automáticamente el primer día de cada mes.`,
            [
              {
                text: 'OK',
                onPress: () => {
                  setShowContractModal(false);
                  setContractStep(1);
                  setContractData({
                    phone: '',
                    email: '',
                    firstName: '',
                    secondName: '',
                    paternalLastName: '',
                    maternalLastName: '',
                    birthDate: '',
                    rfc: '',
                    curp: '',
                    gender: '',
                    planType: '',
                    beneficiary: '',
                    pin: ''
                  });
                }
              }
            ]
          );
        } else {
          throw new Error(response.error || 'Error al contratar el seguro');
        }
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Error al contratar el seguro');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
      <ScrollView 
        ref={scrollViewRef} 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingInsurance}
            onRefresh={loadInsuranceData}
            tintColor="#3dbac6"
            colors={["#3dbac6"]}
          />
        }
      >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Plan CiENTe+</Text>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => setShowHelpModal(true)}
          >
            <Ionicons name="help-circle" size={24} color="#3dbac6" />
          </TouchableOpacity>
        </View>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(availableBalance)}</Text>
        </View>
      </View>

      <View style={styles.centInsurance}>
        <View style={styles.centInsuranceHeader}>
          <View style={styles.shieldContainer}>
            <Feather name="shield" size={24} color="white" />
          </View>
          <Text style={styles.centInsuranceTitle}>CiENTe+</Text>
        </View>
      </View>

      {/* Protection Details Section */}
      <View ref={coverageSectionRef} style={styles.protectionSection}>
        <Text style={styles.benefitsTitle}>Beneficios para ti</Text>
        <View style={styles.protectionHeader}>
          <Feather name="shield" size={24} color="#3dbac6" />
          <Text style={styles.protectionTitle}>CiENTe+ Seguridad</Text>
        </View>
        
        {/* Coberturas principales */}
        <View style={styles.protectionCard}>
          <View style={styles.protectionCardHeader}>
            <Ionicons name="star" size={32} color="#FFD700" />
            <Text style={styles.protectionCardTitle}>Coberturas principales</Text>
          </View>
          
          <Text style={styles.coverageDescription}>
            Doble Respaldo Financiero ante imprevistos: $50,000 MXN en Gastos Médicos por accidente y $50,000 MXN en Seguro de Vida accidental
          </Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Gastos médicos por accidente: hasta $50,000 MXN</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Seguro de vida: $50,000 MXN</Text>
            </View>
          </View>
        </View>

        {/* Cobertura funeraria */}
        <View style={styles.protectionCard}>
          <View style={styles.protectionCardHeader}>
            <Ionicons name="rose" size={32} color="#9C27B0" />
            <View style={{ flex: 1 }}>
              <Text style={styles.protectionCardTitle}>Cobertura funeraria{'\n'}(CENT Funerario 360)</Text>
            </View>
          </View>
          
          <Text style={styles.coverageDescription}>
            Servicio funerario completo (CENT Funerario 360) para el asegurado y Acompañamiento Emocional (sesiones ilimitadas por videollamada, extensible a la familia)
          </Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Recolección del cuerpo (hasta 30 km)</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Embalsamado y arreglo estético</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Ataúd estándar</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Sala de velación</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Segundo traslado al cementerio o crematorio</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Urna básica (si aplica cremación)</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Atención tanatológica telefónica para un familiar</Text>
            </View>
          </View>
        </View>

        {/* Salud preventiva y bienestar */}
        <View style={styles.protectionCard}>
          <View style={styles.protectionCardHeader}>
            <Ionicons name="heart" size={32} color="#4CAF50" />
            <Text style={styles.protectionCardTitle}>Salud preventiva y bienestar</Text>
          </View>
          
          <Text style={styles.coverageDescription}>
            Estudio clínico anual (con receta médica), Plan Dental (limpieza, diagnóstico, radiografía + descuentos), Plan Visual (examen + descuentos en lentes) y Red Médica Nacional con descuentos
          </Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Plan dental (limpieza, RX, diagnóstico)</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Plan visual (examen + descuentos)</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Estudio clínico anual (mujeres)</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Estudio clínico anual (hombres)</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Descuentos médicos en red</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Videollamadas médicas 24/7</Text>
            </View>
          </View>
        </View>

        {/* Servicios adicionales y asistencias */}
        <View style={styles.protectionCard}>
          <View style={styles.protectionCardHeader}>
            <Ionicons name="car" size={32} color="#FF9800" />
            <Text style={styles.protectionCardTitle}>Servicios adicionales y asistencias</Text>
          </View>
          
          <Text style={styles.coverageDescription}>
            Servicio de taxi o ambulancia en caso de emergencia y asistencias adicionales por medio de videollamada
          </Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Taxi y ambulancia seguro en caso de emergencia</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Asistencia legal, psicológica, nutricional, hogar o tecnológica por videollamada</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Beneficio de Telefonía Section */}
      <View style={styles.protectionSection}>
        <Text style={styles.benefitsTitle}>Beneficios para ti y tu familia</Text>
        
        {/* LHOGROS NET - Acompañamiento Emocional */}
        <View style={styles.protectionCard}>
          <View style={styles.protectionCardHeader}>
            <Ionicons name="heart" size={32} color="#E91E63" />
            <Text style={styles.protectionCardTitle}>LHOGROS NET, Acompañamiento Emocional</Text>
          </View>
          
          <Text style={styles.coverageDescription}>
            Acompañamiento emocional, reconociendo que el bienestar también es emocional. Contacto directo con especialistas o un profesional.
          </Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Sesiones por videollamada ilimitadas</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Apoyo profesional durante crisis</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Herramientas para sanar y seguir adelante</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Permite agendar una sesión por videollamada</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.protectionHeader}>
          <Ionicons name="phone-portrait" size={24} color="#3dbac6" />
          <Text style={styles.protectionTitle}>CiENTe+ Conectividad
          </Text>
        </View>
        
        {/* Telefonía Gratis */}
        <View style={styles.protectionCard}>
          <View style={styles.protectionCardHeader}>
            <Ionicons name="phone-portrait" size={32} color="#3dbac6" />
            <Text style={styles.protectionCardTitle}>1 mes de telefonía gratis</Text>
          </View>
          
          <Text style={styles.coverageDescription}>
            Primer mes ¡GRATIS! Después, tarifa preferencial de $150 MXN al mes. Incluye 12 GB de datos a máxima velocidad, Redes Sociales, llamadas y SMS ilimitados (México, USA y Canadá)
          </Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="wifi" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>12 GB de internet</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="share-social" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Redes sociales ilimitadas</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="call" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Llamadas y SMS ilimitadas</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="globe" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Cobertura en México, USA y Canadá</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="save" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Acumula GB (se guardan para el siguiente mes)</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="link" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Para activarlo: Ingresa al link, haz portabilidad y paga $50 por SIM</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="card" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Después del mes gratis: $150 pesos mensuales</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="people" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Válido para toda tu familia con el plan CiENTe+</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Financial Control Benefits Section */}
      <View style={styles.protectionSection}>
        <View style={styles.protectionHeader}>
          <Ionicons name="chatbubbles" size={24} color="#3dbac6" />
          <Text style={styles.protectionTitle}>CiENTe+ Control</Text>
        </View>
        
        <View style={[styles.protectionCard, styles.whatsappCard]}>
          <View style={styles.protectionCardHeader}>
            <Ionicons name="chatbubbles" size={32} color="#25D366" />
            <Text style={styles.protectionCardTitle}>Asistente financiero{'\n'}por WhatsApp</Text>
          </View>
          
          <Text style={styles.coverageDescription}>
            Tu asistente personal en WhatsApp. Registra ingresos y gastos con solo un mensaje de texto. Incluye 40 movimientos mensuales y estadísticas básicas
          </Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={{ marginTop: 2 }} />
              <Text style={styles.benefitText}>Registro de hasta 40 movimientos al mes:{'\n'}20 gastos y 20 ingresos por mensaje de texto.</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={{ marginTop: 2 }} />
              <Text style={styles.benefitText}>Estadísticas simples:{'\n'}Totales mensuales básicos para control claro de tus finanzas.</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={{ marginTop: 2 }} />
              <Text style={styles.benefitText}>Soporte técnico estándar:{'\n'}Apoyo necesario para resolver tus dudas.</Text>
            </View>
          </View>
        </View>
      </View>

      {/* CiENTe+ Tranquilidad Section */}
      <View style={styles.protectionSection}>
        <View style={styles.protectionHeader}>
          <Ionicons name="heart-outline" size={24} color="#3dbac6" />
          <Text style={styles.protectionTitle}>CiENTe+ Tranquilidad</Text>
        </View>
        
        {/* Curso Finanzas con CENTIDO */}
        <View style={styles.protectionCard}>
          <View style={styles.protectionCardHeader}>
            <Ionicons name="school" size={32} color="#3dbac6" />
            <Text style={styles.protectionCardTitle}>Curso Finanzas con CENTIDO</Text>
          </View>
          
          <Text style={styles.coverageDescription}>
            Acceso a un curso online motivador para reducir el estrés financiero, aprender a usar el crédito inteligentemente y hacer un presupuesto efectivo
          </Text>
          
          <Text style={styles.sectionSubtitle}>Los temas principales son:</Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Presupuesto y Ahorro:</Text> Aprende a hacer un presupuesto y por qué no es suficiente solo guardar dinero.
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Crédito e Inversión:</Text> Uso inteligente del crédito, nociones de planeación fiscal y bases de inversión.
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Control con IA:</Text> Uso de herramientas modernas (apps e inteligencia artificial) para simplificar el manejo de tus finanzas.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* CiENTe+ Progreso Section */}
      <View style={styles.protectionSection}>
        <View style={styles.protectionHeader}>
          <Ionicons name="trending-up" size={24} color="#3dbac6" />
          <Text style={styles.protectionTitle}>CiENTe+ Progreso</Text>
        </View>
        
        {/* VICENTE + Asistente Financiero */}
        <View style={styles.protectionCard}>
          <View style={styles.protectionCardHeader}>
            <Ionicons name="person-circle" size={32} color="#3dbac6" />
            <Text style={styles.protectionCardTitle}>VICENTE + Tu Asistente Financiero Personal</Text>
          </View>
          
          <Text style={styles.coverageDescription}>
            VICENTE PLUS te ayuda a resolver dudas de finanzas y a crecer tu dinero con inversiones. Gestiona metas de ahorro con rendimiento, registra ingresos/gastos y programa pagos recurrentes directamente en la app
          </Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitNumber}>1.</Text>
              <Text style={[styles.benefitText, { marginLeft: 0 }]}>
                <Text style={styles.benefitBold}>Asistente Personal:</Text> Resuelve dudas y ayuda a mejores decisiones.
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitNumber}>2.</Text>
              <Text style={[styles.benefitText, { marginLeft: 0 }]}>
                <Text style={styles.benefitBold}>Metas con Rendimiento:</Text> Define y sigue metas de ahorro con rendimiento.
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitNumber}>3.</Text>
              <Text style={[styles.benefitText, { marginLeft: 0 }]}>
                <Text style={styles.benefitBold}>Control y Registro:</Text> Permite registrar ingresos y gastos en la app.
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitNumber}>4.</Text>
              <Text style={[styles.benefitText, { marginLeft: 0 }]}>
                <Text style={styles.benefitBold}>Organiza su Dinero:</Text> Apoya a crecer su dinero con inversiones y organiza sus finanzas.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.featuredHeader}>
        <Text style={styles.featuredTitle}></Text>
        {/*<FontAwesome name="star" size={20} color="#FFD700" />*/}
      </View>

      <TouchableOpacity style={styles.featuredCard}>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop&q=60' }}
          style={styles.cardImage}
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Contrata tu plan CiENTe+</Text>
          <Text style={styles.cardDescription}>

          </Text>
          
          <View style={styles.coverageInfo}>
            <Text style={styles.coverageText}>Duración: Mensual / Anual</Text>
            <Text style={styles.durationText}>Es una solución integral diseñada
para protegerte y beneficiarte.
Incluye: Seguro exclusivo de CENT,
respaldado por THONA Seguros, un
mes de servicio de telefonía sin
costo, precios preferenciales y
acceso curso de finanzas personales.</Text>
          </View>
          
          <View style={styles.priceSection}>
            <Text style={styles.priceAmount}>$116 MXN /MES</Text>
            <TouchableOpacity 
              style={styles.contractButton}
              onPress={() => setShowContractModal(true)}
            >
              <Text style={styles.contractButtonText}>CONTRATAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      <ContractedForYouCard
        data={contractedBySomeone}
        styles={styles}
        onPressCoverage={scrollToCoverage}
      />

      <MyContractCard
        data={myOwnContract}
        styles={styles}
        onPressCoverage={scrollToCoverage}
        onCancel={handleCancelMyContract}
      />

      <ContractsForOthersList
        contracts={contractsForOthers}
        styles={styles}
        onPressCoverage={scrollToCoverage}
        onCancel={handleCancelContractForOther}
      />

      {/* Important Notice Card */}
      <View style={styles.protectionSection}>
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Ionicons name="alert-circle" size={24} color="#3dbac6" />
            <Text style={styles.noticeTitle}>Información Importante</Text>
          </View>
          
          <Text style={styles.noticeText}>
            El costo del seguro (116 pesos mensuales) se carga directamente a tu cuenta CENT. Si no hay balance suficiente, el seguro se cancelará automáticamente y podrás reactivarlo cuando vuelvas a contratar.
          </Text>
          
         
        </View>
      </View>

      {/* Calculadora de costos sin seguro */}
      <View style={styles.calculatorCard}>
        <View style={styles.calculatorTitleContainer}>
          <Text style={styles.calculatorTitle}>Calculadora de costos sin seguro</Text>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => setShowCalculatorHelpModal(true)}
          >
            <Ionicons name="help-circle" size={24} color="#3dbac6" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.calculatorButton}
          onPress={() => setShowCosts(!showCosts)}
        >
          <Text style={styles.calculatorButtonText}>Calcular</Text>
        </TouchableOpacity>
        {showCosts && (
          <View style={styles.costsContainer}>
            {/* 1. Accidentes y gastos médicos */}
            <View style={styles.costCategoryCard}>
              <View style={styles.costCategoryHeader}>
                <Ionicons name="medkit" size={24} color="#C62828" />
                <Text style={styles.costCategoryTitle}>1. Accidentes y gastos médicos</Text>
              </View>
              <View style={styles.costItemList}>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Gastos médicos por accidente</Text>
                  <Text style={[styles.costItemAmount, {color: '#C62828'}]}>$5,000 – $30,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Ambulancia nacional (2 eventos/año)</Text>
                  <Text style={[styles.costItemAmount, {color: '#C62828'}]}>$5,000 – $12,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Médico a domicilio</Text>
                  <Text style={[styles.costItemAmount, {color: '#C62828'}]}>$800 – $2,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Enfermera a domicilio</Text>
                  <Text style={[styles.costItemAmount, {color: '#C62828'}]}>$600 – $1,500</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Videollamada médica 24/7</Text>
                  <Text style={[styles.costItemAmount, {color: '#C62828'}]}>$300 – $800 por consulta</Text>
                </View>
              </View>
              <View style={styles.subtotalContainer}>
                <Text style={styles.subtotalText}>Subtotal estimado sin seguro:</Text>
                <Text style={[styles.subtotalAmount, {color: '#C62828'}]}>$11,700 – $46,300</Text>
              </View>
            </View>

            {/* 2. Cobertura funeraria */}
            <View style={styles.costCategoryCard}>
              <View style={styles.costCategoryHeader}>
                <Ionicons name="rose" size={24} color="#9C27B0" />
                <Text style={styles.costCategoryTitle}>2. Cobertura funeraria</Text>
              </View>
              <View style={styles.costItemList}>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Gastos funerarios por accidente</Text>
                  <Text style={[styles.costItemAmount, {color: '#9C27B0'}]}>$25,000 – $45,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Recolección del cuerpo (30 km)</Text>
                  <Text style={[styles.costItemAmount, {color: '#9C27B0'}]}>$1,500 – $3,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Embalsamado y arreglo estético</Text>
                  <Text style={[styles.costItemAmount, {color: '#9C27B0'}]}>$3,000 – $6,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Ataúd estándar</Text>
                  <Text style={[styles.costItemAmount, {color: '#9C27B0'}]}>$8,000 – $15,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Sala de velación</Text>
                  <Text style={[styles.costItemAmount, {color: '#9C27B0'}]}>$5,000 – $10,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Segundo traslado</Text>
                  <Text style={[styles.costItemAmount, {color: '#9C27B0'}]}>$2,000 – $4,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Urna básica (si cremación)</Text>
                  <Text style={[styles.costItemAmount, {color: '#9C27B0'}]}>$1,500 – $3,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Atención tanatológica telefónica</Text>
                  <Text style={[styles.costItemAmount, {color: '#9C27B0'}]}>$500 – $1,500</Text>
                </View>
              </View>
              <View style={styles.subtotalContainer}>
                <Text style={styles.subtotalText}>Subtotal estimado sin seguro:</Text>
                <Text style={[styles.subtotalAmount, {color: '#9C27B0'}]}>$46,500 – $87,500</Text>
              </View>
            </View>

            {/* 3. Salud preventiva y bienestar */}
            <View style={styles.costCategoryCard}>
              <View style={styles.costCategoryHeader}>
                <Ionicons name="heart" size={24} color="#4CAF50" />
                <Text style={styles.costCategoryTitle}>3. Salud preventiva y bienestar</Text>
              </View>
              <View style={styles.costItemList}>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Plan dental (limpieza, RX, diagnóstico)</Text>
                  <Text style={[styles.costItemAmount, {color: '#4CAF50'}]}>$600 – $1,200</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Plan visual (examen + descuentos)</Text>
                  <Text style={[styles.costItemAmount, {color: '#4CAF50'}]}>$300 – $700</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Estudio clínico anual (mujeres)</Text>
                  <Text style={[styles.costItemAmount, {color: '#4CAF50'}]}>$1,000 – $2,500</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Estudio clínico anual (hombres)</Text>
                  <Text style={[styles.costItemAmount, {color: '#4CAF50'}]}>$800 – $2,000</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Descuentos médicos en red</Text>
                  <Text style={[styles.costItemAmount, {color: '#4CAF50'}]}>Ahorro variable</Text>
                </View>
              </View>
              <View style={styles.subtotalContainer}>
                <Text style={styles.subtotalText}>Subtotal estimado sin seguro:</Text>
                <Text style={[styles.subtotalAmount, {color: '#4CAF50'}]}>$2,700 – $6,400</Text>
              </View>
            </View>

            {/* 4. Servicios adicionales y asistencias */}
            <View style={styles.costCategoryCard}>
              <View style={styles.costCategoryHeader}>
                <Ionicons name="car" size={24} color="#FF9800" />
                <Text style={styles.costCategoryTitle}>4. Servicios adicionales y asistencias</Text>
              </View>
              <View style={styles.costItemList}>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Taxi seguro en caso de emergencia</Text>
                  <Text style={[styles.costItemAmount, {color: '#FF9800'}]}>$150 – $400</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costItemText}>Asistencia legal, psicológica, nutricional, hogar o tecnológica</Text>
                  <Text style={[styles.costItemAmount, {color: '#FF9800'}]}>$500 – $2,000 cada servicio</Text>
                </View>
              </View>
              <View style={styles.subtotalContainer}>
                <Text style={styles.subtotalText}>Subtotal estimado sin seguro:</Text>
                <Text style={[styles.subtotalAmount, {color: '#FF9800'}]}>$650 – $2,400</Text>
              </View>
            </View>

            {/* Resumen Global */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="calculator" size={24} color="#3dbac6" />
                <Text style={styles.summaryTitle}>Resumen Global</Text>
              </View>
              <View style={styles.summaryList}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemText}>Accidentes y médicos:</Text>
                  <Text style={[styles.summaryItemAmount, {color: '#C62828'}]}>$11,700 – $46,300</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemText}>Funerario:</Text>
                  <Text style={[styles.summaryItemAmount, {color: '#9C27B0'}]}>$46,500 – $87,500</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemText}>Salud preventiva:</Text>
                  <Text style={[styles.summaryItemAmount, {color: '#4CAF50'}]}>$2,700 – $6,400</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemText}>Asistencias adicionales:</Text>
                  <Text style={[styles.summaryItemAmount, {color: '#FF9800'}]}>$650 – $2,400</Text>
                </View>
              </View>
              <View style={styles.totalContainer}>
                <Text style={styles.totalText}>👉 Costo total estimado sin seguro:</Text>
                <Text style={[styles.totalAmount, {color: '#3dbac6'}]}>$61,550 – $142,600 MXN al año</Text>
                <Text style={styles.insuranceCostText}>👉 Costo del Seguro CENT x Thona:</Text>
                <Text style={styles.insuranceCostAmount}>$1,200 MXN + IVA al año por persona</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Información del Seguro</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowHelpModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>¿Qué es?</Text>
                <Text style={styles.helpText}>
                  Es un plan de protección integral que cuida de ti y tu familia. Incluye cobertura médica, apoyo en caso de eventos catastróficos y asistencia funeraria por un costo accesible mensual.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>Cómo usar</Text>
                <View style={styles.stepList}>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.stepText}>Ingresa a la sección Seguros CENT.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.stepText}>Revisa los planes disponibles y su cobertura.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.stepText}>Selecciona el seguro que quieras contratar.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>4</Text>
                    </View>
                    <Text style={styles.stepText}>Confirma el pago mensual o anual y tu póliza quedará activa.</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Calculator Help Modal */}
      <Modal
        visible={showCalculatorHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCalculatorHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Información de la Calculadora</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowCalculatorHelpModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>¿Qué es?</Text>
                <Text style={styles.helpText}>
                  Es una herramienta que te muestra cuánto podrían costarte emergencias médicas, accidentes o cirugías si no cuentas con un seguro.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>Cómo usar</Text>
                <View style={styles.stepList}>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.stepText}>Abre la calculadora en la sección Seguros.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.stepText}>Selecciona el tipo de evento (emergencia, accidente, hospitalización, cirugía).</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.stepText}>Verás el rango estimado de costos que deberías cubrir sin seguro.</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Contract Modal */}
      <Modal
        visible={showContractModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowContractModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Contratar Plan CiENTe+ ({contractStep}/3)
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowContractModal(false);
                  setContractStep(1);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Paso 1: Opciones del Plan */}
              {contractStep === 1 && (
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Opciones del Plan</Text>
                  
                  {/* Tipo de plan */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Tipo de plan *</Text>
                    <View style={styles.planTypeContainer}>
                      <TouchableOpacity 
                        style={[
                          styles.planTypeButton,
                          contractData.planType === 'mensual' && styles.planTypeButtonSelected
                        ]}
                        onPress={() => handleInputChange('planType', 'mensual')}
                      >
                        <Ionicons 
                          name="calendar" 
                          size={20} 
                          color={contractData.planType === 'mensual' ? '#3dbac6' : '#666'} 
                        />
                        <Text style={[
                          styles.planTypeText,
                          contractData.planType === 'mensual' && styles.planTypeTextSelected
                        ]}>
                          Mensual
                        </Text>
                        <Text style={styles.planTypePrice}>$100 MXN/mes + IVA</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[
                          styles.planTypeButton,
                          contractData.planType === 'anual' && styles.planTypeButtonSelected
                        ]}
                        onPress={() => handleInputChange('planType', 'anual')}
                      >
                        <Ionicons 
                          name="calendar-outline" 
                          size={20} 
                          color={contractData.planType === 'anual' ? '#3dbac6' : '#666'} 
                        />
                        <Text style={[
                          styles.planTypeText,
                          contractData.planType === 'anual' && styles.planTypeTextSelected
                        ]}>
                          Anual
                        </Text>
                        <Text style={styles.planTypePrice}>$1,000 MXN/año + IVA</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Beneficiario */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>¿Para quién es el plan? *</Text>
                    <View style={styles.beneficiaryContainer}>
                      <TouchableOpacity 
                        style={[
                          styles.beneficiaryButton,
                          contractData.beneficiary === 'para-mi' && styles.beneficiaryButtonSelected
                        ]}
                        onPress={() => handleInputChange('beneficiary', 'para-mi')}
                      >
                        <Ionicons 
                          name="person" 
                          size={20} 
                          color={contractData.beneficiary === 'para-mi' ? '#3dbac6' : '#666'} 
                        />
                        <Text style={[
                          styles.beneficiaryText,
                          contractData.beneficiary === 'para-mi' && styles.beneficiaryTextSelected
                        ]}>
                          Para mí
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[
                          styles.beneficiaryButton,
                          contractData.beneficiary === 'tercero' && styles.beneficiaryButtonSelected
                        ]}
                        onPress={() => handleInputChange('beneficiary', 'tercero')}
                      >
                        <Ionicons 
                          name="people" 
                          size={20} 
                          color={contractData.beneficiary === 'tercero' ? '#3dbac6' : '#666'} 
                        />
                        <Text style={[
                          styles.beneficiaryText,
                          contractData.beneficiary === 'tercero' && styles.beneficiaryTextSelected
                        ]}>
                          Para un tercero
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Botón continuar */}
                  <TouchableOpacity
                    style={[styles.submitButton, styles.fullWidthButton]}
                    onPress={handleSubmitContract}
                  >
                    <Text style={styles.submitButtonText}>Continuar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Paso 2: Información Personal */}
              {contractStep === 2 && (
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Información Personal</Text>
                  
                  {/* Teléfono */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Número de teléfono *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={contractData.phone}
                      onChangeText={(value) => handleInputChange('phone', value)}
                      placeholder="Ej: 5512345678"
                      keyboardType="phone-pad"
                    />
                  </View>

                  {/* Email */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Correo electrónico *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={contractData.email}
                      onChangeText={(value) => handleInputChange('email', value)}
                      placeholder={contractData.beneficiary === 'para-mi' ? "tu@email.com" : "email@ejemplo.com"}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Nombre */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nombre *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={contractData.firstName}
                      onChangeText={(value) => handleInputChange('firstName', value)}
                      placeholder={contractData.beneficiary === 'para-mi' ? "Tu nombre" : "Nombre"}
                    />
                  </View>

                  {/* Segundo nombre */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Segundo nombre (opcional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={contractData.secondName}
                      onChangeText={(value) => handleInputChange('secondName', value)}
                      placeholder={contractData.beneficiary === 'para-mi' ? "Tu segundo nombre" : "Segundo nombre"}
                    />
                  </View>

                  {/* Apellido paterno */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Apellido paterno *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={contractData.paternalLastName}
                      onChangeText={(value) => handleInputChange('paternalLastName', value)}
                      placeholder={contractData.beneficiary === 'para-mi' ? "Tu apellido paterno" : "Apellido paterno"}
                    />
                  </View>

                  {/* Apellido materno */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Apellido materno *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={contractData.maternalLastName}
                      onChangeText={(value) => handleInputChange('maternalLastName', value)}
                      placeholder={contractData.beneficiary === 'para-mi' ? "Tu apellido materno" : "Apellido materno"}
                    />
                  </View>

                  {/* Fecha de nacimiento */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fecha de nacimiento *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={contractData.birthDate}
                      onChangeText={handleBirthDateChange}
                      placeholder="DD/MM/AAAA"
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>

                  {/* RFC */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>RFC con homoclave (mayores de 18 años)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={contractData.rfc}
                      onChangeText={(value) => handleInputChange('rfc', value)}
                      placeholder="Ej: ABC123456789"
                      autoCapitalize="characters"
                    />
                  </View>

                  {/* CURP */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CURP (menores de 18 años)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={contractData.curp}
                      onChangeText={(value) => handleInputChange('curp', value)}
                      placeholder="Ej: ABC123456HDFXXX01"
                      autoCapitalize="characters"
                    />
                  </View>

                  {/* Género */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Sexo *</Text>
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => setGenderDropdownVisible(!genderDropdownVisible)}
                    >
                      <Text style={[styles.dropdownButtonText, !contractData.gender && styles.placeholderText]}>
                        {contractData.gender || (contractData.beneficiary === 'para-mi' ? 'Selecciona tu género' : 'Selecciona el género')}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                    
                    <Modal
                      visible={genderDropdownVisible}
                      transparent={true}
                      animationType="fade"
                      onRequestClose={() => setGenderDropdownVisible(false)}
                    >
                      <TouchableOpacity
                        style={styles.dropdownOverlay}
                        activeOpacity={1}
                        onPress={() => setGenderDropdownVisible(false)}
                      >
                        <View style={styles.dropdownContent}>
                          <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                              handleInputChange('gender', 'Masculino');
                              setGenderDropdownVisible(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>Masculino</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                              handleInputChange('gender', 'Femenino');
                              setGenderDropdownVisible(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>Femenino</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </Modal>
                  </View>

                  {/* Botones de navegación */}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => setContractStep(1)}
                    >
                      <Text style={styles.backButtonText}>Regresar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.submitButtonRow}
                      onPress={handleSubmitContract}
                    >
                      <Text style={styles.submitButtonText}>Continuar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Paso 3: Confirmación con PIN */}
              {contractStep === 3 && (
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Confirmación</Text>
                  
                  {/* Leyenda sobre inicio y renovación */}
                  <View style={[styles.contractSummaryCard, { backgroundColor: '#E3F2FD', borderColor: '#3dbac6', borderWidth: 1, marginBottom: 16 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons name="information-circle" size={20} color="#3dbac6" style={{ marginRight: 8 }} />
                      <Text style={[styles.contractSummaryTitle, { color: '#3dbac6', fontSize: 14 }]}>Información importante</Text>
                    </View>
                    <Text style={{ color: '#1976D2', fontSize: 12, lineHeight: 18 }}>
                      El contrato inicia el primer día de cada mes y se renueva automáticamente el primer día de cada mes.
                    </Text>
                  </View>
                  
                  {/* Resumen del plan */}
                  <View style={styles.contractSummaryCard}>
                    <Text style={styles.contractSummaryTitle}>Resumen de tu plan</Text>
                    <View style={styles.contractSummaryItem}>
                      <Text style={styles.contractSummaryLabel}>Plan:</Text>
                      <Text style={styles.contractSummaryValue}>CiENTe+ {contractData.planType}</Text>
                    </View>
                    <View style={styles.contractSummaryItem}>
                      <Text style={styles.contractSummaryLabel}>Beneficiario:</Text>
                      <Text style={styles.contractSummaryValue}>
                        {contractData.beneficiary === 'para-mi' ? 'Para ti' : 'Para un tercero'}
                      </Text>
                    </View>
                    <View style={styles.contractSummaryItem}>
                      <Text style={styles.contractSummaryLabel}>Costo:</Text>
                      <Text style={styles.contractSummaryValue}>
                        {contractData.planType === 'mensual' ? '$116 MXN/mes' : '$1,160 MXN/año'}
                      </Text>
                    </View>
                  </View>

                  {/* PIN */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Ingresa tu PIN de 4 dígitos *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={contractData.pin}
                      onChangeText={(value) => handleInputChange('pin', value)}
                      placeholder="••••"
                      keyboardType="numeric"
                      secureTextEntry={true}
                      maxLength={4}
                    />
                    <Text style={styles.inputHelper}>El PIN es obligatorio y debe ser correcto para contratar el seguro</Text>
                  </View>

                  {/* Botones de navegación */}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => setContractStep(2)}
                    >
                      <Text style={styles.backButtonText}>Regresar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.submitButtonRow, isSubmitting && { opacity: 0.6 }]}
                      onPress={handleSubmitContract}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.submitButtonText}>{isSubmitting ? 'Procesando...' : 'Contratar Plan'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Espacio adicional al final */}
              <View style={styles.bottomSpacing} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F7',
    padding: 16,
    marginTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  helpButton: {
    padding: 4,
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  centInsurance: {
    marginBottom: 12,
  },
  centInsuranceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.3)',
  },
  shieldContainer: {
    backgroundColor: '#2ecc71',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  centInsuranceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 8,
  },
  featuredCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  coverageInfo: {
    marginTop: 16,
    marginBottom: 16,
  },
  coverageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  durationText: {
    fontSize: 14,
    color: '#666',
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  priceContainer: {
    alignItems: 'flex-start',
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  pricePeriod: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  contractButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  contractButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  contractedSection: {
    marginTop: 24,
  },
  contractedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#CE93D8',
    marginBottom: 16,
  },
  contractedCard: {
    backgroundColor: 'rgba(156, 39, 176, 0.4)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  contractedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  contractedShield: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contractedInfo: {
    flex: 1,
  },
  contractedPlanTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  contractedDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  contractedDetails: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 16,
  },
  contractedDetail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    lineHeight: 20,
  },
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(156, 39, 176, 0.2)',
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  protectionSection: {
    marginTop: 24,
  },
  benefitsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 16,
  },
  protectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  protectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  protectionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    flex: 1,
    maxWidth: '100%',
  },
  protectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  protectionCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  coverageDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 0,
    marginBottom: 16,
    lineHeight: 18,
    textAlign: 'left',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 12,
  },
  benefitBold: {
    fontWeight: 'bold',
  },
  benefitsList: {
    gap: 12,
    flex: 1,
    marginTop: 0,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  benefitNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginRight: 8,
    minWidth: 20,
  },
  benefitText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 20,
    maxWidth: '90%',
  },
  exclusionCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  exclusionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  exclusionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C62828',
    marginLeft: 12,
  },
  exclusionList: {
    gap: 12,
  },
  exclusionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exclusionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  noticeCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginLeft: 12,
  },
  noticeText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 16,
  },
  phoneSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  phoneText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  phoneNumber: {
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  phoneIcon: {
    marginTop: 2,
  },
  calculatorCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    marginBottom: 24,
  },
  calculatorTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calculatorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F57C00',
  },
  calculatorButton: {
    backgroundColor: '#F57C00',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  calculatorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  costsContainer: {
    gap: 16,
  },
  costCategoryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  // Telephony Card Styles
  telephonyCard: {
    backgroundColor: '#EFF3FE',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3dbac6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  telephonyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  telephonyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginLeft: 12,
    flex: 1,
  },
  telephonyFeatures: {
    marginBottom: 16,
  },
  telephonyFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  telephonyFeatureText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  telephonyActivation: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  activationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  activationSteps: {
    gap: 6,
  },
  activationStep: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  telephonyPricing: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 16,
  },
  pricingText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  pricingHighlight: {
    fontWeight: 'bold',
    color: '#F57C00',
  },
  familyText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
  },
  costCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  costCategoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  costItemList: {
    gap: 8,
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  costItemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  costItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C62828',
    textAlign: 'right',
  },
  subtotalContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  subtotalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  subtotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C62828',
    alignSelf: 'flex-end',
  },
  summaryCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginLeft: 12,
  },
  summaryList: {
    gap: 8,
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  summaryItemAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  totalContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#BBDEFB',
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#C62828',
    marginBottom: 12,
  },
  insuranceCostText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  insuranceCostAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    paddingBottom: 10,
  },
  helpSection: {
    marginBottom: 24,
  },
  helpSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  stepList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    backgroundColor: '#3dbac6',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  // Contract Form Styles
  formSection: {
    marginBottom: 16,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  inputHelper: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    padding: 12,
    borderRadius: 4,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButtonRow: {
    flex: 1,
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  bottomSpacing: {
    height: 20,
  },
  // New Contract Modal Styles
  planTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  planTypeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  planTypeButtonSelected: {
    borderColor: '#3dbac6',
    backgroundColor: '#EFF3FE',
  },
  planTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  planTypeTextSelected: {
    color: '#3dbac6',
  },
  planTypePrice: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  beneficiaryContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  beneficiaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beneficiaryButtonSelected: {
    borderColor: '#3dbac6',
    backgroundColor: '#EFF3FE',
  },
  beneficiaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  beneficiaryTextSelected: {
    color: '#3dbac6',
  },
  contractSummaryCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  contractSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  contractSummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contractSummaryLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  contractSummaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 48,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  fullWidthButton: {
    width: '100%',
  },
  whatsappLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3dbac6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  whatsappLinkText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  whatsappCard: {
    overflow: 'hidden',
    width: '100%',
  },
  // Nuevos estilos para tarjetas de contratos
  purpleCard: {
    backgroundColor: 'rgba(156, 39, 176, 0.4)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  greenCard: {
    backgroundColor: 'rgba(46, 204, 113, 0.4)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  orangeCard: {
    backgroundColor: 'rgba(255, 152, 0, 0.4)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  greenSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginBottom: 16,
  },
  orangeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orangeSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 16,
  },
  greenShield: {
    backgroundColor: 'rgba(46, 204, 113, 0.8)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orangeShield: {
    backgroundColor: 'rgba(255, 152, 0, 0.8)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelAllButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelAllButtonText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Beneficios de Telefonía en Tarjetas de Contratos
  telephonyPlanButtonBranding: {
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  telephonyPlanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
}); 