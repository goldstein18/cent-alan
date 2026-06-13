import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Investment, useData } from '../contexts/DataContext';
import { InvestmentRatesService } from '../services/investmentRatesService';

type InvestmentRates = {
  pro: number;
  normal: number;
};

export default function Investments() {
  const { addInvestment, addDomiciliation, investments, pauseDomiciliation, resumeDomiciliation, cancelDomiciliation, updateDomiciliationSchedule, availableBalance, balanceBreakdown } = useData();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [investType, setInvestType] = useState<'normal' | 'pro'>('pro');
  const [investStep, setInvestStep] = useState(1); // 1: Amount & Term, 2: Summary, 3: PIN
  const [investData, setInvestData] = useState({
    amount: '',
    term: '', // 1, 3, 6, 12 months
    pin: ''
  });
  
  // Estados para domiciliación
  const [showDomiciliationModal, setShowDomiciliationModal] = useState(false);
  const [domiciliationStep, setDomiciliationStep] = useState(1);
  const [frequencyDropdownVisible, setFrequencyDropdownVisible] = useState(false);
  const [domiciliationData, setDomiciliationData] = useState({
    amount: '',
    periodicity: '', // 'semanal', 'quincenal', 'mensual'
    periodicityDays: '', // Días naturales
    chargeDay: '', // Día del mes para el cargo (1-31)
    paymentType: 'automatico', // Siempre automático para domiciliación
    startDate: '', // Fecha de inicio DD/MM/YYYY
    term: '', // Plazo en meses: 3, 6, 9, 12
    pin: ''
  });
  
  const frequencies = [
    { label: 'Diaria', value: 'diaria' },
    { label: 'Semanal', value: 'semanal' },
    { label: 'Quincenal', value: 'quincenal' },
    { label: 'Mensual', value: 'mensual' },
  ];
  
  // Estado para segment control
  const [activeSegment, setActiveSegment] = useState<'inversion' | 'domiciliacion'>('inversion');
  
  // Estado para filtro de inversiones (activas/vencidas)
  const [investmentFilter, setInvestmentFilter] = useState<'activas' | 'vencidas'>('activas');
  
  // Estados para gestión de domiciliaciones
  const [showDomiciliationManagementModal, setShowDomiciliationManagementModal] = useState(false);
  const [selectedDomiciliation, setSelectedDomiciliation] = useState<any>(null);
  const [showEditScheduleModal, setShowEditScheduleModal] = useState(false);

  const [rates, setRates] = useState<InvestmentRates | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(true);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setInvestData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDomiciliationInputChange = (field: string, value: string) => {
    setDomiciliationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStartDateChange = (text: string) => {
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
    
    handleDomiciliationInputChange('startDate', formatted);
  };

  const parseStartDate = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 10) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    return '';
  };

  const handleDomiciliationManagement = (investment: any) => {
    setSelectedDomiciliation(investment);
    setShowDomiciliationManagementModal(true);
  };

  const handlePauseDomiciliation = () => {
    if (!selectedDomiciliation) return;
    
    Alert.alert(
      'Pausar Domiciliación',
      '¿Estás seguro de que quieres pausar esta domiciliación? Se detendrán los cargos automáticos hasta que la reanudes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Pausar', 
          onPress: async () => {
            try {
              await pauseDomiciliation(selectedDomiciliation.id);
              setShowDomiciliationManagementModal(false);
              setSelectedDomiciliation(null);
              Alert.alert('Domiciliación pausada', 'La domiciliación ha sido pausada exitosamente.');
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Error al pausar la domiciliación');
            }
          }
        }
      ]
    );
  };

  const handleResumeDomiciliation = () => {
    if (!selectedDomiciliation) return;
    
    Alert.alert(
      'Reanudar Domiciliación',
      '¿Estás seguro de que quieres reanudar esta domiciliación? Se reanudarán los cargos automáticos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Reanudar', 
          onPress: async () => {
            try {
              await resumeDomiciliation(selectedDomiciliation.id);
              setShowDomiciliationManagementModal(false);
              setSelectedDomiciliation(null);
              Alert.alert('Domiciliación reanudada', 'La domiciliación ha sido reanudada exitosamente.');
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Error al reanudar la domiciliación');
            }
          }
        }
      ]
    );
  };

  const handleCancelDomiciliation = () => {
    if (!selectedDomiciliation) return;
    
    Alert.alert(
      'Cancelar Domiciliación',
      '¿Estás seguro de que quieres cancelar esta domiciliación? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sí, cancelar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelDomiciliation(selectedDomiciliation.id);
              setShowDomiciliationManagementModal(false);
              setSelectedDomiciliation(null);
              Alert.alert('Domiciliación cancelada', 'La domiciliación ha sido cancelada exitosamente.');
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Error al cancelar la domiciliación');
            }
          }
        }
      ]
    );
  };

  const handleEditSchedule = () => {
    if (!selectedDomiciliation) {
      return;
    }
    
    
    // Inicializar los datos con los valores actuales de la domiciliación
    let currentStartDate = '';
    if (selectedDomiciliation.startDate) {
      try {
        const date = new Date(selectedDomiciliation.startDate);
        currentStartDate = date.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch (e) {
        console.error('Error parsing startDate:', e);
      }
    } else if (selectedDomiciliation.nextChargeDate) {
      // Si no hay startDate, usar nextChargeDate como referencia
      try {
        const date = new Date(selectedDomiciliation.nextChargeDate);
        currentStartDate = date.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch (e) {
        console.error('Error parsing nextChargeDate:', e);
      }
    }
    
    setDomiciliationData(prev => ({
      ...prev,
      amount: selectedDomiciliation.amount?.toString() || '',
      periodicity: selectedDomiciliation.periodicity || '',
      startDate: currentStartDate,
    }));
    
    // Cerrar el modal de gestión y abrir el de edición
    setShowDomiciliationManagementModal(false);
    // Usar requestAnimationFrame para asegurar que el estado se actualice correctamente
    requestAnimationFrame(() => {
      setShowEditScheduleModal(true);
    });
  };

  const handleUpdateSchedule = async () => {
    if (!selectedDomiciliation) return;
    
    // Validar monto
    if (!domiciliationData.amount || parseFloat(domiciliationData.amount) <= 0) {
      Alert.alert('Error', 'Por favor ingresa un monto válido mayor a 0');
      return;
    }
    
    const amount = parseFloat(domiciliationData.amount);
    if (amount < 100) {
      Alert.alert('Error', 'El monto mínimo para domiciliación es $100 pesos.');
      return;
    }
    
    if (amount > 5000) {
      Alert.alert('Error', 'El monto máximo para domiciliación es $5,000 pesos.');
      return;
    }
    
    // Validar frecuencia
    if (!domiciliationData.periodicity) {
      Alert.alert('Error', 'Por favor selecciona una frecuencia');
      return;
    }
    
    // Validar fecha de inicio
    if (!domiciliationData.startDate) {
      Alert.alert('Error', 'Por favor ingresa una fecha de inicio');
      return;
    }
    
    // Validar formato de fecha DD/MM/YYYY
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!dateRegex.test(domiciliationData.startDate)) {
      Alert.alert('Error', 'La fecha debe tener el formato DD/MM/AAAA');
      return;
    }
    
    try {
      // Convertir fecha DD/MM/YYYY a formato del backend
      const parseStartDate = (dateStr: string): Date | null => {
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      };
      
      const startDateObj = parseStartDate(domiciliationData.startDate);
      if (!startDateObj || isNaN(startDateObj.getTime())) {
        Alert.alert('Error', 'Fecha de inicio inválida');
        return;
      }
      
      // Formatear fecha para el backend (YYYY-MM-DD)
      const formattedStartDate = startDateObj.toISOString().split('T')[0];
      
      await updateDomiciliationSchedule(
        selectedDomiciliation.id, 
        amount,
        domiciliationData.periodicity,
        formattedStartDate
      );
      setShowEditScheduleModal(false);
      setShowDomiciliationManagementModal(false);
      setSelectedDomiciliation(null);
      Alert.alert('Domiciliación actualizada', 'La domiciliación ha sido actualizada exitosamente.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al actualizar la domiciliación');
    }
  };

  const loadRates = useCallback(async () => {
    try {
      setIsLoadingRates(true);
      setRatesError(null);
      const response = await InvestmentRatesService.getRates();
      if (response.success && response.data && Array.isArray(response.data)) {
        const nextRates: Partial<InvestmentRates> = {};
        response.data.forEach(rate => {
          if (rate.type === 'pro' || rate.type === 'normal') {
            nextRates[rate.type] = rate.interestRate;
          }
        });
        
        // Solo establecer las tasas si tenemos ambas (pro y normal)
        if (nextRates.pro !== undefined && nextRates.normal !== undefined) {
          setRates({ pro: nextRates.pro, normal: nextRates.normal });
        } else {
          const missing = [];
          if (nextRates.pro === undefined) missing.push('pro');
          if (nextRates.normal === undefined) missing.push('normal');
          throw new Error(`No se encontraron tasas para: ${missing.join(', ')}`);
        }
      } else {
        throw new Error(response.error || 'No se pudieron cargar las tasas de inversión');
      }
    } catch (error) {
      console.error('❌ Error loading investment rates:', error);
      setRatesError(error instanceof Error ? error.message : 'Error al cargar las tasas');
      setRates(null);
    } finally {
      setIsLoadingRates(false);
    }
  }, []);

  // Cargar tasas al montar el componente
  useEffect(() => {
    loadRates();
  }, [loadRates]);

  // Recargar tasas cuando el usuario vuelve a esta pantalla
  useFocusEffect(
    useCallback(() => {
      loadRates();
    }, [loadRates])
  );

  const calculateFinalAmount = (amount: number, term: number, interestRate: number) => {
    // El valor viene como porcentaje desde el backend (10.5 = 10.5%)
    // Convertimos a decimal para el cálculo (10.5% -> 0.105)
    const decimalRate = interestRate / 100;
    const monthlyRate = decimalRate / 12;
    const finalAmount = amount * Math.pow(1 + monthlyRate, term);
    return finalAmount;
  };
  const formatRateLabel = (value: number) => {
    // El valor viene como porcentaje desde el backend (10.5 = 10.5%)
    // Solo formateamos con 2 decimales
    return `${value.toFixed(2)}%`;
  };

  const activeInvestAmount = parseFloat(investData.amount) || 0;
  const activeInvestTerm = parseInt(investData.term) || 0;
  const activeInvestRate = rates ? (investType === 'pro' ? rates.pro : rates.normal) : 0;
  const projectedFinalAmount =
    activeInvestAmount > 0 && activeInvestTerm > 0 && rates
      ? calculateFinalAmount(activeInvestAmount, activeInvestTerm, activeInvestRate)
      : 0;
  const projectedProfit = projectedFinalAmount - activeInvestAmount;
  const getStatusDisplay = (status: Investment['status']) => {
    switch (status) {
      case 'active':
        return { label: 'Activa', color: '#3dbac6', backgroundColor: '#e0f7f9' };
      case 'matured':
        return { label: 'Vencida', color: '#4CAF50', backgroundColor: '#e6f4ea' };
      case 'cancelled':
        return { label: 'Cancelada', color: '#F44336', backgroundColor: '#fdecea' };
      default:
        return { label: 'Activa', color: '#3dbac6', backgroundColor: '#e0f7f9' };
    }
  };

  const getInvestmentTitle = (investment: Investment) => {
    if (investment.isDomiciliation) {
      return 'Domiciliación';
    }
    return investment.oldSystem ? 'Inversión' : 'Inversión PRO';
  };

  const handleInvestSubmit = async () => {
    if (investStep === 1) {
      // Validate amount and term
      if (!investData.amount || !investData.term) {
        Alert.alert('Campos requeridos', 'Por favor completa el monto y selecciona un plazo.');
        return;
      }
      
      const amount = parseFloat(investData.amount);
      if (amount < 1) {
        Alert.alert('Monto inválido', 'El monto mínimo es $1 peso.');
        return;
      }

      // Validación de límite solo para inversiones PRO
      if (investType === 'pro') {
        const totalProInvestments = investments
          .filter(inv => !inv.oldSystem && inv.status === 'active' && !inv.isDomiciliation)
          .reduce((sum, inv) => sum + (inv.amount || 0), 0);

        const remaining = Math.round((10000 - totalProInvestments) * 100) / 100;
        if (remaining <= 0) {
          Alert.alert('Límite alcanzado', 'Ya tienes $10,000 invertidos en Inversión PRO. Usa Inversión Normal para continuar.');
          return;
        }
        if (Math.round(amount * 100) > Math.round(remaining * 100)) {
          Alert.alert('Monto excedido', `Solo puedes invertir hasta $${remaining.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} más en Inversión PRO.`);
          return;
        }
      }

      setInvestStep(2);
    } else if (investStep === 2) {
      setInvestStep(3);
    } else if (investStep === 3) {
      // Validate PIN
      if (!investData.pin || investData.pin.length !== 4) {
        Alert.alert('PIN inválido', 'Por favor ingresa un PIN de 4 dígitos.');
        return;
      }

      if (!rates) {
        Alert.alert('Error', 'No se pudieron cargar las tasas de inversión. Por favor intenta de nuevo.');
        return;
      }
      
      const amount = parseFloat(investData.amount);
      const term = parseInt(investData.term);
      const effectiveRate = investType === 'pro' ? rates.pro : rates.normal;
      const finalAmount = calculateFinalAmount(amount, term, effectiveRate);
      const profit = finalAmount - amount;

      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        // Add investment to context (llama al backend)
        await addInvestment({
          amount: amount,
          term: term,
          pin: investData.pin,
          oldSystem: investType === 'normal',
        });

        Alert.alert(
          'Inversión exitosa',
          `Tu inversión de $${amount.toLocaleString()} por ${term} meses ha sido procesada exitosamente.\n\nMonto final estimado: $${finalAmount.toLocaleString()}\nGanancia estimada: $${profit.toLocaleString()}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowInvestModal(false);
                setInvestStep(1);
                setInvestData({
                  amount: '',
                  term: '',
                  pin: ''
                });
              }
            }
          ]
        );
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Error al crear la inversión');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const formatCurrency = (value?: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value ?? 0);

  const portfolioMetrics = useMemo(() => {
    const available = availableBalance ?? 0;
    const invested = balanceBreakdown?.activeInvestmentsPrincipal ?? 0;
    
    // Calcular lo invertido específicamente en PRO (oldSystem = false)
    const proInvested = investments
      .filter(inv => !inv.oldSystem && inv.status === 'active' && !inv.isDomiciliation)
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    // Calcular lo invertido específicamente en inversiones normales (oldSystem = true)
    const normalInvested = investments
      .filter(inv => inv.oldSystem && inv.status === 'active' && !inv.isDomiciliation)
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    // Disponible para PRO = límite de $10,000 - lo invertido en PRO (mínimo 0)
    const proAvailable = Math.max(0, Math.round((10000 - proInvested) * 100) / 100);
    
    return {
      available,
      invested,
      proInvested,
      proAvailable,
      normalInvested,
    };
  }, [availableBalance, balanceBreakdown, investments]);

  const handleDomiciliationSubmit = async () => {
    if (domiciliationStep === 1) {
      // Validate amount, periodicity, startDate and term
      if (!domiciliationData.amount || !domiciliationData.periodicity || !domiciliationData.startDate || !domiciliationData.term) {
        Alert.alert('Campos requeridos', 'Por favor completa todos los campos obligatorios.');
        return;
      }
      
      const amount = parseFloat(domiciliationData.amount);
      if (amount < 1) {
        Alert.alert('Monto inválido', 'El monto mínimo es $1 peso.');
        return;
      }
      
      if (amount > 5000) {
        Alert.alert('Monto excedido', 'El monto máximo para domiciliación es $5,000 pesos.');
        return;
      }

      // Validar fecha de inicio
      const parsedStartDate = parseStartDate(domiciliationData.startDate);
      if (!parsedStartDate) {
        Alert.alert('Fecha inválida', 'Por favor ingresa una fecha válida en formato DD/MM/AAAA.');
        return;
      }

      const startDateObj = new Date(parsedStartDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startDateObj < today) {
        Alert.alert('Fecha inválida', 'La fecha de inicio no puede ser anterior a hoy.');
        return;
      }

      // Calcular día de cargo por defecto si no se especificó (usar el día de la fecha de inicio)
      if (!domiciliationData.chargeDay) {
        domiciliationData.chargeDay = startDateObj.getDate().toString();
      }

      setDomiciliationStep(2);
    } else if (domiciliationStep === 2) {
      // Validate PIN
      if (!domiciliationData.pin || domiciliationData.pin.length !== 4) {
        Alert.alert('PIN inválido', 'Por favor ingresa un PIN válido de 4 dígitos.');
        return;
      }

      try {
        // Process domiciliation - siempre es automático
        const amount = parseFloat(domiciliationData.amount);
        const periodicity = domiciliationData.periodicity;
        const chargeDay = parseInt(domiciliationData.chargeDay || '15');
        const parsedStartDate = parseStartDate(domiciliationData.startDate);
        const term = parseInt(domiciliationData.term || '12');
        
        // Add domiciliation (llama al backend)
        await addDomiciliation({
          amount: amount,
          periodicity: periodicity as 'diaria' | 'semanal' | 'quincenal' | 'mensual',
          chargeDay: chargeDay,
          startDate: parsedStartDate,
          term: term,
          pin: domiciliationData.pin,
        });

        Alert.alert('¡Domiciliación exitosa!', `Se configuró la inversión automática de $${amount.toLocaleString()} ${periodicity === 'semanal' ? 'semanal' : periodicity === 'quincenal' ? 'quincenal' : 'mensual'}.`);

        setShowDomiciliationModal(false);
        setDomiciliationStep(1);
        setDomiciliationData({ amount: '', periodicity: '', periodicityDays: '', chargeDay: '', paymentType: 'automatico', startDate: '', term: '', pin: '' });
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Error al crear la domiciliación');
      }
    }
  };

  // Mostrar estado de carga o error si las tasas no están disponibles
  if (isLoadingRates) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingTop: 100 }]}>
        <ActivityIndicator size="large" color="#3dbac6" />
        <Text style={{ marginTop: 16, color: '#666' }}>Cargando tasas de inversión...</Text>
      </View>
    );
  }

  if (ratesError || !rates) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingTop: 100, paddingHorizontal: 20 }]}>
          <Ionicons name="alert-circle" size={64} color="#ff6b6b" />
          <Text style={{ marginTop: 16, fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
            Error al cargar las tasas
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: '#666', textAlign: 'center' }}>
            {ratesError || 'No se pudieron cargar las tasas de inversión'}
          </Text>
          <TouchableOpacity
            style={[styles.investProButton, { marginTop: 24, backgroundColor: '#3dbac6' }]}
            onPress={loadRates}
          >
            <Text style={[styles.investProButtonText, { color: '#fff' }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Inversiones PRO</Text>
      <Text style={styles.description}>
        Administra tus domiciliaciones y maximiza tus ingresos
      </Text>

      <View style={styles.greenCard}>
        <Text style={styles.greenCardTitle}>¡Invierte desde 1 peso!</Text>
        <Text style={styles.greenCardText}>
         Invierte en CETES y domicilia inversiones
        </Text>
        
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Balance disponible para invertir</Text>
            <Ionicons name="wallet" size={20} color="#3dbac6" />
          </View>
          <Text style={styles.balanceAmount}>{formatCurrency(portfolioMetrics.available)}</Text>
        </View>
      </View>

              <View style={styles.proCard}>
          <View style={styles.proHeader}>
            <View style={styles.proTitleContainer}>
              <Text style={styles.proTitle}>Inversiones PRO</Text>
              <TouchableOpacity 
                style={styles.helpButton}
                onPress={() => setShowHelpModal(true)}
              >
                <Ionicons name="help-circle" size={20} color="#3dbac6" />
              </TouchableOpacity>
            </View>
            <View style={styles.cetesBubble}>
              <Text style={styles.cetesText}>CETES {formatRateLabel(rates.pro)}</Text>
            </View>
          </View>

        <View style={styles.proDetails}>
          <View style={styles.proDetailRow}>
            <Text style={styles.proDetailLabel}>Tasa anual</Text>
            <Text style={styles.proDetailValue}>{formatRateLabel(rates.pro)}</Text>
          </View>
          <View style={styles.proDetailRow}>
            <Text style={styles.proDetailLabel}>Límite total</Text>
            <Text style={styles.proDetailValue}>$10,000</Text>
          </View>
          <View style={styles.proDetailRow}>
            <Text style={styles.proDetailLabel}>Disponible</Text>
            <Text style={styles.proDetailValue}>{formatCurrency(portfolioMetrics.proAvailable)}</Text>
          </View>
          <View style={styles.proDetailRow}>
            <Text style={styles.proDetailLabel}>Invertido</Text>
            <Text style={styles.proDetailValue}>{formatCurrency(portfolioMetrics.proInvested)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.investProButton, portfolioMetrics.proAvailable <= 0 && { opacity: 0.5 }]}
          onPress={() => {
            setInvestType('pro');
            setShowInvestModal(true);
          }}
          disabled={portfolioMetrics.proAvailable <= 0}
        >
          <Ionicons name="trending-up" size={20} color="white" />
          <View style={styles.buttonTextContainer}>
            <Text style={styles.investProButtonText}>Invertir PRO</Text>
            <Text style={styles.investProSubtext}>desde $1 · hasta $10,000</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Regular Investments Card */}
      <View style={styles.regularCard}>
        <View style={styles.regularHeader}>
          <Text style={styles.regularTitle}>Inversiones</Text>
          <View style={styles.rateBubble}>
            <Text style={styles.rateText}>{formatRateLabel(rates.normal)} anual</Text>
          </View>
        </View>

        <View style={styles.regularDetails}>
          <View style={styles.regularDetailRow}>
            <Text style={styles.regularDetailLabel}>Tasa anual</Text>
            <Text style={styles.regularDetailValue}>{formatRateLabel(rates.normal)}</Text>
          </View>
          <View style={styles.regularDetailRow}>
            <Text style={styles.regularDetailLabel}>Límite</Text>
            <Text style={styles.regularDetailValue}>Sin límite</Text>
          </View>
          <View style={styles.regularDetailRow}>
            <Text style={styles.regularDetailLabel}>Disponible</Text>
            <Text style={styles.regularDetailValue}>{formatCurrency(portfolioMetrics.available)}</Text>
          </View>
          <View style={styles.regularDetailRow}>
            <Text style={styles.regularDetailLabel}>Invertido</Text>
            <Text style={styles.regularDetailValue}>{formatCurrency(portfolioMetrics.normalInvested)}</Text>
          </View>
        </View>

        <View style={styles.limitSection}>
          <Ionicons name="infinite" size={20} color="black" />
          <Text style={styles.limitText}>Sin límite de inversión</Text>
        </View>

        <TouchableOpacity
          style={styles.investButton}
          onPress={() => {
            setInvestType('normal');
            setShowInvestModal(true);
          }}
        >
          <Text style={styles.investButtonText}>Invertir Normal</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedControl}>
        <TouchableOpacity 
          style={[styles.segment, activeSegment === 'inversion' && styles.segmentActive]}
          onPress={() => setActiveSegment('inversion')}
        >
          <Ionicons name="wallet" size={18} color={activeSegment === 'inversion' ? 'white' : '#666'} />
          <Text style={[styles.segmentText, activeSegment === 'inversion' && styles.segmentTextActive]}>Inversión</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.segment, activeSegment === 'domiciliacion' && styles.segmentActive]}
          onPress={() => setActiveSegment('domiciliacion')}
        >
          <Ionicons name="trending-up" size={18} color={activeSegment === 'domiciliacion' ? 'white' : '#666'} />
          <Text style={[styles.segmentText, activeSegment === 'domiciliacion' && styles.segmentTextActive]}>Domiciliación</Text>
        </TouchableOpacity>
      </View>

      {/* Content based on active segment */}
      {activeSegment === 'inversion' && (
        <View style={styles.portfolioSection}>
          <View style={styles.portfolioHeader}>
            <Text style={styles.portfolioTitle}>Inversión</Text>
            <TouchableOpacity 
              style={styles.helpButton}
              onPress={() => setShowHelpModal(true)}
            >
              <Ionicons name="help-circle" size={24} color="#3dbac6" />
            </TouchableOpacity>
          </View>
        
        {/* Filtro de inversiones (solo si hay inversiones no-domiciliación) */}
        {investments.filter(inv => !inv.isDomiciliation).length > 0 && (
          <View style={styles.investmentFilterContainer}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                investmentFilter === 'activas' && styles.filterButtonActive
              ]}
              onPress={() => setInvestmentFilter('activas')}
            >
              <Ionicons 
                name="checkmark-circle" 
                size={16} 
                color={investmentFilter === 'activas' ? 'white' : '#666'} 
              />
              <Text style={[
                styles.filterButtonText,
                investmentFilter === 'activas' && styles.filterButtonTextActive
              ]}>
                Activas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                investmentFilter === 'vencidas' && styles.filterButtonActive
              ]}
              onPress={() => setInvestmentFilter('vencidas')}
            >
              <Ionicons 
                name="time-outline" 
                size={16} 
                color={investmentFilter === 'vencidas' ? 'white' : '#666'} 
              />
              <Text style={[
                styles.filterButtonText,
                investmentFilter === 'vencidas' && styles.filterButtonTextActive
              ]}>
                Vencidas
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {investments.filter(inv => {
          // Filtrar domiciliaciones
          if (inv.isDomiciliation) return false;
          
          // Aplicar filtro de estado
          if (investmentFilter === 'activas') {
            return inv.status === 'active';
          } else if (investmentFilter === 'vencidas') {
            return inv.status === 'matured' || inv.status === 'cancelled';
          }
          return true;
        }).length > 0 ? (
          <View style={styles.investmentsList}>
            {investments.filter(inv => {
              // Filtrar domiciliaciones
              if (inv.isDomiciliation) return false;
              
              // Aplicar filtro de estado
              if (investmentFilter === 'activas') {
                return inv.status === 'active';
              } else if (investmentFilter === 'vencidas') {
                return inv.status === 'matured' || inv.status === 'cancelled';
              }
              return true;
            }).map((investment, index) => (
              <View key={investment.id || index} style={styles.investmentItem}>
                <View style={styles.investmentItemHeader}>
                  <View style={styles.investmentItemLeft}>
                    <Ionicons 
                      name="trending-up" 
                      size={24} 
                      color={investment.oldSystem ? '#2E8B57' : '#3dbac6'} 
                    />
                    <View style={styles.investmentItemInfo}>
                      <Text style={styles.investmentItemName}>
                        {getInvestmentTitle(investment)}
                      </Text>
                      <Text style={styles.investmentItemDate}>
                        Creada: {new Date(investment.createdAt).toLocaleDateString('es-MX')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.investmentItemAmount}>${investment.amount?.toLocaleString()}</Text>
                </View>
                <View style={styles.investmentItemDetails}>
                  <View style={styles.investmentDetailItem}>
                    <Text style={styles.investmentDetailLabel}>Plazo:</Text>
                    <Text style={styles.investmentDetailValue}>{investment.term} meses</Text>
                  </View>
                  <View style={styles.investmentDetailItem}>
                    <Text style={styles.investmentDetailLabel}>Vencimiento:</Text>
                    <Text style={styles.investmentDetailValue}>
                      {investment.maturityDate
                        ? new Date(investment.maturityDate).toLocaleDateString('es-MX')
                        : 'Por definir'}
                    </Text>
                  </View>
                  <View style={styles.investmentDetailItem}>
                    <Text style={styles.investmentDetailLabel}>Tasa anual:</Text>
                    <Text style={styles.investmentDetailValue}>
                      {investment.interestRate
                        ? `${investment.interestRate.toFixed(2)}%`
                        : '—'}
                    </Text>
                  </View>
                  <View style={styles.investmentDetailItem}>
                    <Text style={styles.investmentDetailLabel}>Monto final estimado:</Text>
                    <Text style={styles.investmentDetailValue}>
                      ${calculateFinalAmount(
                        investment.amount,
                        investment.term,
                        investment.interestRate ?? (rates?.normal ?? 0),
                      ).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.investmentDetailItem}>
                    <Text style={styles.investmentDetailLabel}>Estado:</Text>
                    {(() => {
                      const statusDisplay = getStatusDisplay(investment.status);
                      return (
                        <View style={[styles.statusBadge, { backgroundColor: statusDisplay.backgroundColor }]}>
                          <Text style={[styles.statusBadgeText, { color: statusDisplay.color }]}>
                            {statusDisplay.label}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : investments.filter(inv => !inv.isDomiciliation).length === 0 ? (
          <View style={styles.portfolioCard}>
            <Ionicons name="trending-up" size={48} color="#3dbac6" />
            <Text style={styles.portfolioCardTitle}>Aún no tienes inversiones</Text>
            <Text style={styles.portfolioCardDescription}>
              Comienza con una inversión a plazo fijo personalizada y asegura un rendimiento anual sobre tu capital.
            </Text>
            
            <TouchableOpacity
              style={styles.investProButton}
              onPress={() => {
                setInvestType('pro');
                setShowInvestModal(true);
              }}
            >
              <Ionicons name="trending-up" size={20} color="white" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.investProButtonText}>Inversión PRO</Text>
                <Text style={styles.investProSubtext}>desde $1</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyFilterState}>
            <Ionicons name="search-outline" size={48} color="#ccc" />
            <Text style={styles.emptyFilterText}>
              No hay inversiones {investmentFilter === 'activas' ? 'activas' : 'vencidas'}
            </Text>
            <Text style={styles.emptyFilterSubtext}>
              {investmentFilter === 'activas' 
                ? 'Tus inversiones vencidas aparecerán cuando cambies el filtro'
                : 'Cambia el filtro para ver tus inversiones activas'}
            </Text>
          </View>
        )}
        </View>
      )}

      {/* Domiciliación Section */}
      {activeSegment === 'domiciliacion' && (
        <View style={styles.portfolioSection}>
          <View style={styles.portfolioHeader}>
            <Text style={styles.portfolioTitle}>Domiciliación</Text>
            <TouchableOpacity 
              style={styles.helpButton}
              onPress={() => setShowHelpModal(true)}
            >
              <Ionicons name="help-circle" size={24} color="#3dbac6" />
            </TouchableOpacity>
          </View>
          
          {/* Add Domiciliation Button */}
          <TouchableOpacity 
            style={styles.addDomiciliationButton}
            onPress={() => setShowDomiciliationModal(true)}
          >
            <Ionicons name="add-circle" size={20} color="white" />
            <Text style={styles.addDomiciliationButtonText}>Nueva Domiciliación</Text>
          </TouchableOpacity>
          
          {investments.filter(inv => inv.isDomiciliation).length > 0 ? (
            <View style={styles.investmentsList}>
              {investments.filter(inv => inv.isDomiciliation).map((investment, index) => (
                <View key={investment.id || index} style={styles.investmentItem}>
                  <View style={styles.investmentItemHeader}>
                    <View style={styles.investmentItemLeft}>
                      <Ionicons name="trending-up" size={24} color="#ff6b35" />
                      <View style={styles.investmentItemInfo}>
                        <Text style={styles.investmentItemName}>Domiciliación</Text>
                        
                      </View>
                    </View>
                    <Text style={styles.investmentItemAmount}>${investment.amount?.toLocaleString()}</Text>
                  </View>
                  <View style={styles.investmentItemDetails}>
                    <View style={styles.investmentDetailItem}>
                      <Text style={styles.investmentDetailLabel}>Periodicidad:</Text>
                      <Text style={styles.investmentDetailValue}>
                        {investment.periodicity === 'semanal' ? 'Semanal' : 
                         investment.periodicity === 'quincenal' ? 'Quincenal' : 'Mensual'}
                      </Text>
                    </View>
                    <View style={styles.investmentDetailItem}>
                      <Text style={styles.investmentDetailLabel}>Vencimiento:</Text>
                      <Text style={styles.investmentDetailValue}>
                        {investment.maturityDate
                          ? new Date(investment.maturityDate).toLocaleDateString('es-MX')
                          : 'Por definir'}
                      </Text>
                    </View>
                    <View style={styles.investmentDetailItem}>
                      <Text style={styles.investmentDetailLabel}>Tasa anual:</Text>
                      <Text style={styles.investmentDetailValue}>
                        {investment.interestRate ? `${investment.interestRate.toFixed(2)}%` : '—'}
                      </Text>
                    </View>
                    <View style={styles.investmentDetailItem}>
                      <Text style={styles.investmentDetailLabel}>Monto final estimado:</Text>
                      <Text style={styles.investmentDetailValue}>
                        ${calculateFinalAmount(
                          investment.amount,
                          investment.term,
                          investment.interestRate ?? (rates?.normal ?? 0),
                        ).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.investmentDetailItem}>
                      <Text style={styles.investmentDetailLabel}>Estado:</Text>
                      {(() => {
                        const statusDisplay = getStatusDisplay(investment.status);
                        return (
                          <View style={[styles.statusBadge, { backgroundColor: statusDisplay.backgroundColor }]}>
                            <Text style={[styles.statusBadgeText, { color: statusDisplay.color }]}>
                              {statusDisplay.label}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    {investment.nextChargeDate && (
                      <View style={styles.investmentDetailItem}>
                        <Text style={styles.investmentDetailLabel}>Próximo cargo:</Text>
                        <Text style={styles.investmentDetailValue}>
                          {new Date(investment.nextChargeDate).toLocaleDateString('es-MX')}
                        </Text>
                      </View>
                    )}
                    {investment.periodicityDays && (
                      <View style={styles.investmentDetailItem}>
                        <Text style={styles.investmentDetailLabel}>Cada:</Text>
                        <Text style={styles.investmentDetailValue}>
                          {investment.periodicityDays} días naturales
                        </Text>
                      </View>
                    )}
                    {investment.isPaused && (
                      <View style={styles.pausedBadge}>
                        <Ionicons name="pause-circle" size={16} color="#ff9800" />
                        <Text style={styles.pausedText}>Pausada</Text>
                      </View>
                    )}
                    {investment.isCancelled && (
                      <View style={styles.cancelledBadge}>
                        <Ionicons name="close-circle" size={16} color="#f44336" />
                        <Text style={styles.cancelledText}>Cancelada</Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Botones de gestión */}
                  <View style={styles.domiciliationActions}>
                    <TouchableOpacity 
                      style={styles.manageButton}
                      onPress={() => handleDomiciliationManagement(investment)}
                    >
                      <Ionicons name="settings" size={16} color="#3dbac6" />
                      <Text style={styles.manageButtonText}>Gestionar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.domiciliationCard}>
              <Ionicons name="trending-up" size={48} color="#ff6b35" />
              <Text style={styles.domiciliationCardTitle}>Inversión Automática</Text>
              <Text style={styles.domiciliationCardDescription}>
                Configura inversiones automáticas con la periodicidad que prefieras. 
                Tu dinero se invierte automáticamente sin que tengas que recordarlo.
              </Text>
              
              <TouchableOpacity 
                style={styles.domiciliationButton}
                onPress={() => setShowDomiciliationModal(true)}
              >
                <Text style={styles.domiciliationButtonText}>Configurar Domiciliación</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent={true}
        animationType="fade"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Información de Inversión</Text>
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
                  Una opción de inversión avanzada con CETES y otras herramientas que te permite obtener rendimientos mayores, hasta x% anual, con límite definido.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>Cómo usar</Text>
                <View style={styles.stepList}>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.stepText}>Ingresa a la sección Inversiones {'>'} inversiones PRO.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.stepText}>Revisa las condiciones (tasa y límites).</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.stepText}>Define el monto a invertir y confirma.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>4</Text>
                    </View>
                    <Text style={styles.stepText}>Verás tu dinero invertido y tus rendimientos acumulándose.</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.helpSection}>
                <View style={styles.limitNotice}>
                  <Ionicons name="information-circle" size={20} color="#FF9800" />
                  <Text style={styles.limitNoticeText}>
                    Únicamente puedes invertir hasta $10,000.00 pesos usando esta opción.
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Investment Modal */}
      <Modal
        visible={showInvestModal}
        transparent={true}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={() => {
          setShowInvestModal(false);
          setInvestStep(1);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {investType === 'pro' ? 'Inversión PRO' : 'Inversión Normal'} ({investStep}/3)
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowInvestModal(false);
                  setInvestStep(1);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Step 1: Amount and Term */}
              {investStep === 1 && (
                <View style={styles.investSection}>
                  <Text style={styles.investSectionTitle}>Configura tu inversión</Text>
                  
                  {/* Amount Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Monto a invertir (MXN) *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={investData.amount}
                      onChangeText={(value) => handleInputChange('amount', value)}
                      placeholder="Ej: 1000"
                      keyboardType="numeric"
                    />
                    <Text style={styles.inputHelper}>
                      {investType === 'pro'
                        ? `Disponible para invertir en PRO: $${portfolioMetrics.proAvailable.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : 'Mínimo: $1 · Sin límite máximo'}
                    </Text>
                  </View>

                  {/* Term Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Plazo de inversión *</Text>
                    <View style={styles.termContainer}>
                      {[1, 3, 6, 12].map((term) => (
                        <TouchableOpacity
                          key={term}
                          style={[
                            styles.termButton,
                            investData.term === term.toString() && styles.termButtonSelected
                          ]}
                          onPress={() => handleInputChange('term', term.toString())}
                        >
                          <Text style={[
                            styles.termButtonText,
                            investData.term === term.toString() && styles.termButtonTextSelected
                          ]}>
                            {term} meses
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Continue Button */}
                  <TouchableOpacity
                    style={[styles.submitButton, styles.fullWidthButton]}
                    onPress={handleInvestSubmit}
                  >
                    <Text style={styles.submitButtonText}>Continuar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 2: Summary with Chart */}
              {investStep === 2 && (
                <View style={styles.investSection}>
                  <Text style={styles.investSectionTitle}>Resumen de tu inversión</Text>
                  
                  {/* Investment Summary */}
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Detalles de la inversión</Text>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Monto inicial:</Text>
                      <Text style={styles.summaryValue}>${parseFloat(investData.amount).toLocaleString()}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Plazo:</Text>
                      <Text style={styles.summaryValue}>{investData.term} meses</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Vencimiento:</Text>
                      <Text style={styles.summaryValue}>
                        {new Date(Date.now() + (parseInt(investData.term) * 30 * 24 * 60 * 60 * 1000)).toLocaleDateString('es-MX')}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Tasa anual:</Text>
                      <Text style={styles.summaryValue}>{formatRateLabel(investType === 'pro' ? rates.pro : rates.normal)}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Monto final estimado:</Text>
                      <Text style={[styles.summaryValue, styles.finalAmount]}>
                        ${projectedFinalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Ganancia estimada:</Text>
                      <Text style={[styles.summaryValue, styles.profitAmount]}>
                        +${projectedProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>

                  {/* Simple Chart Visualization */}
                  <View style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>Proyección de crecimiento</Text>
                    <View style={styles.chart}>
                      <View style={styles.chartBar}>
                        <View style={styles.chartBarFill} />
                        <Text style={styles.chartBarLabel}>Inicial</Text>
                        <Text style={styles.chartBarValue}>${parseFloat(investData.amount).toLocaleString()}</Text>
                      </View>
                      <View style={styles.chartBar}>
                        <View style={[styles.chartBarFill, styles.chartBarFillFinal]} />
                        <Text style={styles.chartBarLabel}>Final</Text>
                        <Text style={styles.chartBarValue}>${projectedFinalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Navigation Buttons */}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => setInvestStep(1)}
                    >
                      <Text style={styles.backButtonText}>Regresar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.submitButtonRow}
                      onPress={handleInvestSubmit}
                    >
                      <Text style={styles.submitButtonText}>Continuar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Step 3: PIN Confirmation */}
              {investStep === 3 && (
                <View style={styles.investSection}>
                  <Text style={styles.investSectionTitle}>Confirmar inversión</Text>
                  
                  {/* Final Summary */}
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Confirmación final</Text>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Inversión:</Text>
                      <Text style={styles.summaryValue}>${parseFloat(investData.amount).toLocaleString()}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Plazo:</Text>
                      <Text style={styles.summaryValue}>{investData.term} meses</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Vencimiento:</Text>
                      <Text style={styles.summaryValue}>
                        {new Date(Date.now() + (parseInt(investData.term) * 30 * 24 * 60 * 60 * 1000)).toLocaleDateString('es-MX')}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Monto final:</Text>
                      <Text style={[styles.summaryValue, styles.finalAmount]}>
                        ${projectedFinalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>

                  {/* PIN Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Ingresa tu PIN de 4 dígitos *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={investData.pin}
                      onChangeText={(value) => handleInputChange('pin', value)}
                      placeholder="••••"
                      keyboardType="numeric"
                      secureTextEntry={true}
                      maxLength={4}
                    />
                  </View>

                  {/* Navigation Buttons */}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => setInvestStep(2)}
                    >
                      <Text style={styles.backButtonText}>Regresar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.submitButtonRow, isSubmitting && { opacity: 0.6 }]}
                      onPress={handleInvestSubmit}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.submitButtonText}>{isSubmitting ? 'Procesando...' : 'Confirmar'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Bottom Spacing */}
              <View style={styles.bottomSpacing} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Domiciliation Modal */}
      <Modal
        visible={showDomiciliationModal}
        transparent={true}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={() => {
          setShowDomiciliationModal(false);
          setDomiciliationStep(1);
          setDomiciliationData({ amount: '', periodicity: '', periodicityDays: '', chargeDay: '', paymentType: 'automatico', startDate: '', term: '', pin: '' });
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Domiciliación ({domiciliationStep}/2)
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowDomiciliationModal(false);
                  setDomiciliationStep(1);
                  setDomiciliationData({ amount: '', periodicity: '', periodicityDays: '', chargeDay: '', paymentType: 'automatico', startDate: '', term: '', pin: '' });
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalBody} 
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => {
                // Cerrar dropdown cuando se hace scroll
                if (frequencyDropdownVisible) {
                  setFrequencyDropdownVisible(false);
                }
              }}
            >
              {/* Step 1: Amount and Periodicity */}
              {domiciliationStep === 1 && (
                <View style={styles.domiciliationSection}>
                  <Text style={styles.domiciliationSectionTitle}>Configurar inversión automática</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Monto de inversión *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={domiciliationData.amount}
                      onChangeText={(value) => handleDomiciliationInputChange('amount', value)}
                      placeholder="$0.00"
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Frecuencia de inversión *</Text>
                    <View style={styles.dropdownContainer}>
                      <TouchableOpacity 
                        style={styles.dropdownInput}
                        onPress={() => {
                          setFrequencyDropdownVisible(!frequencyDropdownVisible);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={domiciliationData.periodicity ? styles.dropdownInputText : styles.dropdownInputPlaceholder}>
                          {domiciliationData.periodicity ? frequencies.find(freq => freq.value === domiciliationData.periodicity)?.label : 'Seleccionar frecuencia'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                      </TouchableOpacity>
                      
                      {frequencyDropdownVisible && (
                        <View style={styles.dropdownListAbsolute}>
                          {frequencies.map((frequency) => (
                            <TouchableOpacity
                              key={frequency.value}
                              style={[
                                styles.dropdownItem,
                                domiciliationData.periodicity === frequency.value && styles.dropdownItemSelected
                              ]}
                              onPress={() => {
                                handleDomiciliationInputChange('periodicity', frequency.value);
                                setFrequencyDropdownVisible(false);
                              }}
                            >
                              <Text style={[
                                styles.dropdownItemText,
                                domiciliationData.periodicity === frequency.value && styles.dropdownItemTextSelected
                              ]}>
                                {frequency.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fecha de inicio *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={domiciliationData.startDate}
                      onChangeText={handleStartDateChange}
                      placeholder="DD/MM/AAAA"
                      keyboardType="numeric"
                      maxLength={10}
                    />
                    <Text style={styles.inputHelper}>Fecha en que comenzará la domiciliación</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Plazo de inversión *</Text>
                    <View style={styles.termContainer} pointerEvents="box-none">
                      {[1, 3, 6, 12].map((term) => (
                        <TouchableOpacity
                          key={term}
                          style={[
                            styles.termButton,
                            domiciliationData.term === term.toString() && styles.termButtonSelected
                          ]}
                          onPress={() => handleDomiciliationInputChange('term', term.toString())}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.termButtonText,
                            domiciliationData.term === term.toString() && styles.termButtonTextSelected
                          ]}>
                            {term} meses
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.submitButton} 
                    onPress={handleDomiciliationSubmit}
                  >
                    <Text style={styles.submitButtonText}>Continuar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 2: PIN Confirmation */}
              {domiciliationStep === 2 && (
                <View style={styles.domiciliationSection}>
                  <Text style={styles.domiciliationSectionTitle}>Confirmar domiciliación</Text>
                  
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Resumen de domiciliación</Text>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Monto:</Text>
                      <Text style={styles.summaryValue}>${parseFloat(domiciliationData.amount).toLocaleString()}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Frecuencia:</Text>
                      <Text style={styles.summaryValue}>
                        {domiciliationData.periodicity ? frequencies.find(freq => freq.value === domiciliationData.periodicity)?.label : 'No seleccionada'}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Fecha de inicio:</Text>
                      <Text style={styles.summaryValue}>
                        {domiciliationData.startDate || 'No seleccionada'}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Plazo:</Text>
                      <Text style={styles.summaryValue}>
                        {domiciliationData.term ? `${domiciliationData.term} meses` : 'No seleccionado'}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Tasa anual:</Text>
                      <Text style={styles.summaryValue}>{formatRateLabel(rates.pro)}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Ingresa tu PIN de 4 dígitos *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={domiciliationData.pin}
                      onChangeText={(value) => handleDomiciliationInputChange('pin', value)}
                      placeholder="••••"
                      keyboardType="numeric"
                      secureTextEntry={true}
                      maxLength={4}
                    />
                  </View>
                  
                  <View style={styles.domiciliationModalButtonRow}>
                    <TouchableOpacity 
                      style={styles.domiciliationModalBackButton} 
                      onPress={() => setDomiciliationStep(1)}
                    >
                      <Text style={styles.domiciliationModalBackButtonText}>Atrás</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.domiciliationModalSubmitButton} 
                      onPress={handleDomiciliationSubmit}
                    >
                      <Text style={styles.domiciliationModalSubmitButtonText}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Bottom Spacing */}
              <View style={styles.bottomSpacing} />
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* Modal de Gestión de Domiciliación */}
      <Modal
        visible={showDomiciliationManagementModal}
        transparent={true}
        animationType="fade"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={() => setShowDomiciliationManagementModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestionar Domiciliación</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowDomiciliationManagementModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {selectedDomiciliation && (
                <View style={styles.domiciliationManagementContent}>
                  <View style={styles.domiciliationInfo}>
                    <Text style={styles.domiciliationInfoTitle}>Domiciliación</Text>
                    <Text style={styles.domiciliationInfoAmount}>
                      ${selectedDomiciliation.amount?.toLocaleString()}
                    </Text>
                    <Text style={styles.domiciliationInfoPeriodicity}>
                      {selectedDomiciliation.periodicity === 'semanal' ? 'Semanal' : 
                       selectedDomiciliation.periodicity === 'quincenal' ? 'Quincenal' : 'Mensual'}
                    </Text>
                    {selectedDomiciliation.nextChargeDate && (
                      <Text style={styles.domiciliationInfoNextCharge}>
                        Próximo cargo: {new Date(selectedDomiciliation.nextChargeDate).toLocaleDateString('es-MX')}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.domiciliationActions}>
                    {!selectedDomiciliation.isPaused && !selectedDomiciliation.isCancelled && (
                      <TouchableOpacity 
                        style={styles.pauseButton}
                        onPress={handlePauseDomiciliation}
                      >
                        <Ionicons name="pause-circle" size={20} color="#ff9800" />
                        <Text style={styles.pauseButtonText}>Pausar</Text>
                      </TouchableOpacity>
                    )}
                    
                    {selectedDomiciliation.isPaused && (
                      <TouchableOpacity 
                        style={styles.resumeButton}
                        onPress={handleResumeDomiciliation}
                      >
                        <Ionicons name="play-circle" size={20} color="#4CAF50" />
                        <Text style={styles.resumeButtonText}>Reanudar</Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity 
                      style={styles.editScheduleButton}
                      onPress={handleEditSchedule}
                    >
                      <Ionicons name="create-outline" size={20} color="#3dbac6" />
                      <Text style={styles.editScheduleButtonText}>Editar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.cancelButton}
                      onPress={handleCancelDomiciliation}
                    >
                      <Ionicons name="trash" size={20} color="#f44336" />
                      <Text style={styles.cancelButtonText}>Cancelar Domiciliación</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Editar Programación */}
      <Modal
        visible={showEditScheduleModal}
        transparent={true}
        animationType="fade"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={() => setShowEditScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Domiciliación</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowEditScheduleModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Monto a invertir (MXN) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={domiciliationData.amount}
                  onChangeText={(value) => handleDomiciliationInputChange('amount', value)}
                  placeholder="$0.00"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Frecuencia de inversión *</Text>
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity 
                    style={styles.dropdownInput}
                    onPress={() => {
                      setFrequencyDropdownVisible(!frequencyDropdownVisible);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={domiciliationData.periodicity ? styles.dropdownInputText : styles.dropdownInputPlaceholder}>
                      {domiciliationData.periodicity ? frequencies.find(freq => freq.value === domiciliationData.periodicity)?.label : 'Seleccionar frecuencia'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                  
                  {frequencyDropdownVisible && (
                    <View style={styles.dropdownListAbsolute}>
                      {frequencies.map((frequency) => (
                        <TouchableOpacity
                          key={frequency.value}
                          style={[
                            styles.dropdownItem,
                            domiciliationData.periodicity === frequency.value && styles.dropdownItemSelected
                          ]}
                          onPress={() => {
                            handleDomiciliationInputChange('periodicity', frequency.value);
                            setFrequencyDropdownVisible(false);
                          }}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            domiciliationData.periodicity === frequency.value && styles.dropdownItemTextSelected
                          ]}>
                            {frequency.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fecha de inicio *</Text>
                <TextInput
                  style={styles.textInput}
                  value={domiciliationData.startDate}
                  onChangeText={handleStartDateChange}
                  placeholder="DD/MM/AAAA"
                  keyboardType="numeric"
                  maxLength={10}
                />
                <Text style={styles.inputHelper}>Fecha en que comenzará la domiciliación</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.updateScheduleButton}
                onPress={handleUpdateSchedule}
              >
                <Text style={styles.updateScheduleButtonText}>Actualizar Domiciliación</Text>
              </TouchableOpacity>
            </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 24,
  },
  greenCard: {
    backgroundColor: '#528FAA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
    shadowColor: '#34C759',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
  },
  greenCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  greenCardText: {
    fontSize: 16,
    color: 'white',
    lineHeight: 22,
    opacity: 0.8,
    marginBottom: 16,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    width: '100%',
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  proCard: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.4)',
    shadowColor: '#2ecc71',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  proHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  proTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  cetesBubble: {
    backgroundColor: '#3dbac6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cetesText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  proDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  proDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  proDetailLabel: {
    fontSize: 16,
    color: '#666',
  },
  proDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  regularCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  regularHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  regularTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },
  rateBubble: {
    backgroundColor: '#3dbac6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  rateText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  regularDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  regularDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  regularDetailLabel: {
    fontSize: 16,
    color: '#666',
  },
  regularDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  limitSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  limitText: {
    fontSize: 14,
    color: 'black',
    marginLeft: 8,
    fontWeight: '500',
  },
  investButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  investButtonText: {
    color: '#3dbac6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F7',
    borderRadius: 12,
    padding: 4,
    marginTop: 16,
    marginBottom: 24,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  segmentActive: {
    backgroundColor: '#3dbac6',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  segmentTextActive: {
    color: 'white',
  },
  portfolioSection: {
    marginBottom: 24,
  },
  portfolioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  portfolioTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  helpButton: {
    padding: 4,
  },
  portfolioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  portfolioCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  portfolioCardDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  investProButton: {
    backgroundColor: '#2E8B57',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonTextContainer: {
    marginLeft: 12,
    alignItems: 'center',
    flex: 1,
  },
  investProButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  investProSubtext: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  investmentFilterContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F7',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#3dbac6',
    shadowColor: '#3dbac6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  emptyFilterState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  emptyFilterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyFilterSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
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
  limitNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  limitNoticeText: {
    fontSize: 14,
    color: '#E65100',
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  // Investment Modal Styles
  investSection: {
    marginBottom: 16,
  },
  investSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
    overflow: 'visible',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  inputHelper: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  termContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  termButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  termButtonSelected: {
    backgroundColor: '#3dbac6',
    borderColor: '#3dbac6',
  },
  termButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  termButtonTextSelected: {
    color: 'white',
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
  fullWidthButton: {
    width: '100%',
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
  summaryCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  finalAmount: {
    color: '#3dbac6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profitAmount: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chartContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarFill: {
    width: 40,
    height: 60,
    backgroundColor: '#3dbac6',
    borderRadius: 4,
    marginBottom: 8,
  },
  chartBarFillFinal: {
    height: 80,
    backgroundColor: '#4CAF50',
  },
  chartBarLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  chartBarValue: {
    fontSize: 10,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 20,
  },
  // New styles for investments list
  investmentsList: {
    gap: 16,
  },
  investmentItem: {
    backgroundColor: 'white',
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
  investmentItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  investmentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  investmentItemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  investmentItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  investmentItemDate: {
    fontSize: 14,
    color: '#666',
  },
  investmentItemAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  investmentItemDetails: {
    gap: 8,
  },
  investmentDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  investmentDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  investmentDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Domiciliation Styles
  domiciliationButton: {
    backgroundColor: '#3dbac6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  domiciliationSection: {
    padding: 20,
  },
  domiciliationSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'left',
  },
  periodicityOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  periodicityOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'white',
    marginHorizontal: 4,
    alignItems: 'center',
  },
  periodicityOptionSelected: {
    backgroundColor: '#3dbac6',
    borderColor: '#3dbac6',
  },
  periodicityOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  periodicityOptionTextSelected: {
    color: 'white',
  },
  // Domiciliación Section Styles
  domiciliationCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  domiciliationCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  domiciliationCardDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  domiciliationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  // Domiciliation Modal Button Styles
  domiciliationModalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  domiciliationModalBackButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 48,
  },
  domiciliationModalBackButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  domiciliationModalSubmitButton: {
    flex: 1,
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  domiciliationModalSubmitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Add Domiciliation Button Styles
  addDomiciliationButton: {
    backgroundColor: '#3dbac6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: '#3dbac6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addDomiciliationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Estilos para gestión de domiciliaciones
  domiciliationActions: {
    flexDirection: 'column',
    marginTop: 16,
    gap: 8,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  manageButtonText: {
    color: '#3dbac6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  pausedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  pausedText: {
    color: '#ff9800',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  cancelledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  cancelledText: {
    color: '#f44336',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Estilos para modal de gestión
  domiciliationManagementContent: {
    padding: 0,
  },
  domiciliationInfo: {
    marginBottom: 20,
  },
  domiciliationInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  domiciliationInfoAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 4,
  },
  domiciliationInfoPeriodicity: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  domiciliationInfoNextCharge: {
    fontSize: 14,
    color: '#999',
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  pauseButtonText: {
    color: '#ff9800',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  resumeButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  editScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  editScheduleButtonText: {
    color: '#3dbac6',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  cancelButtonText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Estilos para modal de editar programación
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  updateScheduleButton: {
    backgroundColor: '#3dbac6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  updateScheduleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos para dropdown y payment type (igual que en goals)
  dropdownContainer: {
  },
  dropdownInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  dropdownInputText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownInputPlaceholder: {
    fontSize: 16,
    color: '#999',
    flex: 1,
  },
  dropdownList: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    marginHorizontal: 20,
    maxHeight: 300,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  dropdownListAbsolute: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 0,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  dropdownItemSelected: {
    backgroundColor: '#EFF3FE',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownItemTextSelected: {
    color: '#3dbac6',
    fontWeight: '600',
  },
  paymentTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentTypeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTypeButtonSelected: {
    borderColor: '#3dbac6',
    backgroundColor: '#EFF3FE',
  },
  paymentTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 8,
  },
  paymentTypeTextSelected: {
    color: '#3dbac6',
  },
}); 