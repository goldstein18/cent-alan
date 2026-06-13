import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AccountStatement from '../components/AccountStatement';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { MtCenterService, ServiceBill, ServiceProvider } from '../services/mtCenterService';
import { SplitRequestsService, SplitRequestReceived, SplitRequestSent } from '../services/splitRequestsService';
import { getStreak, updateStreak } from '../services/streakService';
import { TransactionsService } from '../services/transactionsService';
import { UsersService } from '../services/usersService';

export default function Index() {
  const router = useRouter();
  const { user } = useAuth();
  const { investments, goals, accountStatements, availableBalance, totalBalance, balanceBreakdown, reloadData } = useData();
  useFocusEffect(
    useCallback(() => {
      reloadData();
      // Actualizar racha cuando se abre la app
      updateStreak().then(({ days, weeks }) => {
        setStreakDays(days);
        setStreakWeeks(weeks);
      });
    }, [reloadData])
  );
  
  // Cargar racha inicial
  useEffect(() => {
    getStreak().then(({ days, weeks }) => {
      setStreakDays(days);
      setStreakWeeks(weeks);
    });
  }, []);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [showCodigoModal, setShowCodigoModal] = useState(false);
  const [showTransferirModal, setShowTransferirModal] = useState(false);
  const [showClabeModal, setShowClabeModal] = useState(false);
  const [userClabe, setUserClabe] = useState<string | null>(null);
  const [showPagarModal, setShowPagarModal] = useState(false);
  const [cantidad, setCantidad] = useState('');
  const [codigo, setCodigo] = useState('');
  const [showTelefonoModal, setShowTelefonoModal] = useState(false);
  const [telefonoModalType, setTelefonoModalType] = useState<'payment' | 'deposit'>('payment'); // 'payment' para pagos, 'deposit' para abonos
  const [paymentOtp, setPaymentOtp] = useState<string>('');
  const [showDividirModal, setShowDividirModal] = useState(false);
  const [showCodigoSeguridadModal, setShowCodigoSeguridadModal] = useState(false);
  const [showSolicitudesModal, setShowSolicitudesModal] = useState(false);
  const [dividirStep, setDividirStep] = useState(1);
  const [solicitudesTab, setSolicitudesTab] = useState('enviadas');
  const [showSolicitudDetail, setShowSolicitudDetail] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<any>(null);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [showAcceptOTP, setShowAcceptOTP] = useState(false);
  const [selectedRecibida, setSelectedRecibida] = useState<any>(null);
  const [acceptOTP, setAcceptOTP] = useState('');
  const [isCreatingSolicitud, setIsCreatingSolicitud] = useState(false);
  const [showSolicitudesSection, setShowSolicitudesSection] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showDividirHelpModal, setShowDividirHelpModal] = useState(false);
  const [showCentEdModal, setShowCentEdModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Estados para transferencias
  const [showTransferenciaInternaModal, setShowTransferenciaInternaModal] = useState(false);
  const [showTransferenciaExternaModal, setShowTransferenciaExternaModal] = useState(false);
  const [transferenciaInternaStep, setTransferenciaInternaStep] = useState(1);
  const [transferenciaExternaStep, setTransferenciaExternaStep] = useState(1);
  const [transferenciaInternaData, setTransferenciaInternaData] = useState({
    numero: '',
    numeroConfirmacion: '',
    monto: '',
    montoConfirmacion: '',
    pin: '',
    referencia: ''
  });
  const [transferenciaExternaData, setTransferenciaExternaData] = useState({
    nombre: '',
    banco: '',
    clabe: '',
    monto: '',
    pin: '',
    referencia: ''
  });
  const [isProcessingTransferenciaExterna, setIsProcessingTransferenciaExterna] = useState(false);
  
  // Estados para pago de servicios (MT Center)
  const [pagarStep, setPagarStep] = useState(1); // 1: Select provider, 2: Enter account, 3: Query bill, 4: Confirm & PIN
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [queriedBill, setQueriedBill] = useState<ServiceBill | null>(null);
  const [servicePin, setServicePin] = useState(['', '', '', '']);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [isQueryingBill, setIsQueryingBill] = useState(false);
  const [isPayingService, setIsPayingService] = useState(false);
  const [serviceError, setServiceError] = useState('');
  
  // Estados para racha
  const [streakDays, setStreakDays] = useState(0);
  const [streakWeeks, setStreakWeeks] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await reloadData();
    } finally {
      setIsRefreshing(false);
    }
  }, [reloadData]);

  // Funciones para transferencias
  const handleTransferenciaInternaInput = (field: string, value: string) => {
    setTransferenciaInternaData(prev => ({ ...prev, [field]: value }));
  };

  const handleTransferenciaExternaInput = (field: string, value: string) => {
    setTransferenciaExternaData(prev => ({ ...prev, [field]: value }));
  };

  // Funciones para pago de servicios (MT Center)
  const loadServiceProviders = useCallback(async () => {
    setIsLoadingProviders(true);
    setServiceError('');
    const result = await MtCenterService.getProviders();
    if (result.success && result.data) {
      setServiceProviders(result.data);
    } else {
      setServiceError(result.error || 'No fue posible cargar los proveedores');
    }
    setIsLoadingProviders(false);
  }, []);

  const handleServicePinChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 1);
    const newPin = [...servicePin];
    newPin[index] = cleanValue;
    setServicePin(newPin);
    setServiceError('');
  };

  const handleQueryBill = async () => {
    if (!selectedProvider || !accountNumber.trim()) {
      setServiceError('Por favor, selecciona un proveedor e ingresa el número de cuenta');
      return;
    }

    setIsQueryingBill(true);
    setServiceError('');
    const result = await MtCenterService.queryBill({
      providerId: selectedProvider.id,
      accountNumber: accountNumber.trim(),
    });

    if (result.success && result.data) {
      setQueriedBill(result.data);
      setPagarStep(4); // Move to confirmation step
    } else {
      setServiceError(result.error || 'No se pudo consultar el recibo');
    }
    setIsQueryingBill(false);
  };

  const handlePayService = async () => {
    if (!selectedProvider || !accountNumber.trim() || !queriedBill) {
      setServiceError('Información incompleta');
      return;
    }

    const pin = servicePin.join('');
    if (pin.length !== 4) {
      setServiceError('El PIN debe tener 4 dígitos');
      return;
    }

    setIsPayingService(true);
    setServiceError('');
    const result = await MtCenterService.payService({
      providerId: selectedProvider.id,
      accountNumber: accountNumber.trim(),
      amount: queriedBill.amount,
      pin,
    });

    if (result.success && result.data) {
      Alert.alert('Éxito', 'Pago procesado correctamente', [
        {
          text: 'OK',
          onPress: () => {
            setShowPagarModal(false);
            setPagarStep(1);
            setSelectedProvider(null);
            setAccountNumber('');
            setQueriedBill(null);
            setServicePin(['', '', '', '']);
            setServiceError('');
            reloadData();
          },
        },
      ]);
    } else {
      setServiceError(result.error || 'No se pudo procesar el pago');
    }
    setIsPayingService(false);
  };

  // Load providers when modal opens
  useEffect(() => {
    if (showPagarModal && pagarStep === 1 && serviceProviders.length === 0 && !isLoadingProviders) {
      loadServiceProviders();
    }
  }, [showPagarModal, pagarStep, serviceProviders.length, isLoadingProviders, loadServiceProviders]);

  const formatCurrency = (value?: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value ?? 0);

  const balanceMetrics = useMemo(() => {
    const available = availableBalance ?? 0;
    const metas = balanceBreakdown?.goalsTotal ?? 0;
    const invested = balanceBreakdown?.activeInvestmentsPrincipal ?? 0;
    const total =
      totalBalance ??
      available +
        metas +
        invested;

    return {
      available,
      metas,
      invested,
      total,
    };
  }, [availableBalance, totalBalance, balanceBreakdown]);

  const goalMetrics = useMemo(() => {
    const activeGoals = goals.filter(goal => !goal.isCompleted).length;
    const completedGoals = goals.filter(goal => goal.isCompleted).length;
    const totalSaved = goals.reduce((sum, goal) => sum + (goal.progress ?? 0), 0);
    const totalReturns = goals
      .filter(goal => goal.hasRendimientos)
      .reduce((sum, goal) => sum + (goal.rendimientosGenerados ?? 0), 0);

    return {
      activeGoals,
      completedGoals,
      totalSaved,
      totalReturns,
    };
  }, [goals]);

  const investmentMetrics = useMemo(() => {
    const activeInvestments = investments.filter(investment => investment.status === 'active');
    const investedPrincipal = balanceBreakdown?.activeInvestmentsPrincipal ?? 0;
    const averageRate =
      activeInvestments.length > 0
        ? activeInvestments.reduce((sum, investment) => sum + (investment.interestRate ?? 0), 0) /
          activeInvestments.length
        : 0;

    return {
      activeCount: activeInvestments.length,
      investedPrincipal,
      averageRate,
    };
  }, [investments, balanceBreakdown]);

  const topGoals = useMemo(() => goals.slice(0, 2), [goals]);
  const topInvestments = useMemo(
    () => investments.filter(investment => !investment.isDomiciliation && investment.status === 'active').slice(0, 2),
    [investments],
  );

  // Navigation handlers
  const handleNavigateToInvestments = () => {
    router.push('/(tabs)/investments');
  };

  const handleNavigateToGoals = () => {
    router.push('/(tabs)/goals');
  };

  const handleNavigateToInsurance = () => {
    router.push('/(tabs)/insurance');
  };

  const handleDividirCuentas = () => {
    setFormData({ concepto: '', descripcion: '', participantes: [{ nombre: '', telefono: '', monto: '' }] });
    setDividirStep(1);
    setCodigoSeguridad('');
    setShowDividirModal(true);
  };

  const handleVerSolicitudes = () => {
    setShowSolicitudesSection(!showSolicitudesSection);
  };

  const handlePagarServiciosComingSoon = () => {
    Alert.alert('Próximamente', 'Esta funcionalidad estará disponible pronto.');
  };

  const [isProcessingTransferenciaInterna, setIsProcessingTransferenciaInterna] = useState(false);

  const handleTransferenciaInternaSubmit = async () => {
    if (transferenciaInternaStep === 1) {
      if (!transferenciaInternaData.numero || !transferenciaInternaData.monto || 
          !transferenciaInternaData.numeroConfirmacion || !transferenciaInternaData.montoConfirmacion) {
        Alert.alert('Error', 'Por favor completa todos los campos');
        return;
      }
      
      // Validar que los números de teléfono coincidan
      if (transferenciaInternaData.numero !== transferenciaInternaData.numeroConfirmacion) {
        Alert.alert('Error', 'Los números de teléfono no coinciden');
        return;
      }
      
      // Validar que los montos coincidan
      if (transferenciaInternaData.monto !== transferenciaInternaData.montoConfirmacion) {
        Alert.alert('Error', 'Los montos no coinciden');
        return;
      }
      
      setTransferenciaInternaStep(2);
    } else if (transferenciaInternaStep === 2) {
      if (!transferenciaInternaData.pin || transferenciaInternaData.pin.length !== 4) {
        Alert.alert('Error', 'Por favor ingresa un PIN válido de 4 dígitos');
        return;
      }

      if (isProcessingTransferenciaInterna) {
        return;
      }

      const amountNumber = parseCurrencyToNumber(transferenciaInternaData.monto);
      if (Number.isNaN(amountNumber) || amountNumber <= 0) {
        Alert.alert('Error', 'Ingrese un monto válido para la transferencia');
        return;
      }

      setIsProcessingTransferenciaInterna(true);
      try {
        // Limpiar número de teléfono (solo dígitos)
        const cleanPhone = transferenciaInternaData.numero.replace(/\D/g, '');

        const response = await TransactionsService.createInternalTransfer({
          recipientPhoneNumber: cleanPhone,
          amount: amountNumber,
          description: 'Transferencia interna desde la app',
          pin: transferenciaInternaData.pin,
        });

        if (!response.success || !response.data) {
          Alert.alert('Error', response.error || 'No fue posible procesar la transferencia interna');
          return;
        }

        setTransferenciaInternaData(prev => ({
          ...prev,
          referencia: response.data?.reference || 'N/A',
        }));

        await reloadData();
        setTransferenciaInternaStep(3);
      } catch (error) {
        console.error('Transferencia interna error:', error);
        Alert.alert('Error', 'Ocurrió un problema al procesar tu transferencia. Inténtalo nuevamente.');
      } finally {
        setIsProcessingTransferenciaInterna(false);
      }
    }
  };

  const parseCurrencyToNumber = (value: string) => {
    if (!value) return NaN;
    const trimmed = value.trim().replace(/\s/g, '').replace(/\$/g, '');
    const hasComma = trimmed.includes(',');
    const hasDot = trimmed.includes('.');
    let normalized = trimmed;

    if (hasComma && !hasDot) {
      normalized = normalized.replace(/\./g, '');
      normalized = normalized.replace(/,/g, '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }

    normalized = normalized.replace(/[^0-9.]/g, '');
    return Number(normalized);
  };

  const handleTransferenciaExternaSubmit = async () => {
    if (transferenciaExternaStep === 1) {
      if (!transferenciaExternaData.nombre || !transferenciaExternaData.banco || !transferenciaExternaData.monto || !transferenciaExternaData.clabe) {
        Alert.alert('Error', 'Por favor completa todos los campos');
        return;
      }
      if (transferenciaExternaData.clabe.length !== 18) {
        Alert.alert('Error', 'La CLABE debe tener 18 dígitos');
        return;
      }
      setTransferenciaExternaStep(2);
    } else if (transferenciaExternaStep === 2) {
      if (!transferenciaExternaData.pin || transferenciaExternaData.pin.length !== 4) {
        Alert.alert('Error', 'Por favor ingresa un PIN válido de 4 dígitos');
        return;
      }
      if (isProcessingTransferenciaExterna) {
        return;
      }

      const amountNumber = parseCurrencyToNumber(transferenciaExternaData.monto);
      if (Number.isNaN(amountNumber) || amountNumber <= 0) {
        Alert.alert('Error', 'Ingrese un monto válido para la transferencia');
        return;
      }

      setIsProcessingTransferenciaExterna(true);
      try {
        const response = await TransactionsService.createExternalTransfer({
          beneficiaryName: transferenciaExternaData.nombre,
          bankName: transferenciaExternaData.banco,
          clabe: transferenciaExternaData.clabe,
          amount: amountNumber,
          description: 'Transferencia externa desde la app',
          pin: transferenciaExternaData.pin,
        });

        if (!response.success || !response.data) {
          setIsProcessingTransferenciaExterna(false);
          Alert.alert('Error', response.error || 'No fue posible procesar la transferencia externa');
          return;
        }

        setTransferenciaExternaData(prev => ({
          ...prev,
          referencia: response.data?.reference ?? prev.referencia,
        }));

        await reloadData();
      setTransferenciaExternaStep(3);
      } catch (error) {
        console.error('Transferencia externa error:', error);
        Alert.alert('Error', 'Ocurrió un problema al procesar tu transferencia. Inténtalo nuevamente.');
      } finally {
        setIsProcessingTransferenciaExterna(false);
      }
    }
  };

  // WhatsApp function
  const openWhatsApp = async () => {
    const phoneNumber = '520000000000';
    const message = 'Hola, necesito ayuda con abonar a CLABE en Cent.';
    const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;

    const webWhatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    const webFallbackUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
        return;
      }
    } catch (error) {
    }

    try {
      await Linking.openURL(webWhatsappUrl);
    } catch {
      try {
        await Linking.openURL(webFallbackUrl);
      } catch {
        Alert.alert('Error', 'No se pudo abrir WhatsApp');
      }
    }
  };

  // Función para manejar el clic en "Abonar por transferencia"
  const handleAbonarPorTransferencia = async () => {
    setShowAbonoModal(false);
    
    // Intentar obtener la CLABE del usuario
    try {
      const result = await UsersService.getClabe();
      if (result.success && result.data?.clabe) {
        // Si tiene CLABE, mostrar modal con la CLABE
        setUserClabe(result.data.clabe);
        setShowClabeModal(true);
      } else {
        // Si no tiene CLABE, abrir WhatsApp como antes
        openWhatsApp();
      }
    } catch (error) {
      console.error('Error obteniendo CLABE:', error);
      // En caso de error, abrir WhatsApp
      openWhatsApp();
    }
  };
  const [formData, setFormData] = useState({
    concepto: '',
    descripcion: '',
    participantes: [] as Array<{nombre: string, telefono: string, monto: string}>
  });
  const [codigoSeguridad, setCodigoSeguridad] = useState('');
  const [telefonos, setTelefonos] = useState(['']);
  const [telefonoActual, setTelefonoActual] = useState('');

  // CENT ED Data
  const centEdCategories = [
    {
      id: 'basicas',
      title: 'FINANZAS BÁSICAS',
      subtitle: '9 Artículos - Nivel Principiante',
      icon: '📚',
      color: '#4CAF50',
      articles: [
        { title: '¿Qué son las finanzas personales y por qué importan?', url: 'https://example.com/que-son-finanzas-personales' },
        { title: 'Cómo hacer un presupuesto en 5 pasos', url: 'https://example.com/como-hacer-presupuesto' },
        { title: 'La importancia del fondo de emergencia', url: 'https://example.com/fondo-emergencia' },
        { title: 'La regla del 50/30/20 para organizar tu dinero', url: 'https://example.com/regla-50-30-20' },
        { title: '¿Qué es el gasto hormiga y cómo te come el dinero?', url: 'https://example.com/gasto-hormiga' },
        { title: 'Gastos fijos vs variables: cómo controlarlos', url: 'https://example.com/gastos-fijos-variables' },
        { title: 'Diferencia entre cuenta de débito y de crédito', url: 'https://example.com/debito-vs-credito' },
        { title: '¿Qué es el interés compuesto y por qué es tan poderoso?', url: 'https://example.com/interes-compuesto' },
        { title: '¿Qué son los CETES y por qué son tan seguros?', url: 'https://example.com/cetes-seguros' }
      ]
    },
    {
      id: 'intermedias',
      title: 'FINANZAS INTERMEDIAS',
      subtitle: '10 Artículos - Nivel Intermedio',
      icon: '📊',
      color: '#2196F3',
      articles: [
        { title: 'La inflación y cómo afecta tu bolsillo', url: 'https://example.com/inflacion-bolsillo' },
        { title: 'Estrategias para salir de deudas paso a paso', url: 'https://example.com/estrategias-deudas' },
        { title: 'Cómo evitar las deudas más comunes', url: 'https://example.com/evitar-deudas-comunes' },
        { title: 'Cómo usar tu tarjeta de crédito sin endeudarte', url: 'https://example.com/tarjeta-credito-sin-deudas' },
        { title: 'El score crediticio: qué es y cómo mejorarlo', url: 'https://example.com/score-crediticio' },
        { title: '¿Qué es un seguro y por qué lo necesitas?', url: 'https://example.com/seguros-necesarios' },
        { title: 'Cómo empezar a invertir con poco dinero', url: 'https://example.com/invertir-poco-dinero' },
        { title: 'Cómo analizar si una inversión es buena', url: 'https://example.com/analizar-inversiones' },
        { title: 'Bienes raíces como inversión', url: 'https://example.com/bienes-raices-inversion' },
        { title: 'Cómo protegerte de comisiones bancarias innecesarias', url: 'https://example.com/protegerte-comisiones' }
      ]
    },
    {
      id: 'avanzadas',
      title: 'FINANZAS AVANZADAS',
      subtitle: '15 Artículos - Nivel Avanzado',
      icon: '🚀',
      color: '#9C27B0',
      articles: [
        { title: 'Planear tu retiro desde joven', url: 'https://example.com/planear-retiro-joven' },
        { title: 'Diversificación: cómo proteger tu dinero', url: 'https://example.com/diversificacion-dinero' },
        { title: 'Estrategias para generar ingresos pasivos', url: 'https://example.com/ingresos-pasivos' },
        { title: 'El poder de reinvertir tus rendimientos', url: 'https://example.com/reinvertir-rendimientos' },
        { title: 'Inversión en bienes raíces', url: 'https://example.com/inversion-bienes-raices' },
        { title: 'Cómo negociar con bancos y financieras', url: 'https://example.com/negociar-bancos' },
        { title: 'Cómo diversificar tu portafolio de inversiones', url: 'https://example.com/diversificar-portafolio' },
        { title: 'Inversiones alternativas: arte, vino, y más', url: 'https://example.com/inversiones-alternativas' },
        { title: 'Planificación patrimonial', url: 'https://example.com/planificacion-patrimonial' },
        { title: 'Invertir en la bolsa', url: 'https://example.com/invertir-en-bolsa' },
        { title: 'Optimización fiscal para inversores', url: 'https://example.com/optimizacion-fiscal' },
        { title: 'Criptomonedas: oportunidades y riesgos', url: 'https://example.com/criptomonedas-riesgos' },
        { title: 'ETFs vs Fondos de Inversión', url: 'https://example.com/etfs-fondos-inversion' },
        { title: 'Hedging: proteger inversiones', url: 'https://example.com/hedging-proteger-inversiones' }
      ]
    },
    {
      id: 'practicas',
      title: 'FINANZAS PRÁCTICAS DEL DÍA A DÍA',
      subtitle: '8 Artículos - Día a Día',
      icon: '💡',
      color: '#FF9800',
      articles: [
        { title: 'Trucos para ahorrar en el super', url: 'https://example.com/trucos-ahorrar-super' },
        { title: 'Hábitos financieros', url: 'https://example.com/habitos-financieros' },
        { title: 'Psicología del dinero', url: 'https://example.com/psicologia-del-dinero' },
        { title: 'Finanzas para estudiantes', url: 'https://example.com/finanzas-estudiantes' },
        { title: 'Hablar de dinero con pareja o familia', url: 'https://example.com/hablar-dinero-pareja-familia' },
        { title: 'Fijar y alcanzar metas financieras', url: 'https://example.com/fijar-alcanzar-metas-financieras' },
        { title: 'Finanzas para freelancers', url: 'https://example.com/finanzas-freelancers' },
        { title: 'Apps y herramientas que ayudan a manejar tu dinero', url: 'https://example.com/apps-herramientas-dinero' }
      ]
    },
    {
      id: 'actualidad',
      title: 'FINANZAS DE LA ACTUALIDAD',
      subtitle: '7 Artículos - Disponibles Ahora',
      icon: '🌐',
      color: '#F44336',
      articles: [
        { title: 'Educación financiera en México', url: 'https://example.com/educacion-financiera-mexico' },
        { title: 'IA y dinero', url: 'https://example.com/ia-y-dinero' },
        { title: 'Noticias económicas', url: 'https://example.com/noticias-economicas-entender' },
        { title: 'Contratos', url: 'https://example.com/entender-contratos-financieros' },
        { title: 'Impuestos básicos', url: 'https://example.com/impuestos-basicos' },
        { title: 'Crisis económicas: cómo proteger tu dinero', url: 'https://example.com/crisis-economicas-proteger-dinero' }
      ]
    }
  ];

  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState<SplitRequestSent[]>([]);
  const [solicitudesRecibidas, setSolicitudesRecibidas] = useState<SplitRequestReceived[]>([]);
  const [solicitudesLoading, setSolicitudesLoading] = useState(false);
  const [cancelPin, setCancelPin] = useState('');

  const loadSolicitudes = useCallback(async () => {
    setSolicitudesLoading(true);
    try {
      const [sentResult, receivedResult] = await Promise.all([
        SplitRequestsService.getSentRequests(),
        SplitRequestsService.getReceivedRequests(),
      ]);
      if (sentResult.success && sentResult.data) setSolicitudesEnviadas(sentResult.data);
      if (receivedResult.success && receivedResult.data) setSolicitudesRecibidas(receivedResult.data);
    } catch (error) {
      console.error('Error loading solicitudes:', error);
    } finally {
      setSolicitudesLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (showSolicitudesSection) {
        loadSolicitudes();
      }
    }, [showSolicitudesSection, loadSolicitudes])
  );

  const handleCancelSolicitud = async () => {
    if (!selectedSolicitud || cancelPin.length !== 4) {
      Alert.alert('Error', 'Ingresa tu PIN de 4 dígitos para confirmar la cancelación');
      return;
    }
    const result = await SplitRequestsService.cancelSplitRequest(String(selectedSolicitud.id), cancelPin);
    setShowCancelConfirmation(false);
    setShowSolicitudDetail(false);
    setSelectedSolicitud(null);
    setCancelPin('');
    if (result.success) {
      Alert.alert('Éxito', 'La solicitud ha sido cancelada');
      loadSolicitudes();
    } else {
      Alert.alert('Error', result.error || 'No se pudo cancelar la solicitud');
    }
  };

  const handleAcceptSolicitud = async () => {
    if (!selectedRecibida || acceptOTP.length !== 4) {
      Alert.alert('Error', 'Por favor ingresa tu código de seguridad de 4 dígitos');
      return;
    }
    const partResult = await SplitRequestsService.getParticipantId(String(selectedRecibida.id));
    if (!partResult.success || !partResult.data?.participantId) {
      Alert.alert('Error', 'No se encontró la solicitud. Intenta de nuevo.');
      return;
    }
    const result = await SplitRequestsService.acceptSplitRequest(partResult.data.participantId, acceptOTP);
    setShowAcceptOTP(false);
    setSelectedRecibida(null);
    setAcceptOTP('');
    if (result.success) {
      Alert.alert('Éxito', 'La solicitud ha sido aceptada');
      loadSolicitudes();
      reloadData(); // Refresh balance after payment
    } else {
      Alert.alert('Error', result.error || 'No se pudo aceptar la solicitud');
    }
  };

  const handleRejectSolicitud = async (solicitud?: SplitRequestReceived) => {
    const target = solicitud || selectedRecibida;
    if (!target) return;
    const partResult = await SplitRequestsService.getParticipantId(String(target.id));
    if (!partResult.success || !partResult.data?.participantId) {
      Alert.alert('Error', 'No se encontró la solicitud.');
      return;
    }
    const result = await SplitRequestsService.rejectSplitRequest(partResult.data.participantId);
    setSelectedRecibida(null);
    if (result.success) {
      Alert.alert('Éxito', 'La solicitud ha sido rechazada');
      loadSolicitudes();
    } else {
      Alert.alert('Error', result.error || 'No se pudo rechazar la solicitud');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#3dbac6"
          colors={['#3dbac6']}
        />
      }
    >

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>CENT</Text>
        <View style={styles.flameContainer}>
          <Ionicons name="flame" size={24} color="#FF6B35" />
          {streakDays > 0 && (
            <Text style={styles.flameDaysText}>{streakDays}</Text>
          )}
        </View>
      </View>

      {/* Welcome Section */}
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeTitleContainer}>
          <Text style={styles.welcomeTitle}>¡Hola <Text style={styles.welcomeTitleUser}>{user?.firstName || 'Usuario'}</Text>! 👋</Text>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => setShowHelpModal(true)}
          >
            <Ionicons name="help-circle" size={24} color="#3dbac6" />
          </TouchableOpacity>
        </View>
        <Text style={styles.welcomeText}>
          Haz crecer tu dinero mientras aprendes de forma divertida
        </Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Ionicons name="wallet" size={24} color="white" style={styles.walletIcon} />
          <Text style={styles.balanceText}>Tu dinero total</Text>
        </View>
        <Text style={styles.balanceAmount}>{formatCurrency(balanceMetrics.total)}</Text>
        
        <View style={styles.balanceContainer}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Disponible</Text>
            <Text style={styles.balanceValue}>{formatCurrency(balanceMetrics.available)}</Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Metas</Text>
            <Text style={styles.balanceValue}>{formatCurrency(balanceMetrics.metas)}</Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Invertido</Text>
            <Text style={styles.balanceValue}>{formatCurrency(balanceMetrics.invested)}</Text>
          </View>
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity 
          style={styles.viewAccountButton}
          onPress={() => router.push('/resumen')}
        >
          <Text style={styles.buttonText}>Ver resumen de cuenta completo</Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actionButtonsGrid}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonGray, {minWidth: '100%', maxWidth: '100%'}]}
            activeOpacity={0.7}
            onPress={() => setShowAbonoModal(true)}
          >
            <Feather name="plus" size={20} color="#000" />
            <Text style={[styles.actionButtonText, styles.actionButtonTextGray]}>Abonar fondos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonGray, {minWidth: '100%', maxWidth: '100%'}]}
            activeOpacity={0.7}
            onPress={() => setShowTransferirModal(true)}
          >
            <Feather name="refresh-ccw" size={20} color="#000" />
            <Text style={[styles.actionButtonText, styles.actionButtonTextGray]}>Transferir</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonGray]}
            activeOpacity={0.7}
            onPress={handlePagarServiciosComingSoon}
          >
            <Feather name="dollar-sign" size={20} color="#000" />
            <Text style={[styles.actionButtonText, styles.actionButtonTextGray]}>Pagar Servicios</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonGray]}
            activeOpacity={0.7}
            onPress={async () => {
              try {
                // Generar OTP automáticamente cuando el usuario hace click
                if (user?.phoneNumber) {
                  const { PaymentService } = await import('../services/paymentService');
                  const result = await PaymentService.generatePaymentOtp(user.phoneNumber);
                  
                  if (result.success && result.data?.otp) {
                    // OTP generado exitosamente, guardarlo y mostrar modal
                    setPaymentOtp(result.data.otp);
                    setTelefonoModalType('payment'); // Modal para pagar con CENT
                    setShowTelefonoModal(true);
                  } else {
                    Alert.alert('Error', result.error || 'Error al generar código OTP de pago');
                  }
                } else {
                  Alert.alert('Error', 'No se encontró número de teléfono registrado');
                }
              } catch (error) {
                console.error('Error generating payment OTP:', error);
                Alert.alert('Error', 'Error al generar código OTP de pago');
              }
            }}
          >
            <Ionicons name="phone-portrait" size={20} color="#000" />
            <Text style={[styles.actionButtonText, styles.actionButtonTextGray]}>Pagar con CENT</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dividir Cuentas Section */}
      <View style={styles.dividirSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={24} color="#3dbac6" />
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Dividir cuentas</Text>
            <TouchableOpacity 
              style={styles.helpButton}
              onPress={() => setShowDividirHelpModal(true)}
            >
              <Ionicons name="help-circle" size={20} color="#3dbac6" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.dividirButtonsContainer}>
          <TouchableOpacity 
            style={styles.dividirButton}
            onPress={handleDividirCuentas}
          >
            <Ionicons name="add-circle-outline" size={24} color="#3dbac6" />
            <Text style={styles.dividirButtonText}>Dividir cuentas</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.dividirButton}
            onPress={handleVerSolicitudes}
          >
            <Ionicons name="list-outline" size={24} color="#3dbac6" />
            <Text style={styles.dividirButtonText}>
              {showSolicitudesSection ? 'Ocultar solicitudes' : 'Ver solicitudes'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Solicitudes Section */}
      {showSolicitudesSection && (
        <View style={styles.solicitudesSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={24} color="#3dbac6" />
            <Text style={styles.sectionTitle}>Solicitudes de división</Text>
          </View>
          
          {/* Segmented Control */}
          <View style={styles.segmentedControl}>
            <TouchableOpacity 
              style={[styles.segmentButton, solicitudesTab === 'enviadas' && styles.segmentButtonActive]}
              onPress={() => setSolicitudesTab('enviadas')}
            >
              <Text style={[styles.segmentButtonText, solicitudesTab === 'enviadas' && styles.segmentButtonTextActive]}>
                Enviadas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.segmentButton, solicitudesTab === 'recibidas' && styles.segmentButtonActive]}
              onPress={() => setSolicitudesTab('recibidas')}
            >
              <Text style={[styles.segmentButtonText, solicitudesTab === 'recibidas' && styles.segmentButtonTextActive]}>
                Recibidas
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content based on selected tab */}
          {solicitudesLoading ? (
            <View style={{padding: 24, alignItems: 'center'}}>
              <ActivityIndicator size="large" color="#3dbac6" />
              <Text style={{marginTop: 12, color: '#666'}}>Cargando solicitudes...</Text>
            </View>
          ) : solicitudesTab === 'enviadas' ? (
            <>
              {solicitudesEnviadas.length > 0 ? (
                solicitudesEnviadas.map((solicitud, index) => (
                  <TouchableOpacity 
                    key={solicitud.id} 
                    style={styles.solicitudCard}
                    onPress={() => {
                      setSelectedSolicitud(solicitud);
                      setShowSolicitudDetail(true);
                    }}
                  >
                    <View style={styles.solicitudHeader}>
                      <Text style={styles.solicitudTitle}>{solicitud.concepto}</Text>
                      <Text style={[styles.solicitudEstado, solicitud.estado === 'Enviada' && styles.estadoEnviada]}>
                        {solicitud.estado}
                      </Text>
                    </View>
                    <Text style={styles.solicitudDetail}>Participantes: {solicitud.participantes.length}</Text>
                    <Text style={styles.solicitudDetail}>Total: ${solicitud.total.toFixed(2)}</Text>
                    <Text style={styles.solicitudFecha}>{solicitud.fecha}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="document-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyStateText}>No tienes solicitudes enviadas</Text>
                </View>
              )}
            </>
          ) : (
            <>
              {solicitudesRecibidas.length > 0 ? (
                solicitudesRecibidas.map((solicitud, index) => (
                  <View key={solicitud.id} style={styles.solicitudCard}>
                    <View style={styles.solicitudHeader}>
                      <Text style={styles.solicitudTitle}>{solicitud.concepto}</Text>
                      <Text style={[styles.solicitudEstado, solicitud.estado === 'Pendiente' && styles.estadoPendiente]}>
                        {solicitud.estado}
                      </Text>
                    </View>
                    <Text style={styles.solicitudDetail}>De: {solicitud.de}</Text>
                    <Text style={styles.solicitudDetail}>Participantes: {solicitud.participantes}</Text>
                    <Text style={styles.solicitudDetail}>Total: ${solicitud.total.toFixed(2)}</Text>
                    <Text style={styles.solicitudFecha}>{solicitud.fecha}</Text>
                    
                    {solicitud.estado === 'Pendiente' && (
                      <View style={styles.solicitudActionButtons}>
                        <TouchableOpacity 
                          style={[styles.solicitudActionButton, styles.acceptButton]}
                          onPress={() => {
                            setSelectedRecibida(solicitud);
                            setShowAcceptOTP(true);
                          }}
                        >
                          <Text style={styles.acceptButtonText}>Aceptar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.solicitudActionButton, styles.rejectButton]}
                          onPress={() => {
                            Alert.alert(
                              'Rechazar solicitud',
                              '¿Estás seguro de que quieres rechazar esta solicitud?',
                              [
                                { text: 'Cancelar', style: 'cancel' },
                                { text: 'Rechazar', style: 'destructive', onPress: () => handleRejectSolicitud(solicitud) },
                              ]
                            );
                          }}
                        >
                          <Text style={styles.rejectButtonText}>Rechazar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="document-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyStateText}>No tienes solicitudes recibidas</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Services Grid */}
      <View style={styles.servicesGrid}>
                  <TouchableOpacity style={styles.serviceCardFull} onPress={handleNavigateToInsurance}>
            <Ionicons name="shield-checkmark" size={32} color="#3dbac6" />
            <Text style={styles.serviceTitle}>CiENTe+</Text>
          </TouchableOpacity>
        <View style={styles.servicesRow}>
          <TouchableOpacity style={styles.serviceCardHalf} onPress={handleNavigateToGoals}>
            <View style={styles.serviceCardContent}>
              <Ionicons name="flag" size={24} color="#3dbac6" />
              <View style={styles.serviceCardText}>
                <Text style={styles.serviceTitle}>Metas</Text>
                <Text style={styles.serviceCount}>{goalMetrics.activeGoals}</Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceCardHalf} onPress={handleNavigateToInvestments}>
            <View style={styles.serviceCardContent}>
              <Ionicons name="trending-up" size={24} color="#3dbac6" />
              <View style={styles.serviceCardText}>
                <Text style={styles.serviceTitle}>Inversiones</Text>
                <Text style={styles.serviceCount}>{formatCurrency(investmentMetrics.investedPrincipal)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>



      {/* Streak Card */}
      <View style={styles.streakCard}>
        <View style={styles.streakHeader}>
          <View style={styles.streakContent}>
            <Ionicons name="flame" size={28} color="#FF6B35" />
            <Text style={styles.streakTitle}>Tu racha actual</Text>
            <Text style={styles.streakWeeks}>
              {streakWeeks > 0 
                ? `${streakWeeks} ${streakWeeks === 1 ? 'semana activa' : 'semanas activas'}`
                : streakDays > 0
                ? `${streakDays} ${streakDays === 1 ? 'día activo' : 'días activos'}`
                : '0 días activos'
              }
            </Text>
          </View>
        </View>
        <View style={styles.motivationBox}>
          <Text style={styles.motivationTitle}>¡Mantén la constancia!</Text>
          <Text style={styles.motivationText}>Tu dedicación te acerca a mejores finanzas</Text>
        </View>
      </View>

      {/* Financial Goals Section */}
      <View style={styles.goalsSection}>
        <View style={styles.sectionHeader}>
                      <Feather name="target" size={24} color="#3dbac6" />
          <Text style={styles.sectionTitle}>Metas financieras</Text>
        </View>
        
        {goals.length > 0 ? (
          <View style={styles.goalsList}>
            {topGoals.map((goal, index) => (
              <View key={goal.id || index} style={styles.goalItem}>
                <View style={styles.goalItemHeader}>
                  <Text style={styles.goalItemName}>{goal.name}</Text>
                  <Text style={styles.goalItemAmount}>
                    {formatCurrency(goal.targetAmount ?? 0)}
                  </Text>
                </View>
                <View style={styles.goalItemProgress}>
                  {(() => {
                    const target = goal.targetAmount ?? 0;
                    const current = goal.currentAmount ?? 0;
                    const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
                    return (
                      <>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                              { width: `${percentage}%` },
                      ]}
                    />
                  </View>
                        <Text style={styles.progressText}>{percentage}%</Text>
                      </>
                    );
                  })()}
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.viewAllButton} onPress={handleNavigateToGoals}>
              <Text style={styles.viewAllButtonText}>Ver todas las metas</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.goalsCard}>
                      <Feather name="target" size={48} color="#3dbac6" />
            <Text style={styles.goalsCardTitle}>Establece tus objetivos</Text>
            <Text style={styles.goalsCardDescription}>
              Crea tu primera meta financiera y comienza a dar seguimiento a tu progreso
            </Text>
            <TouchableOpacity style={styles.goalsButton} onPress={handleNavigateToGoals}>
              <Text style={styles.goalsButtonText}>Crea tu primera meta</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Investments Section */}
      <View style={styles.investmentsSection}>
        <View style={styles.sectionHeader}>
                      <Ionicons name="trending-up" size={24} color="#3dbac6" />
          <Text style={styles.sectionTitle}>Inversiones</Text>
        </View>
        
        {investments.length > 0 ? (
          <View style={styles.investmentsList}>
            {topInvestments.map((investment, index) => (
              <View key={investment.id || index} style={styles.investmentItem}>
                <View style={styles.investmentItemHeader}>
                  <Text style={styles.investmentItemName}>
                    {investment.oldSystem ? 'Inversión' : 'Inversión PRO'}
                  </Text>
                  <Text style={styles.investmentItemAmount}>
                    {formatCurrency(investment.amount ?? 0)}
                  </Text>
                </View>
                <View style={styles.investmentItemDetails}>
                  <Text style={styles.investmentItemTerm}>{investment.term} meses</Text>
                  <Text style={styles.investmentItemRate}>
                    {investment.interestRate ? `${investment.interestRate.toFixed(2)}% anual` : '—'}
                  </Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.viewAllButton} onPress={handleNavigateToInvestments}>
              <Text style={styles.viewAllButtonText}>Ver todas las inversiones</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.investmentsCard}>
                      <Ionicons name="trending-up" size={48} color="#3dbac6" />
            <Text style={styles.investmentsCardTitle}>Invierte ahora</Text>
            <Text style={styles.investmentsCardDescription}>
              Realiza tu primera inversión y comienza a generar rendimientos
            </Text>
            <TouchableOpacity style={styles.investmentsButton} onPress={handleNavigateToInvestments}>
              <Text style={styles.investmentsButtonText}>Invertir ahora</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Account Statement Section */}
      <View style={styles.accountSection}>
        <AccountStatement 
          statements={accountStatements} 
          limit={3} 
          showFilters={false} 
        />
      </View>
      {/* Modal de opciones de abono */}
      <Modal
        visible={showAbonoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAbonoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>¿Cómo quieres abonar?</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowAbonoModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <TouchableOpacity 
                style={styles.abonoOption} 
                onPress={() => { 
                  setShowAbonoModal(false);
                  setTelefonoModalType('deposit'); // Modal para abonar en punto de ahorro
                  setShowTelefonoModal(true); 
                }}
              >
                <View style={styles.abonoOptionContent}>
                  <Ionicons name="phone-portrait" size={24} color="#3dbac6" />
                  <View style={styles.abonoOptionText}>
                    <Text style={styles.abonoOptionTitle}>Abonar en punto de ahorro</Text>
                    <Text style={styles.abonoOptionSubtitle}>Abona lo que quieras con tu número de teléfono</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.abonoOption} 
                onPress={handleAbonarPorTransferencia}
              >
                <View style={styles.abonoOptionContent}>
                  <Ionicons name="card" size={24} color="#3dbac6" />
                  <View style={styles.abonoOptionText}>
                    <Text style={styles.abonoOptionTitle}>Abonar por transferencia</Text>
                    <Text style={styles.abonoOptionSubtitle}>Contacta con nosotros para abonar a tu CLABE</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de CLABE para abonar por transferencia */}
      <Modal
        visible={showClabeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowClabeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tu CLABE para depósitos</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowClabeModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.clabeContainer}>
                <View style={{marginBottom: 20}}>
                  <Text style={styles.clabeLabel}>Banco</Text>
                  <View style={{backgroundColor: 'white', borderRadius: 8, padding: 12, marginTop: 8}}>
                    <Text style={{fontSize: 18, fontWeight: 'bold', color: '#3dbac6'}}>Kuspit</Text>
                  </View>
                </View>
                
                <View style={{marginBottom: 20}}>
                  <Text style={styles.clabeLabel}>Nombre</Text>
                  <View style={{backgroundColor: 'white', borderRadius: 8, padding: 12, marginTop: 8}}>
                    <Text style={{fontSize: 18, fontWeight: 'bold', color: '#3dbac6'}}>
                      {user?.firstName || ''} {user?.lastName || ''}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.clabeLabel}>CLABE bancaria</Text>
                <View style={styles.clabeValueContainer}>
                  <Text selectable style={styles.clabeValue}>{userClabe}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => {
                      Alert.alert('Copiado', 'CLABE copiada al portapapeles');
                    }}
                  >
                    <Ionicons name="copy-outline" size={20} color="#3dbac6" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.clabeInstructions}>
                  Usa esta CLABE para realizar depósitos por transferencia bancaria a tu cuenta CENT.
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={() => setShowClabeModal(false)}
              >
                <Text style={styles.submitButtonText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de opciones de transferir */}
      <Modal
        visible={showTransferirModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTransferirModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>¿Cómo quieres transferir?</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowTransferirModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <TouchableOpacity 
                style={styles.transferOption} 
                onPress={() => { 
                  setShowTransferirModal(false);
                  setShowTransferenciaInternaModal(true);
                }}
              >
                <View style={styles.transferOptionContent}>
                  <Ionicons name="people" size={24} color="#3dbac6" />
                  <View style={styles.transferOptionText}>
                    <Text style={styles.transferOptionTitle}>Transferencia interna CENT</Text>
                    <Text style={styles.transferOptionSubtitle}>Transfiere a otros usuarios de CENT</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.transferOption} 
                onPress={() => { 
                  setShowTransferirModal(false);
                  setShowTransferenciaExternaModal(true);
                }}
              >
                <View style={styles.transferOptionContent}>
                  <Ionicons name="card" size={24} color="#3dbac6" />
                  <View style={styles.transferOptionText}>
                    <Text style={styles.transferOptionTitle}>Transferencia externa</Text>
                    <Text style={styles.transferOptionSubtitle}>Transfiere a cuentas bancarias externas</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de pagar servicios */}
      <Modal
        visible={showPagarModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowPagarModal(false);
          setPagarStep(1);
          setSelectedProvider(null);
          setAccountNumber('');
          setQueriedBill(null);
          setServicePin(['', '', '', '']);
          setServiceError('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pagar Servicios</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  setShowPagarModal(false);
                  setPagarStep(1);
                  setSelectedProvider(null);
                  setAccountNumber('');
                  setQueriedBill(null);
                  setServicePin(['', '', '', '']);
                  setServiceError('');
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {pagarStep === 1 && (
                <View>
                  <Text style={styles.stepTitle}>Selecciona el proveedor</Text>
                  {isLoadingProviders ? (
                    <Text style={styles.loadingText}>Cargando proveedores...</Text>
                  ) : serviceProviders.length > 0 ? (
                    <View style={styles.providersList}>
                      {serviceProviders.map((provider) => (
                        <TouchableOpacity
                          key={provider.id}
                          style={[
                            styles.providerCard,
                            selectedProvider?.id === provider.id && styles.providerCardSelected,
                          ]}
                          onPress={() => {
                            setSelectedProvider(provider);
                            setPagarStep(2);
                            setServiceError('');
                          }}
                        >
                          <Text style={styles.providerName}>{provider.name}</Text>
                          {provider.description && (
                            <Text style={styles.providerDescription}>{provider.description}</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.errorText}>
                      {serviceError || 'No hay proveedores disponibles'}
                    </Text>
                  )}
                </View>
              )}

              {pagarStep === 2 && (
                <View>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                      setPagarStep(1);
                      setAccountNumber('');
                      setServiceError('');
                    }}
                  >
                    <Ionicons name="arrow-back" size={20} color="#3dbac6" />
                    <Text style={styles.backButtonText}>Volver</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepTitle}>Ingresa el número de cuenta</Text>
                  <Text style={styles.stepSubtitle}>
                    {selectedProvider?.name}
                  </Text>
                  <TextInput
                    style={styles.accountInput}
                    placeholder="Número de cuenta o referencia"
                    value={accountNumber}
                    onChangeText={(text) => {
                      setAccountNumber(text);
                      setServiceError('');
                    }}
                    keyboardType="numeric"
                    autoFocus
                  />
                  {serviceError ? <Text style={styles.errorText}>{serviceError}</Text> : null}
                  <TouchableOpacity
                    style={[styles.primaryButton, !accountNumber.trim() && styles.primaryButtonDisabled]}
                    onPress={handleQueryBill}
                    disabled={!accountNumber.trim() || isQueryingBill}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isQueryingBill ? 'Consultando...' : 'Consultar Recibo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {pagarStep === 4 && queriedBill && (
                <View>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                      setPagarStep(2);
                      setQueriedBill(null);
                      setServiceError('');
                    }}
                  >
                    <Ionicons name="arrow-back" size={20} color="#3dbac6" />
                    <Text style={styles.backButtonText}>Volver</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepTitle}>Confirma el pago</Text>
                  <View style={styles.billSummary}>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Proveedor:</Text>
                      <Text style={styles.billValue}>{queriedBill.providerName}</Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Número de cuenta:</Text>
                      <Text style={styles.billValue}>{queriedBill.accountNumber}</Text>
                    </View>
                    {queriedBill.accountName && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Titular:</Text>
                        <Text style={styles.billValue}>{queriedBill.accountName}</Text>
                      </View>
                    )}
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Monto a pagar:</Text>
                      <Text style={[styles.billValue, styles.billAmount]}>
                        {formatCurrency(queriedBill.amount)}
                      </Text>
                    </View>
                    {queriedBill.dueDate && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Fecha de vencimiento:</Text>
                        <Text style={styles.billValue}>
                          {new Date(queriedBill.dueDate).toLocaleDateString('es-MX')}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.pinLabel}>Ingresa tu PIN de seguridad</Text>
                  <View style={styles.pinInputRow}>
                    {servicePin.map((digit, index) => (
                      <TextInput
                        key={index}
                        style={styles.pinInput}
                        value={digit}
                        onChangeText={(text) => handleServicePinChange(index, text)}
                        placeholder="•"
                        keyboardType="numeric"
                        maxLength={1}
                        textAlign="center"
                        secureTextEntry
                      />
                    ))}
                  </View>
                  {serviceError ? <Text style={styles.errorText}>{serviceError}</Text> : null}
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (servicePin.join('').length !== 4 || isPayingService) && styles.primaryButtonDisabled,
                    ]}
                    onPress={handlePayService}
                    disabled={servicePin.join('').length !== 4 || isPayingService}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isPayingService ? 'Procesando...' : `Pagar ${formatCurrency(queriedBill.amount)}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Transferencia Interna */}
      <Modal
        visible={showTransferenciaInternaModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowTransferenciaInternaModal(false);
          setTransferenciaInternaStep(1);
          setTransferenciaInternaData({ numero: '', numeroConfirmacion: '', monto: '', montoConfirmacion: '', pin: '', referencia: '' });
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Transferencia Interna CENT ({transferenciaInternaStep}/3)
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowTransferenciaInternaModal(false);
                  setTransferenciaInternaStep(1);
                  setTransferenciaInternaData({ numero: '', numeroConfirmacion: '', monto: '', montoConfirmacion: '', pin: '', referencia: '' });
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Paso 1: Número y Monto */}
              {transferenciaInternaStep === 1 && (
                <View style={styles.transferStep}>
                  <Text style={styles.transferStepTitle}>Información de la transferencia</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Número de teléfono *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={transferenciaInternaData.numero}
                      onChangeText={(value) => handleTransferenciaInternaInput('numero', value)}
                      placeholder="Ej: 55 1234 5678"
                      placeholderTextColor="#999"
                      keyboardType="phone-pad"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Confirma el número de teléfono *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={transferenciaInternaData.numeroConfirmacion}
                      onChangeText={(value) => handleTransferenciaInternaInput('numeroConfirmacion', value)}
                      placeholder="Ej: 55 1234 5678"
                      placeholderTextColor="#999"
                      keyboardType="phone-pad"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Monto *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={transferenciaInternaData.monto}
                      onChangeText={(value) => handleTransferenciaInternaInput('monto', value)}
                      placeholder="$0.00"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Confirma el monto *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={transferenciaInternaData.montoConfirmacion}
                      onChangeText={(value) => handleTransferenciaInternaInput('montoConfirmacion', value)}
                      placeholder="$0.00"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <TouchableOpacity style={styles.submitButton} onPress={handleTransferenciaInternaSubmit}>
                    <Text style={styles.submitButtonText}>Continuar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Paso 2: Confirmación con PIN */}
              {transferenciaInternaStep === 2 && (
                <View style={styles.transferStep}>
                  <Text style={styles.transferStepTitle}>Confirmación</Text>
                  
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Resumen de la transferencia</Text>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Número:</Text>
                      <Text style={styles.summaryValue}>{transferenciaInternaData.numero}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Monto:</Text>
                      <Text style={styles.summaryValue}>${transferenciaInternaData.monto}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Ingresa tu PIN de 4 dígitos *</Text>
                    <TextInput
                      style={[styles.textInput, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
                      value={transferenciaInternaData.pin}
                      onChangeText={(value) => handleTransferenciaInternaInput('pin', value)}
                      placeholder="••••"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      secureTextEntry={true}
                      maxLength={4}
                    />
                  </View>
                  
                  <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => setTransferenciaInternaStep(1)}>
                      <Text style={styles.backButtonText}>Regresar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.submitButtonRow} onPress={handleTransferenciaInternaSubmit}>
                      <Text style={styles.submitButtonText}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Paso 3: Comprobante de la transferencia interna */}
              {transferenciaInternaStep === 3 && (
                <View style={styles.transferStep}>
                  <View style={styles.comprobanteContainer}>
                    <View style={styles.comprobanteHeader}>
                      <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                      <Text style={styles.comprobanteTitle}>¡Transferencia Exitosa!</Text>
                      <Text style={styles.comprobanteSubtitle}>Tu transferencia interna ha sido procesada correctamente</Text>
                    </View>

                    <View style={styles.comprobanteCard}>
                      <Text style={styles.comprobanteCardTitle}>Comprobante de Transferencia Interna</Text>
                      
                      <View style={styles.comprobanteItem}>
                        <Text style={styles.comprobanteLabel}>Número de Referencia:</Text>
                        <Text style={styles.comprobanteValue}>{transferenciaInternaData.referencia}</Text>
                      </View>
                      
                      <View style={styles.comprobanteItem}>
                        <Text style={styles.comprobanteLabel}>Fecha y Hora:</Text>
                        <Text style={styles.comprobanteValue}>{new Date().toLocaleString('es-MX')}</Text>
                      </View>
                      
                      <View style={styles.comprobanteItem}>
                        <Text style={styles.comprobanteLabel}>Número de teléfono:</Text>
                        <Text style={styles.comprobanteValue}>{transferenciaInternaData.numero}</Text>
                      </View>
                      
                      <View style={styles.comprobanteItem}>
                        <Text style={styles.comprobanteLabel}>Monto transferido:</Text>
                        <Text style={styles.comprobanteValue}>${transferenciaInternaData.monto}</Text>
                      </View>
                    </View>

                    <View style={styles.infoCard}>
                      <Ionicons name="time" size={20} color="#FF9800" />
                      <Text style={styles.infoText}>
                        ⏰ La transferencia se verá reflejada en unos minutos
                      </Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.submitButtonRow} 
                      onPress={() => {
                        setShowTransferenciaInternaModal(false);
                        setTransferenciaInternaStep(1);
                        setTransferenciaInternaData({ numero: '', numeroConfirmacion: '', monto: '', montoConfirmacion: '', pin: '', referencia: '' });
                      }}
                    >
                      <Text style={styles.submitButtonText}>Finalizar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Transferencia Externa */}
      <Modal
        visible={showTransferenciaExternaModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowTransferenciaExternaModal(false);
          setTransferenciaExternaStep(1);
          setTransferenciaExternaData({ nombre: '', banco: '', clabe: '', monto: '', pin: '', referencia: '' });
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Transferencia Externa ({transferenciaExternaStep}/3)
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowTransferenciaExternaModal(false);
                  setTransferenciaExternaStep(1);
                  setTransferenciaExternaData({ nombre: '', banco: '', clabe: '', monto: '', pin: '', referencia: '' });
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Paso 1: Información completa de la transferencia */}
              {transferenciaExternaStep === 1 && (
                <View style={styles.transferStep}>
                  <Text style={styles.transferStepTitle}>Información de la transferencia</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nombre de la persona *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={transferenciaExternaData.nombre}
                      onChangeText={(value) => handleTransferenciaExternaInput('nombre', value)}
                      placeholder="Nombre completo del beneficiario"
                      autoCapitalize="words"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Banco *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={transferenciaExternaData.banco}
                      onChangeText={(value) => handleTransferenciaExternaInput('banco', value)}
                      placeholder="Nombre del banco"
                      autoCapitalize="words"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Cuenta CLABE *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={transferenciaExternaData.clabe}
                      onChangeText={(value) => handleTransferenciaExternaInput('clabe', value)}
                      placeholder="18 dígitos"
                      keyboardType="numeric"
                      maxLength={18}
                    />
                    <Text style={styles.inputHelp}>La CLABE debe tener exactamente 18 dígitos</Text>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Monto *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={transferenciaExternaData.monto}
                      onChangeText={(value) => handleTransferenciaExternaInput('monto', value)}
                      placeholder="$0.00"
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View style={styles.infoCard}>
                    <Ionicons name="information-circle" size={20} color="#3dbac6" />
                    <Text style={styles.infoText}>
                      La transferencia externa se verá reflejada en unos minutos o hasta en 24 horas
                    </Text>
                  </View>
                  
                  <TouchableOpacity style={styles.submitButton} onPress={handleTransferenciaExternaSubmit}>
                    <Text style={styles.submitButtonText}>Continuar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Paso 2: Confirmación con PIN */}
              {transferenciaExternaStep === 2 && (
                <View style={styles.transferStep}>
                  <Text style={styles.transferStepTitle}>Confirmación</Text>
                  
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Resumen de la transferencia</Text>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Nombre:</Text>
                      <Text style={styles.summaryValue}>{transferenciaExternaData.nombre}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Banco:</Text>
                      <Text style={styles.summaryValue}>{transferenciaExternaData.banco}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>CLABE:</Text>
                      <Text style={styles.summaryValue}>{transferenciaExternaData.clabe}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Monto:</Text>
                      <Text style={styles.summaryValue}>${transferenciaExternaData.monto}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Ingresa tu PIN de 4 dígitos *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={transferenciaExternaData.pin}
                      onChangeText={(value) => handleTransferenciaExternaInput('pin', value)}
                      placeholder="••••"
                      keyboardType="numeric"
                      secureTextEntry={true}
                      maxLength={4}
                    />
                  </View>
                  
                  <View style={styles.infoCard}>
                    <Ionicons name="time" size={20} color="#FF9800" />
                    <Text style={styles.infoText}>
                      ⏰ La transferencia se verá reflejada en unos minutos o hasta en 24 horas
                    </Text>
                  </View>
                  
                  <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => setTransferenciaExternaStep(1)}>
                      <Text style={styles.backButtonText}>Regresar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.submitButtonRow,
                        isProcessingTransferenciaExterna && styles.disabledButton,
                      ]}
                      onPress={handleTransferenciaExternaSubmit}
                      disabled={isProcessingTransferenciaExterna}
                    >
                      <Text style={styles.submitButtonText}>
                        {isProcessingTransferenciaExterna ? 'Procesando...' : 'Confirmar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Paso 3: Comprobante de la transferencia */}
              {transferenciaExternaStep === 3 && (
                <View style={styles.transferStep}>
                  <View style={styles.comprobanteContainer}>
                    <View style={styles.comprobanteHeader}>
                      <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                      <Text style={styles.comprobanteTitle}>¡Transferencia Exitosa!</Text>
                      <Text style={styles.comprobanteSubtitle}>Tu transferencia ha sido procesada correctamente</Text>
                    </View>

                    <View style={styles.comprobanteCard}>
                      <Text style={styles.comprobanteCardTitle}>Comprobante de Transferencia</Text>
                      
                      <View style={styles.comprobanteItem}>
                        <Text style={styles.comprobanteLabel}>Número de Referencia:</Text>
                        <Text style={styles.comprobanteValue}>{transferenciaExternaData.referencia}</Text>
                      </View>
                      
                      <View style={styles.comprobanteItem}>
                        <Text style={styles.comprobanteLabel}>Fecha y Hora:</Text>
                        <Text style={styles.comprobanteValue}>{new Date().toLocaleString('es-MX')}</Text>
                      </View>
                      
                      <View style={styles.comprobanteItem}>
                        <Text style={styles.comprobanteLabel}>Nombre del Beneficiario:</Text>
                        <Text style={styles.comprobanteValue}>{transferenciaExternaData.nombre}</Text>
                      </View>
                      
                      <View style={styles.comprobanteItem}>
                        <Text style={styles.comprobanteLabel}>Banco:</Text>
                        <Text style={styles.comprobanteValue}>{transferenciaExternaData.banco}</Text>
                      </View>
                      
                      <View style={styles.comprobanteItem}>
                        <Text style={styles.comprobanteLabel}>CLABE:</Text>
                        <Text style={styles.comprobanteValue}>{transferenciaExternaData.clabe}</Text>
                      </View>
                      
                      <View style={styles.comprobanteItem}>
                        <Text style={styles.comprobanteLabel}>Monto Transferido:</Text>
                        <Text style={styles.comprobanteValue}>${transferenciaExternaData.monto}</Text>
                      </View>
                    </View>

                    <View style={styles.infoCard}>
                      <Ionicons name="time" size={20} color="#FF9800" />
                      <Text style={styles.infoText}>
                        ⏰ La transferencia se verá reflejada en unos minutos o hasta en 24 horas
                      </Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.submitButtonRow} 
                      onPress={() => {
                        setShowTransferenciaExternaModal(false);
                        setTransferenciaExternaStep(1);
                        setTransferenciaExternaData({ nombre: '', banco: '', clabe: '', monto: '', pin: '', referencia: '' });
                      }}
                    >
                      <Text style={styles.submitButtonText}>Finalizar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para ingresar cantidad y mostrar código */}
      <Modal
        visible={showCodigoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCodigoModal(false)}
      >
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center'}}>
          <View style={{backgroundColor: 'white', borderRadius: 16, padding: 24, width: '85%'}}>
            <Text style={{fontWeight: 'bold', fontSize: 18, marginBottom: 16}}>Abonar con código</Text>
            <Text style={{fontSize: 14, color: '#666', marginBottom: 8}}>Ingresa la cantidad a abonar:</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
              <Text style={{fontSize: 16, marginRight: 8}}>$</Text>
              <TextInput
                style={{borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, flex: 1}}
                keyboardType="numeric"
                value={cantidad}
                onChangeText={setCantidad}
                placeholder="Cantidad"
              />
            </View>
            <TouchableOpacity
              style={{backgroundColor: '#3dbac6', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 12}}
              onPress={() => setCodigo(generarCodigo(cantidad))}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>Generar código</Text>
            </TouchableOpacity>
            {codigo !== '' && (
              <View style={{backgroundColor: '#EFF3FE', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 12}}>
                <Text style={{fontSize: 16, color: '#3dbac6', fontWeight: 'bold'}}>Tu código:</Text>
                                  <Text selectable style={{fontSize: 20, color: '#3dbac6', fontWeight: 'bold', marginTop: 8}}>{codigo}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => { setShowCodigoModal(false); setCantidad(''); setCodigo(''); }} style={{alignSelf: 'flex-end', marginTop: 8}}>
              <Text style={{color: '#FF3B30'}}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Modal para mostrar el número de teléfono */}
      <Modal
        visible={showTelefonoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTelefonoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.telefonoModalContainer}>
            <View style={styles.telefonoModalHeader}>
              <Text style={styles.telefonoModalTitle}>
                {telefonoModalType === 'payment' ? 'Pagar con CENT' : 'Abonar en punto de ahorro'}
              </Text>
              <TouchableOpacity onPress={() => setShowTelefonoModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.telefonoModalContent}>
              <Ionicons name="phone-portrait" size={64} color="#3dbac6" style={styles.telefonoIcon} />
              
              {telefonoModalType === 'payment' ? (
                <>
                  <Text style={styles.telefonoLabel}>Código de Pago CENT</Text>
                  
                  <Text style={styles.telefonoInstruction}>
                    Dicta este código al cajero del POS para realizar tu pago:
                  </Text>
                  
                  {/* Mostrar OTP de forma grande y clara */}
                  <View style={[styles.phoneNumberContainer, { 
                    backgroundColor: '#E8F5E9', 
                    borderColor: '#4CAF50', 
                    borderWidth: 2,
                    padding: 20,
                    marginVertical: 20,
                    borderRadius: 12
                  }]}>
                    <Text
                      selectable
                      style={[styles.phoneNumber, { 
                        fontSize: 32, 
                        fontWeight: 'bold', 
                        color: '#2E7D32',
                        letterSpacing: 8,
                        textAlign: 'center'
                      }]}
                    >
                      {paymentOtp || '---'}
                    </Text>
                  </View>
                  
                  <Text style={[styles.telefonoInstruction, { marginTop: 8, fontSize: 14, color: '#666' }]}>
                    Tu número de teléfono:
                  </Text>
                  
                  <View style={styles.phoneNumberContainer}>
                    <Text
                      selectable
                      style={styles.phoneNumber}
                    >
                      {user?.phoneNumber || 'Sin número registrado'}
                    </Text>
                  </View>
                  
                  <Text style={[styles.telefonoInstruction, { marginTop: 16, fontSize: 12, color: '#FF9800', fontWeight: '600' }]}>
                    ⏱️ El código OTP es válido por 2 minutos
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.telefonoLabel}>Tu número de teléfono</Text>
                  
                  <View style={styles.phoneNumberContainer}>
                    <Text
                      selectable
                      style={styles.phoneNumber}
                    >
                      {user?.phoneNumber || 'Sin número registrado'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para dividir cuentas */}
      <Modal
        visible={showDividirModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDividirModal(false);
          setDividirStep(1);
          setFormData({concepto: '', descripcion: '', participantes: []});
        }}
      >
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center'}}>
          <View style={{backgroundColor: 'white', borderRadius: 16, padding: 24, width: '90%', maxHeight: '80%'}}>
            
            {/* Step 1: Concepto y descripción */}
            {dividirStep === 1 && (
              <>
                <Text style={{fontWeight: 'bold', fontSize: 18, marginBottom: 16, color: '#3dbac6'}}>¿Qué gasto quieres dividir?</Text>
                
                <Text style={{fontSize: 14, color: '#666', marginBottom: 8}}>Concepto del gasto:</Text>
                <TextInput
                  style={{borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12}}
                  value={formData.concepto}
                  onChangeText={(text) => setFormData({...formData, concepto: text})}
                  placeholder="Ej: Cena, Renta, Gasolina..."
                />
                
                <Text style={{fontSize: 14, color: '#666', marginBottom: 8}}>Descripción (opcional):</Text>
                <TextInput
                  style={{borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, height: 80}}
                  value={formData.descripcion}
                  onChangeText={(text) => setFormData({...formData, descripcion: text})}
                  placeholder="Describe el gasto..."
                  multiline
                />
                
                <TouchableOpacity
                  style={{backgroundColor: '#3dbac6', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 8}}
                  onPress={() => {
                    if (!formData.concepto.trim()) {
                      Alert.alert('Error', 'Ingresa el concepto del gasto');
                      return;
                    }
                    if (formData.participantes.length === 0) {
                      setFormData({...formData, participantes: [{nombre: '', telefono: '', monto: ''}]});
                    }
                    setDividirStep(2);
                  }}
                >
                  <Text style={{color: 'white', fontWeight: 'bold'}}>Continuar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => {
                  setShowDividirModal(false);
                  setDividirStep(1);
                  setFormData({concepto: '', descripcion: '', participantes: []});
                }} style={{alignSelf: 'center'}}>
                  <Text style={{color: '#FF3B30'}}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Participantes */}
            {dividirStep === 2 && (
              <>
                <Text style={{fontWeight: 'bold', fontSize: 18, marginBottom: 16, color: '#3dbac6'}}>¿Con quién vas a compartir?</Text>
                
                {formData.participantes.map((participante, index) => (
                  <View key={index} style={{marginBottom: 12, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8}}>
                    <Text style={{fontSize: 14, color: '#666', marginBottom: 8}}>Persona {index + 1}:</Text>
                    <TextInput
                      style={{borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8}}
                      value={participante.nombre}
                      onChangeText={(text) => {
                        const nuevosParticipantes = [...formData.participantes];
                        nuevosParticipantes[index] = {...nuevosParticipantes[index], nombre: text};
                        setFormData({...formData, participantes: nuevosParticipantes});
                      }}
                      placeholder="Nombre"
                    />
                    <TextInput
                      style={{borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8}}
                      value={participante.telefono}
                      onChangeText={(text) => {
                        const nuevosParticipantes = [...formData.participantes];
                        nuevosParticipantes[index] = {...nuevosParticipantes[index], telefono: text};
                        setFormData({...formData, participantes: nuevosParticipantes});
                      }}
                      placeholder="Teléfono"
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      style={{borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12}}
                      value={participante.monto}
                      onChangeText={(text) => {
                        const nuevosParticipantes = [...formData.participantes];
                        nuevosParticipantes[index] = {...nuevosParticipantes[index], monto: text};
                        setFormData({...formData, participantes: nuevosParticipantes});
                      }}
                      placeholder="Monto a cobrar"
                      keyboardType="numeric"
                    />
                    {formData.participantes.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          const nuevosParticipantes = formData.participantes.filter((_, i) => i !== index);
                          setFormData({...formData, participantes: nuevosParticipantes});
                        }}
                        style={{position: 'absolute', top: 8, right: 8, backgroundColor: '#FF3B30', borderRadius: 20, padding: 4}}
                      >
                        <Ionicons name="close" size={16} color="white" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                
                <TouchableOpacity
                  onPress={() => {
                    const nuevosParticipantes = [...formData.participantes, {nombre: '', telefono: '', monto: ''}];
                    setFormData({...formData, participantes: nuevosParticipantes});
                  }}
                  style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}
                >
                              <Ionicons name="add-circle" size={20} color="#3dbac6" />
            <Text style={{color: '#3dbac6', marginLeft: 8, fontWeight: '600'}}>Agregar persona</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{backgroundColor: '#3dbac6', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 8}}
                  onPress={() => {
                    const valid = formData.participantes.filter(p => p.nombre.trim() && p.telefono.replace(/\D/g,'').length >= 10 && parseFloat(String(p.monto)) > 0);
                    if (valid.length === 0) {
                      Alert.alert('Error', 'Agrega al menos un participante con nombre, teléfono (10 dígitos) y monto mayor a 0');
                      return;
                    }
                    setDividirStep(3);
                  }}
                >
                  <Text style={{color: 'white', fontWeight: 'bold'}}>Continuar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => setDividirStep(1)} style={{alignSelf: 'center'}}>
                  <Text style={{color: '#666'}}>Regresar</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 3: Confirmación */}
            {dividirStep === 3 && (
              <>
                <Text style={{fontWeight: 'bold', fontSize: 18, marginBottom: 16, color: '#3dbac6'}}>Confirma los detalles</Text>
                
                <View style={{backgroundColor: '#f8f9fa', borderRadius: 8, padding: 16, marginBottom: 16}}>
                                      <Text style={{fontSize: 16, fontWeight: 'bold', color: '#3dbac6', marginBottom: 8}}>Concepto: {formData.concepto}</Text>
                  {formData.descripcion && (
                    <Text style={{fontSize: 14, color: '#666', marginBottom: 8}}>Descripción: {formData.descripcion}</Text>
                  )}
                  
                                      <Text style={{fontSize: 16, fontWeight: 'bold', color: '#3dbac6', marginTop: 12, marginBottom: 8}}>Participantes:</Text>
                  {formData.participantes.map((participante, index) => (
                    <Text key={index} style={{fontSize: 14, color: '#666', marginBottom: 4}}>
                      • {participante.nombre} - ${participante.monto}
                    </Text>
                  ))}
                  
                                      <Text style={{fontSize: 16, fontWeight: 'bold', color: '#3dbac6', marginTop: 12}}>
                    Total: ${formData.participantes.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0).toFixed(2)}
                  </Text>
                </View>
                
                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                  <TouchableOpacity
                    style={{backgroundColor: '#666', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, flex: 1, marginRight: 8}}
                    onPress={() => setDividirStep(2)}
                  >
                    <Text style={{color: 'white', fontWeight: 'bold', textAlign: 'center'}}>Regresar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={{backgroundColor: '#3dbac6', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, flex: 1, marginLeft: 8}}
                    onPress={() => setDividirStep(4)}
                  >
                    <Text style={{color: 'white', fontWeight: 'bold', textAlign: 'center'}}>Continuar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 4: OTP */}
            {dividirStep === 4 && (
              <>
                <Text style={{fontWeight: 'bold', fontSize: 18, marginBottom: 16, color: '#3dbac6'}}>Código de seguridad</Text>
                <Text style={{fontSize: 14, color: '#666', marginBottom: 16, textAlign: 'center'}}>Ingresa tu código de seguridad de 4 dígitos:</Text>
                
                <TextInput
                  style={{borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, width: '100%', textAlign: 'center', fontSize: 18, letterSpacing: 8, marginBottom: 16}}
                  value={codigoSeguridad}
                  onChangeText={setCodigoSeguridad}
                  placeholder="0000"
                  keyboardType="numeric"
                  maxLength={4}
                />
                
                <TouchableOpacity
                  style={{backgroundColor: isCreatingSolicitud ? '#a0d8df' : '#3dbac6', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 8}}
                  disabled={isCreatingSolicitud}
                  onPress={async () => {
                    if (codigoSeguridad.length !== 4) {
                      Alert.alert('Error', 'Ingresa tu código de seguridad de 4 dígitos');
                      return;
                    }
                    setIsCreatingSolicitud(true);
                    const result = await SplitRequestsService.createSplitRequest({
                      concepto: formData.concepto,
                      descripcion: formData.descripcion || undefined,
                      participantes: formData.participantes,
                      pin: codigoSeguridad,
                    });
                    setIsCreatingSolicitud(false);
                    if (result.success) {
                      setShowDividirModal(false);
                      setShowSolicitudesSection(true);
                      setCodigoSeguridad('');
                      setDividirStep(1);
                      setFormData({concepto: '', descripcion: '', participantes: []});
                      loadSolicitudes();
                      Alert.alert('Éxito', 'Solicitud creada. Los participantes recibirán la notificación.');
                    } else {
                      Alert.alert('Error', result.error || 'No se pudo crear la solicitud');
                    }
                  }}
                >
                  <Text style={{color: 'white', fontWeight: 'bold'}}>{isCreatingSolicitud ? 'Creando...' : 'Confirmar'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => setDividirStep(3)} style={{alignSelf: 'center'}}>
                  <Text style={{color: '#666'}}>Regresar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal para código de seguridad */}
      <Modal
        visible={showCodigoSeguridadModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCodigoSeguridadModal(false)}
      >
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center'}}>
          <View style={{backgroundColor: 'white', borderRadius: 16, padding: 24, width: '85%', alignItems: 'center'}}>
                            <Text style={{fontWeight: 'bold', fontSize: 18, marginBottom: 16, color: '#3dbac6'}}>Código de seguridad</Text>
            <Text style={{fontSize: 14, color: '#666', marginBottom: 16, textAlign: 'center'}}>Ingresa tu código de seguridad de 4 dígitos:</Text>
            
            <TextInput
              style={{borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, width: '100%', textAlign: 'center', fontSize: 18, letterSpacing: 8}}
              value={codigoSeguridad}
              onChangeText={setCodigoSeguridad}
              placeholder="0000"
              keyboardType="numeric"
              maxLength={4}
            />
            
                            <TouchableOpacity
                  style={{backgroundColor: '#3dbac6', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, marginTop: 16, marginBottom: 8}}
                  onPress={() => { setShowCodigoSeguridadModal(false); setShowSolicitudesModal(true); setCodigoSeguridad(''); }}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>Confirmar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setShowCodigoSeguridadModal(false)} style={{marginTop: 8}}>
              <Text style={{color: '#FF3B30'}}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>



      {/* Modal para detalles de solicitud enviada */}
      <Modal
        visible={showSolicitudDetail}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSolicitudDetail(false);
          setSelectedSolicitud(null);
        }}
      >
        <View
          style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center'}}
          onTouchStart={(e) => {
            // Close when tapping the dark backdrop (outside the card)
            if (e.target === e.currentTarget) {
              setShowSolicitudDetail(false);
              setSelectedSolicitud(null);
            }
          }}
        >
          <View style={{backgroundColor: 'white', borderRadius: 16, padding: 24, width: '90%', maxHeight: '80%'}}>
            {selectedSolicitud && (
              <>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>{selectedSolicitud.concepto}</Text>
                  <Text style={[styles.detailEstado, styles.estadoEnviada]}>
                    {selectedSolicitud.estado}
                  </Text>
                </View>

                {selectedSolicitud.descripcion && (
                  <Text style={styles.detailDescription}>{selectedSolicitud.descripcion}</Text>
                )}

                <Text style={styles.detailSectionTitle}>Participantes:</Text>
                <ScrollView style={{maxHeight: 200}} showsVerticalScrollIndicator={false}>
                  {selectedSolicitud.participantes.map((participante: any, index: number) => (
                    <View key={index} style={styles.participanteCard}>
                      <View style={styles.participanteHeader}>
                        <Text style={styles.participanteNombre}>{participante.nombre}</Text>
                        <Text style={[styles.participanteEstado,
                          participante.estado === 'Pendiente' ? styles.estadoPendiente :
                          participante.estado === 'Rechazada' ? styles.estadoRechazada :
                          styles.estadoEnviada]}>
                          {participante.estado}
                        </Text>
                      </View>
                      <Text style={styles.participanteTelefono}>{participante.telefono}</Text>
                      <Text style={styles.participanteMonto}>${participante.monto.toFixed(2)}</Text>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.detailSummary}>
                  <Text style={styles.detailTotal}>Total: ${selectedSolicitud.total.toFixed(2)}</Text>
                  <Text style={styles.detailFecha}>Fecha: {selectedSolicitud.fecha}</Text>
                </View>

                {selectedSolicitud.estado !== 'Completada' && selectedSolicitud.estado !== 'Cancelada' && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowCancelConfirmation(true)}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar solicitud</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => {
                    setShowSolicitudDetail(false);
                    setSelectedSolicitud(null);
                  }} 
                  style={{alignSelf: 'center', marginTop: 16}}
                >
                  <Text style={{color: '#666'}}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de confirmación para cancelar */}
      <Modal
        visible={showCancelConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowCancelConfirmation(false); setCancelPin(''); }}
      >
        <View
          style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center'}}
          onTouchStart={(e) => { if (e.target === e.currentTarget) { setShowCancelConfirmation(false); setCancelPin(''); } }}
        >
          <View style={{backgroundColor: 'white', borderRadius: 16, padding: 24, width: '85%'}}>
            <Text style={{fontWeight: 'bold', fontSize: 18, marginBottom: 16, color: '#3dbac6'}}>Confirmar cancelación</Text>
            <Text style={{fontSize: 16, color: '#666', marginBottom: 16, textAlign: 'center'}}>
              ¿Estás seguro de que quieres cancelar esta solicitud? Ingresa tu PIN para confirmar.
            </Text>
            <TextInput
              style={{borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20, textAlign: 'center', fontSize: 18, letterSpacing: 8}}
              value={cancelPin}
              onChangeText={setCancelPin}
              placeholder="0000"
              keyboardType="numeric"
              maxLength={4}
            />
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <TouchableOpacity
                style={{backgroundColor: '#666', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, flex: 1, marginRight: 8}}
                onPress={() => { setShowCancelConfirmation(false); setCancelPin(''); }}
              >
                <Text style={{color: 'white', fontWeight: 'bold', textAlign: 'center'}}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{backgroundColor: '#FF3B30', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, flex: 1, marginLeft: 8}}
                onPress={handleCancelSolicitud}
              >
                <Text style={{color: 'white', fontWeight: 'bold', textAlign: 'center'}}>Cancelar solicitud</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de OTP para aceptar solicitud */}
      <Modal
        visible={showAcceptOTP}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAcceptOTP(false);
          setSelectedRecibida(null);
          setAcceptOTP('');
        }}
      >
        <View
          style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center'}}
          onTouchStart={(e) => { if (e.target === e.currentTarget) { setShowAcceptOTP(false); setSelectedRecibida(null); setAcceptOTP(''); } }}
        >
          <View style={{backgroundColor: 'white', borderRadius: 16, padding: 24, width: '85%'}}>
                            <Text style={{fontWeight: 'bold', fontSize: 18, marginBottom: 16, color: '#3dbac6'}}>Confirmar aceptación</Text>
            
            {selectedRecibida && (
              <View style={{backgroundColor: '#F8F9FA', borderRadius: 8, padding: 16, marginBottom: 16}}>
                                  <Text style={{fontSize: 16, fontWeight: 'bold', color: '#3dbac6', marginBottom: 8}}>
                  Concepto: {selectedRecibida.concepto}
                </Text>
                <Text style={{fontSize: 14, color: '#666', marginBottom: 4}}>
                  De: {selectedRecibida.de}
                </Text>
                <Text style={{fontSize: 14, color: '#666', marginBottom: 4}}>
                  Total: ${selectedRecibida.total.toFixed(2)}
                </Text>
              </View>
            )}
            
            <Text style={{fontSize: 14, color: '#666', marginBottom: 16, textAlign: 'center'}}>
              Ingresa tu código de seguridad de 4 dígitos para confirmar:
            </Text>
            
            <TextInput
              style={{borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, width: '100%', textAlign: 'center', fontSize: 18, letterSpacing: 8, marginBottom: 16}}
              value={acceptOTP}
              onChangeText={setAcceptOTP}
              placeholder="0000"
              keyboardType="numeric"
              maxLength={4}
            />
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <TouchableOpacity
                style={{backgroundColor: '#666', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, flex: 1, marginRight: 8}}
                onPress={() => {
                  setShowAcceptOTP(false);
                  setSelectedRecibida(null);
                  setAcceptOTP('');
                }}
              >
                <Text style={{color: 'white', fontWeight: 'bold', textAlign: 'center'}}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{backgroundColor: '#2E7D32', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, flex: 1, marginLeft: 8}}
                onPress={handleAcceptSolicitud}
              >
                <Text style={{color: 'white', fontWeight: 'bold', textAlign: 'center'}}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              <Text style={styles.modalTitle}>Información del Dashboard</Text>
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
                  Es el panel principal donde ves el resumen de todo tu dinero en CENT: disponible, metas y dinero invertido.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>Cómo usar</Text>
                <View style={styles.stepList}>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.stepText}>Revisa tu balance en Tu dinero total.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.stepText}>Usa las opciones rápidas: Abonar fondos, Pagar o Transferir.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.stepText}>Accede a "Dividir cuentas" si quieres compartir gastos con otras personas.</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Dividir Cuentas Help Modal */}
      <Modal
        visible={showDividirHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDividirHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Información de Dividir Cuentas</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowDividirHelpModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>¿Qué es?</Text>
                <Text style={styles.helpText}>
                  La función de Dividir cuentas te permite repartir gastos con amigos, familia o compañeros de manera sencilla desde la app. Puedes crear una cuenta compartida para un gasto específico (ej. cena, viaje, regalo) y cada persona aporta su parte. Todo queda registrado para que no tengas que hacer cuentas manuales.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>Cómo usar</Text>
                <View style={styles.stepList}>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.stepText}>Entra a Inicio {'>'} Dividir cuentas.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.stepText}>Selecciona Crear nueva división.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.stepText}>Escribe el nombre de la cuenta o gasto (ej. "Cena viernes" o "Viaje a CDMX").</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>4</Text>
                    </View>
                    <Text style={styles.stepText}>Indica el monto total y define cómo se dividirá: Monto personalizado (tú decides cuánto debe pagar cada persona).</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>5</Text>
                    </View>
                    <Text style={styles.stepText}>Invita a los participantes ingresando su número de teléfono registrado en CENT.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>6</Text>
                    </View>
                    <Text style={styles.stepText}>Confirma la división y envía la solicitud.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>7</Text>
                    </View>
                    <Text style={styles.stepText}>Cada participante recibe una notificación para abonar su parte.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>8</Text>
                    </View>
                    <Text style={styles.stepText}>Podrás ver en la sección Ver solicitudes quién ya pagó, quién falta por completar y las solicitudes que tienes que pagar tú.</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CENT ED Modal */}
      <Modal
        visible={showCentEdModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCentEdModal(false);
          setSelectedCategory(null);
        }}
      >
        <View style={styles.centEdModalOverlay}>
          <View style={styles.centEdModalContent}>
            <View style={styles.centEdModalHeader}>
              <Text style={styles.centEdModalTitle}>CENT ED - Educación Financiera</Text>
              <TouchableOpacity
                style={styles.centEdCloseButton}
                onPress={() => {
                  setShowCentEdModal(false);
                  setSelectedCategory(null);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.centEdModalBody} showsVerticalScrollIndicator={false}>
              {!selectedCategory ? (
                // Categories View
                <View style={styles.centEdCategoriesContainer}>
                  {centEdCategories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[styles.centEdCategoryCard, { borderLeftColor: category.color }]}
                      onPress={() => setSelectedCategory(category.id)}
                    >
                      <View style={styles.centEdCategoryHeader}>
                        <Text style={styles.centEdCategoryIcon}>{category.icon}</Text>
                        <View style={styles.centEdCategoryText}>
                          <Text style={styles.centEdCategoryTitle}>{category.title}</Text>
                          <Text style={styles.centEdCategorySubtitle}>{category.subtitle}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                // Articles View
                <View style={styles.centEdArticlesContainer}>
                  <TouchableOpacity
                    style={styles.centEdBackButton}
                    onPress={() => setSelectedCategory(null)}
                  >
                    <Ionicons name="chevron-back" size={20} color="#3dbac6" />
                    <Text style={styles.centEdBackText}>Volver a categorías</Text>
                  </TouchableOpacity>
                  
                  {(() => {
                    const category = centEdCategories.find(cat => cat.id === selectedCategory);
                    if (!category) return null;
                    
                    return (
                      <View>
                        <View style={styles.centEdCategoryHeaderInArticles}>
                          <Text style={styles.centEdCategoryIcon}>{category.icon}</Text>
                          <View style={styles.centEdCategoryText}>
                            <Text style={styles.centEdCategoryTitle}>{category.title}</Text>
                            <Text style={styles.centEdCategorySubtitle}>{category.subtitle}</Text>
                          </View>
                        </View>
                        
                        <View style={styles.centEdArticlesList}>
                          {category.articles.map((article, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.centEdArticleCard}
                              onPress={async () => {
                                try {
                                  const supported = await Linking.canOpenURL(article.url);
                                  if (supported) {
                                    await Linking.openURL(article.url);
                                  } else {
                                    Alert.alert('Error', 'No se pudo abrir el enlace');
                                  }
                                } catch (error) {
                                  // Si falla canOpenURL, intentar abrir directamente
                                  try {
                                    await Linking.openURL(article.url);
                                  } catch (openError) {
                                    Alert.alert('Error', 'No se pudo abrir el enlace. Por favor, inténtalo de nuevo.');
                                  }
                                }
                              }}
                            >
                              <View style={styles.centEdArticleContent}>
                                <Text style={styles.centEdArticleNumber}>{index + 1}.</Text>
                                <Text style={styles.centEdArticleTitle}>{article.title}</Text>
                              </View>
                              <Ionicons name="open-outline" size={20} color="#3dbac6" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })()}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CENT ED Card */}
      <View style={styles.centEdCard}>
        <View style={styles.centEdHeader}>
          <Ionicons name="school" size={24} color="#3dbac6" />
          <Text style={styles.centEdTitle}>CENT ED</Text>
        </View>
        
        <View style={styles.centEdContent}>
          <Ionicons name="book" size={32} color="#3dbac6" />
          <View style={styles.centEdText}>
            <Text style={styles.centEdCardTitle}>Educación Financiera</Text>
            <Text style={styles.centEdCardSubtitle}>Aprende a manejar mejor tu dinero</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.centEdButton}
          onPress={() => setShowCentEdModal(true)}
        >
          <Text style={styles.centEdButtonText}>Explorar Cursos</Text>
          <Ionicons name="arrow-forward" size={16} color="white" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F7',
    padding: 16,
    marginTop:50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  flameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B3B2B2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  flameDaysText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  welcomeContainer: {
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeTitleUser: {
    color: '#3dbac6',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
  },
  balanceCard: {
    backgroundColor: '#528FAA',
    borderRadius: 20,
    padding: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: 'white',
    textAlign: 'center',
  },
  walletIcon: {
    marginRight: 8,
  },
  balanceDetails: {
    marginBottom: 16,
  },
  detailText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  viewAccountButton: {
    backgroundColor: '#EFF3FE',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 16,
  },
  buttonText: {
    color: '#000000',
    textAlign: 'center',
    fontSize: 16,
    
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    minWidth: '48%',
    maxWidth: '48%',
    marginVertical: 4,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3dbac6',
    gap: 8,
  },
  actionButtonWhite: {
    backgroundColor: '#FFFFFF',
  },
  actionButtonGray: {
    backgroundColor: '#F3F4F7',
    borderColor: '#DEE0E3',

  },
  actionButtonTextWhite: {
    color: '#3dbac6',
  },
  actionButtonTextGray: {
    color: '#000',
  },
  actionButtonIconGray: {
    color: '#000',
  },
  actionButtonBlue: {
    backgroundColor: '#3dbac6',
  },
  actionButtonTextBlue: {
    color: 'white',
  },
  actionButtonIconBlue: {
    color: 'white',
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  spacer: {
    height: 24,
  },
  actionButtonText: {
    color: 'white',
    marginLeft: 0,
    fontSize: 14,
    textAlign: 'center',
  },
  servicesGrid: {
    marginBottom: 24,
  },
  servicesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: '30%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  serviceCardFull: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  serviceCardHalf: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'right',
  },
  serviceCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  serviceCardText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  serviceCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 4,
  },
  streakCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  streakHeader: {
    alignItems: 'center',
  },
  streakContent: {
    alignItems: 'center',
  },
  streakTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#528FAA',
    marginBottom: 4,
    textAlign: 'center',
  },
  streakWeeks: {
    fontSize: 16,
    color: '#528FAA',
    fontWeight: '600',
    textAlign: 'center',
  },
  motivationBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  motivationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 8,
    textAlign: 'center',
  },
  motivationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  goalsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
    marginLeft: 8,
  },
  goalsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  goalsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black',
    marginTop: 12,
    textAlign: 'center',
  },
  goalsCardDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  goalsButton: {
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  goalsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  investmentsSection: {
    marginBottom: 24,
  },
  investmentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  investmentsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black',
    marginTop: 12,
    textAlign: 'center',
  },
  investmentsCardDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  investmentsButton: {
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  investmentsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  accountSection: {
    marginBottom: 24,
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  accountCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black',
    marginTop: 12,
    textAlign: 'center',
  },
  accountCardDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  dividirSection: { marginBottom: 24 },
  dividirButtonsContainer: { flexDirection: 'row', gap: 12 },
  solicitudesSection: { marginBottom: 24 },
  dividirButton: { backgroundColor: 'white', borderRadius: 12, padding: 16, flex: 1, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  dividirButtonText: { fontSize: 14, fontWeight: '600', color: '#000000', marginTop: 8 },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F7',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#3dbac6',
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  segmentButtonTextActive: {
    color: 'white',
  },
  solicitudCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  solicitudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  solicitudTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  solicitudEstado: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  estadoEnviada: {
    backgroundColor: '#E8F5E8',
    color: '#2E7D32',
  },
  estadoPendiente: {
    backgroundColor: '#FFF8E1',
    color: '#F57C00',
  },
  estadoRechazada: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
  },
  solicitudDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  solicitudFecha: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  solicitudActionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  solicitudActionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#C8E6C9',
  },
  rejectButton: {
    backgroundColor: '#FFCDD2',
  },
  acceptButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dbac6',
    flex: 1,
  },
  detailEstado: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detailDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 12,
  },
  participanteCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  participanteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participanteNombre: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3dbac6',
  },
  participanteEstado: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  participanteTelefono: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  participanteMonto: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  detailSummary: {
    backgroundColor: '#EFF3FE',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  detailTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 4,
  },
  detailFecha: {
    fontSize: 12,
    color: '#666',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Help Modal Styles
  welcomeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
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
    color: '#333',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3dbac6',
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
    color: '#666',
    lineHeight: 20,
    flex: 1,
  },
  // Abono Modal Styles
  abonoOption: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  abonoOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  abonoOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  abonoOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3dbac6',
    marginBottom: 4,
  },
  abonoOptionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  // CLABE Modal Styles
  clabeContainer: {
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 20,
  },
  clabeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  clabeValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  clabeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3dbac6',
    letterSpacing: 1,
    flex: 1,
  },
  copyButton: {
    padding: 8,
    marginLeft: 12,
  },
  clabeInstructions: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    textAlign: 'center',
  },
  // Transfer Modal Styles
  transferOption: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  transferOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transferOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  transferOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3dbac6',
    marginBottom: 4,
  },
  transferOptionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  // Pagar Modal Styles
  pagarInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pagarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  pagarSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  phoneNumberContainer: {
    backgroundColor: '#EFF3FE',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#3dbac6',
    borderStyle: 'dashed',
    marginTop: 24,
    width: '100%',
  },
  phoneNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3dbac6',
    textAlign: 'center',
    letterSpacing: 1,
  },
  // Telefono Modal Styles
  telefonoModalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    padding: 24,
  },
  telefonoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  telefonoModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  telefonoModalContent: {
    alignItems: 'center',
  },
  telefonoIcon: {
    marginBottom: 16,
  },
  telefonoLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 8,
    textAlign: 'center',
  },
  telefonoInstruction: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  otpContainer: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
  },
  otpLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  otpCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3dbac6',
    textAlign: 'center',
    letterSpacing: 4,
    backgroundColor: '#EFF3FE',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#3dbac6',
    borderStyle: 'dashed',
    width: '100%',
    marginBottom: 8,
  },
  otpInstruction: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Service Payment Styles
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  providersList: {
    marginTop: 16,
  },
  providerCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  providerCardSelected: {
    borderColor: '#3dbac6',
    backgroundColor: '#EFF3FE',
  },
  providerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  providerDescription: {
    fontSize: 14,
    color: '#666',
  },
  backButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  accountInput: {
    height: 56,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#333',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  billSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  billLabel: {
    fontSize: 16,
    color: '#666',
  },
  billValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  billAmount: {
    fontSize: 20,
    color: '#3dbac6',
  },
  pinLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  pinInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  pinInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: '#F8F9FA',
  },
  primaryButton: {
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  // CENT ED Styles
  centEdCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  centEdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  centEdTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginLeft: 8,
  },
  centEdContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  centEdText: {
    marginLeft: 12,
    flex: 1,
  },
  centEdCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  centEdCardSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  centEdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  centEdButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginRight: 8,
  },
  // CENT ED Modal Styles
  centEdModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  centEdModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '60%',
  },
  centEdModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  centEdModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  centEdCloseButton: {
    padding: 4,
  },
  centEdModalBody: {
    flex: 1,
    padding: 20,
  },
  centEdCategoriesContainer: {
    gap: 12,
  },
  centEdCategoryCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  centEdCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centEdCategoryHeaderInArticles: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  centEdCategoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  centEdCategoryText: {
    flex: 1,
  },
  centEdCategoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  centEdCategorySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  centEdArticlesContainer: {
    gap: 16,
  },
  centEdBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  centEdBackText: {
    fontSize: 16,
    color: '#3dbac6',
    marginLeft: 8,
    fontWeight: '600',
  },
  centEdArticlesList: {
    gap: 8,
  },
  centEdArticleCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  centEdArticleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  centEdArticleNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginRight: 8,
    minWidth: 20,
  },
  centEdArticleTitle: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  
  // Estilos para modales de transferencia
  transferStep: {
    padding: 20,
    paddingBottom: 30,
  },
  transferStepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputHelp: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#3dbac6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 10,
    shadowColor: '#3dbac6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
    alignItems: 'center',
  },
  submitButtonRow: {
    backgroundColor: '#3dbac6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 52,
    shadowColor: '#3dbac6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.6,
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
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  // Estilos para el comprobante
  comprobanteContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  comprobanteHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  comprobanteTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  comprobanteSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  comprobanteCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '100%',
  },
  comprobanteCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  comprobanteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  comprobanteLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  comprobanteValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  // New styles for goals and investments lists
  goalsList: {
    gap: 12,
  },
  goalItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  goalItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  goalItemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  goalItemProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3dbac6',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3dbac6',
    minWidth: 30,
  },
  investmentsList: {
    gap: 12,
  },
  investmentItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
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
    marginBottom: 8,
  },
  investmentItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  investmentItemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  investmentItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  investmentItemTerm: {
    fontSize: 14,
    color: '#666',
  },
  investmentItemRate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  viewAllButton: {
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  viewAllButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
