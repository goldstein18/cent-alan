import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GoalCard, GoalCardData } from '../components/goals/GoalCard';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

// Usuarios autorizados para crear metas mientras la función está en bloqueo OTA.
// Se compara por los últimos 10 dígitos del teléfono (sin lada/+52).
const GOALS_CREATION_ALLOWLIST: string[] = [];

// Definir interfaz Goal local para compatibilidad
interface Goal {
  id: number;
  name: string;
  category: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  frequency: string;
  paymentType: string;
  type: string;
  createdAt: string;
  progress: number;
  status: string;
  hasRendimientos: boolean;
  rendimientosGenerados: number;
  nextAbonoDate: string;
  isCompleted: boolean;
  isExpired: boolean;
}

export default function Goals() {
  const { addGoal, abonarAMeta, retirarDeMeta, cancelarMeta, calcularRendimientos, availableBalance, goals: contextGoals, reloadData, addDomiciliation } = useData();
  const { user } = useAuth();
  // La creación de metas está bloqueada para todos (modal "Próximamente"),
  // salvo los teléfonos en la allowlist.
  const canCreateGoals = useMemo(() => {
    const digits = (user?.phoneNumber || '').replace(/\D/g, '');
    return GOALS_CREATION_ALLOWLIST.includes(digits.slice(-10));
  }, [user?.phoneNumber]);
  const [selectedFilter, setSelectedFilter] = useState('todas');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  // Bloqueo temporal de creación de metas (OTA)
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [goalType, setGoalType] = useState<'sin-rendimiento' | 'con-rendimiento'>('sin-rendimiento'); // 'sin-rendimiento' o 'con-rendimiento'
  const [goalStep, setGoalStep] = useState(1);
  const [categoryDropdownVisible, setCategoryDropdownVisible] = useState(false);
  const [frequencyDropdownVisible, setFrequencyDropdownVisible] = useState(false);
  
  // Modal de abono a meta
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [amountToAdd, setAmountToAdd] = useState('');
  
  // Modal de gestión de meta
  const [showGoalManagementModal, setShowGoalManagementModal] = useState(false);
  const [managementGoal, setManagementGoal] = useState<any>(null);
  
  // Modales personalizados para retiros
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showWithdrawAmountModal, setShowWithdrawAmountModal] = useState(false);
  const [showWithdrawConfirmModal, setShowWithdrawConfirmModal] = useState(false);
  const [showNipModal, setShowNipModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [nipInput, setNipInput] = useState('');
  
  // Modales personalizados para errores y confirmaciones
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showNipModalForAdd, setShowNipModalForAdd] = useState(false);
  const [showNipModalForCancel, setShowNipModalForCancel] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [nipInputForAdd, setNipInputForAdd] = useState('');
  const [nipInputForCancel, setNipInputForCancel] = useState('');
  const [isLoadingAbono, setIsLoadingAbono] = useState(false);

  // Función de reset específica para botones bloqueados
  const resetBlockedButtons = () => {
    // Solo cerrar modales de gestión que puedan estar bloqueando
    setShowGoalManagementModal(false);
    setShowWithdrawModal(false);
    setShowWithdrawAmountModal(false);
    setShowWithdrawConfirmModal(false);
    setShowNipModal(false);
    setShowCancelConfirmModal(false);
    setShowNipModalForAdd(false);
    setShowNipModalForCancel(false);
    
    // Limpiar solo estados de gestión
    setManagementGoal(null);
    setSelectedGoal(null);
    setWithdrawAmount('');
    setNipInput('');
    setNipInputForAdd('');
    setNipInputForCancel('');
  };

  // Función de reset global definitiva (solo para emergencias)
  const forceResetAllStates = () => {
    // Cerrar TODOS los modales
    setShowAddGoalModal(false);
    setShowHelpModal(false);
    setShowAddMoneyModal(false);
    setShowGoalManagementModal(false);
    setShowWithdrawModal(false);
    setShowWithdrawAmountModal(false);
    setShowWithdrawConfirmModal(false);
    setShowNipModal(false);
    setShowErrorModal(false);
    setShowSuccessModal(false);
    setShowCancelConfirmModal(false);
    setShowNipModalForAdd(false);
    setShowNipModalForCancel(false);
    
    // Limpiar TODAS las variables
    setWithdrawAmount('');
    setNipInput('');
    setAmountToAdd('');
    setNipInputForAdd('');
    setNipInputForCancel('');
    setErrorMessage('');
    setSuccessMessage('');
    
    // Limpiar TODOS los estados de gestión
    setManagementGoal(null);
    setSelectedGoal(null);
    
    // Resetear TODOS los dropdowns
    setDropdownVisible(false);
    setCategoryDropdownVisible(false);
    setFrequencyDropdownVisible(false);
  };

  // Remover reset automático que está bloqueando la pantalla

  const handleAddMoneyToGoal = (goal: any) => {
    setSelectedGoal(goal);
    setAmountToAdd('');
    setShowAddMoneyModal(true);
  };

  const handleConfirmAddMoney = () => {
    if (!amountToAdd || parseFloat(amountToAdd) <= 0) {
      setErrorMessage('Por favor ingresa un monto válido');
      setShowErrorModal(true);
      return;
    }

    const amount = parseFloat(amountToAdd);

    if (amount > (availableBalance ?? 0)) {
      setErrorMessage('No tienes suficiente balance disponible');
      setShowErrorModal(true);
      return;
    }

    if (!selectedGoal) {
      setErrorMessage('No se ha seleccionado una meta');
      setShowErrorModal(true);
      return;
    }

    // Cerrar modal de abono y mostrar modal de NIP
    setShowAddMoneyModal(false);
    setShowNipModalForAdd(true);
  };

  const handleNipConfirmForAdd = async () => {
    if (!nipInputForAdd || nipInputForAdd.length !== 4) {
      setErrorMessage('El NIP debe tener 4 dígitos');
      setShowErrorModal(true);
      return;
    }
    
    if (!selectedGoal) return;
    
    const amount = parseFloat(amountToAdd);
    
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage('El monto debe ser mayor a 0');
      setShowErrorModal(true);
      return;
    }
    
    setIsLoadingAbono(true);
    
    try {
      
      // Abonar a la meta con timeout adicional
      const abonoPromise = abonarAMeta(selectedGoal.id, amount, nipInputForAdd);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('La operación tardó demasiado. Por favor intenta de nuevo.')), 35000)
      );
      
      await Promise.race([abonoPromise, timeoutPromise]);
      
      
      // Cerrar modales y limpiar estados
      setShowNipModalForAdd(false);
      setAmountToAdd('');
      setSelectedGoal(null);
      setNipInputForAdd('');
      
      // Mostrar mensaje de éxito
      setSuccessMessage(`Se agregaron $${amount.toLocaleString()} a la meta "${selectedGoal.name}"`);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error en handleNipConfirmForAdd:', error);
      
      // Cerrar el modal de PIN para que el usuario pueda ver el error claramente
      setShowNipModalForAdd(false);
      const errorMsg = error instanceof Error ? error.message : 'Error al abonar a la meta';
      
      // Si el error es de sesión expirada, limpiar la sesión y redirigir al login
      if (errorMsg.includes('Sesión expirada') || errorMsg.includes('inicia sesión')) {
        const { AuthService } = await import('../services/authService');
        await AuthService.logout();
        // El AuthContext manejará la redirección automáticamente
      }
      
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
      // Limpiar el PIN para que el usuario pueda ingresarlo de nuevo
      setNipInputForAdd('');
    } finally {
      setIsLoadingAbono(false);
    }
  };

  const handleGoalManagement = (goal: any) => {
    
    setManagementGoal(goal);
    setShowGoalManagementModal(true);
  };

  const handleCancelGoal = () => {
    if (!managementGoal) return;
    
    // Cerrar modal de gestión y mostrar modal de confirmación
    setShowGoalManagementModal(false);
    setShowCancelConfirmModal(true);
  };

  const handleCancelConfirm = () => {
    if (!managementGoal) return;
    
    // Cerrar modal de confirmación y mostrar modal de NIP
    setShowCancelConfirmModal(false);
    setShowNipModalForCancel(true);
  };

  const handleNipConfirmForCancel = async () => {
    if (!nipInputForCancel || nipInputForCancel.length !== 4) {
      setErrorMessage('El NIP debe tener 4 dígitos');
      setShowErrorModal(true);
      return;
    }
    
    if (!managementGoal) return;
    
    try {
      const isCompleted = managementGoal.isCompleted;
      const progress = managementGoal.progress || 0;
      const rendimientosGenerados = managementGoal.rendimientosGenerados || 0;
      
      // Cancelar la meta (el backend maneja la comisión y devuelve el mensaje)
      await cancelarMeta(managementGoal.id, nipInputForCancel);
      
      // Usar el mensaje del backend si está disponible, o uno por defecto
      let successMsg = 'La meta ha sido cancelada exitosamente.';
      if (isCompleted && rendimientosGenerados > 0) {
        successMsg = `Meta cancelada exitosamente. Se devolvió tu progreso ($${progress.toLocaleString()}) y tus rendimientos generados ($${rendimientosGenerados.toLocaleString()}).`;
      } else if (isCompleted) {
        successMsg = `Meta cancelada exitosamente. Se devolvió tu progreso ($${progress.toLocaleString()}).`;
      }
      
      setSuccessMessage(successMsg);
      
      // Cerrar modales y limpiar estados
      setShowNipModalForCancel(false);
      setShowGoalManagementModal(false);
      setManagementGoal(null);
      setNipInputForCancel('');
      
      // Recargar datos para actualizar la lista de metas (la meta completada ahora será "vencida")
      await reloadData();
      
      // Mostrar mensaje de éxito
      setShowSuccessModal(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al cancelar la meta');
      setShowErrorModal(true);
    }
  };

  const handleWithdrawFromCompletedGoal = (goal: any) => {
    // Establecer la meta como managementGoal
    setManagementGoal(goal);
    
    // Para metas completadas, al hacer clic en "RETIRAR FONDOS", se cancela la meta
    // y se devuelve el progreso + rendimientos generados
    // Mostrar modal de confirmación de cancelación
    setShowCancelConfirmModal(true);
  };

  const handleWithdrawFunds = () => {
    if (!managementGoal) return;
    
    // LÓGICA: Las metas con rendimientos NO permiten retiros parciales, solo cancelación
    const hasRendimientos = managementGoal.hasRendimientos;
    
    if (hasRendimientos) {
      // Para metas con rendimientos, no permitir retiros, solo cancelación
      Alert.alert(
        'Retiro no disponible',
        'Las metas con rendimientos no permiten retiros parciales. Debes cancelar la meta para retirar los fondos.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    
    // Para metas sin rendimientos, mostrar modal para ingresar monto
    setShowGoalManagementModal(false);
    setTimeout(() => {
      setShowWithdrawAmountModal(true);
    }, 100);
  };

  const handleWithdrawConfirm = () => {
    if (!managementGoal) return;
    
    // Cerrar modal de confirmación y mostrar modal de NIP
    setShowWithdrawModal(false);
    setShowNipModal(true);
  };

  const handleWithdrawAmountConfirm = () => {
    if (!withdrawAmount || isNaN(parseFloat(withdrawAmount))) {
      setErrorMessage('Por favor ingresa un monto válido');
      setShowErrorModal(true);
      return;
    }
    
    const amount = parseFloat(withdrawAmount);
    if (amount <= 0) {
      setErrorMessage('El monto debe ser mayor a 0');
      setShowErrorModal(true);
      return;
    }
    
    if (amount > managementGoal.progress) {
      setErrorMessage('No puedes retirar más de lo que tienes en la meta');
      setShowErrorModal(true);
      return;
    }
    
    // Cerrar modal de monto y mostrar modal de confirmación
    setShowWithdrawAmountModal(false);
    setShowWithdrawConfirmModal(true);
  };

  const handleWithdrawAmountConfirmFinal = () => {
    if (!managementGoal) return;
    
    const amount = parseFloat(withdrawAmount);
    // Cerrar modal de confirmación y mostrar modal de NIP
    setShowWithdrawConfirmModal(false);
    setShowNipModal(true);
  };

  const handleNipConfirm = async () => {
    if (!nipInput || nipInput.length !== 4) {
      setErrorMessage('El NIP debe tener 4 dígitos');
      setShowErrorModal(true);
      return;
    }
    
    if (!managementGoal) return;
    
    try {
      // Determinar el monto a retirar
      const amount = managementGoal.hasRendimientos && managementGoal.rendimientosGenerados > 0 
        ? managementGoal.progress 
        : parseFloat(withdrawAmount);
      
      // Retirar fondos
      await retirarDeMeta(managementGoal.id, amount, nipInput);
      
      // Usar la función de limpieza completa
      handleCloseWithdrawModals();
      
      // Mostrar mensaje de éxito
      setSuccessMessage(`Se retiraron $${amount.toLocaleString()} de la meta`);
      setShowSuccessModal(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al retirar de la meta');
      setShowErrorModal(true);
    }
  };

  const handleCloseWithdrawModals = () => {
    // Solo cerrar modales de retiro, no hacer reset completo
    setShowWithdrawModal(false);
    setShowWithdrawAmountModal(false);
    setShowWithdrawConfirmModal(false);
    setShowNipModal(false);
    setWithdrawAmount('');
    setNipInput('');
    setManagementGoal(null);
    setShowGoalManagementModal(false);
  };

  // Función para resetear completamente todos los estados
  const resetAllStates = () => {
    // Cerrar todos los modales
    setShowAddGoalModal(false);
    setShowHelpModal(false);
    setShowAddMoneyModal(false);
    setShowGoalManagementModal(false);
    setShowWithdrawModal(false);
    setShowWithdrawAmountModal(false);
    setShowWithdrawConfirmModal(false);
    setShowNipModal(false);
    setShowErrorModal(false);
    setShowSuccessModal(false);
    setShowCancelConfirmModal(false);
    setShowNipModalForAdd(false);
    setShowNipModalForCancel(false);
    
    // Limpiar variables temporales
    setWithdrawAmount('');
    setNipInput('');
    setAmountToAdd('');
    setNipInputForAdd('');
    setNipInputForCancel('');
    setErrorMessage('');
    setSuccessMessage('');
    
    // Limpiar estados de gestión
    setManagementGoal(null);
    setSelectedGoal(null);
    
    // Resetear dropdowns
    setDropdownVisible(false);
    setCategoryDropdownVisible(false);
    setFrequencyDropdownVisible(false);
  };
  
  // Form data for new goal
  const [goalData, setGoalData] = useState({
    name: '',
    category: '',
    description: '',
    targetAmount: '',
    deadline: '',
    frequency: '',
    paymentType: 'manual' // 'manual' o 'domiciliar'
  });

  const formatCurrency = (value?: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value ?? 0);

  const [goals, setGoals] = useState<GoalCardData[]>([]);
  useFocusEffect(
    useCallback(() => {
      reloadData();
      const normalizedGoals: GoalCardData[] = (contextGoals || []).map(goal => ({
        id: goal.id,
        name: goal.name,
        category: goal.category ?? 'general',
        description: goal.description,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount ?? goal.progress ?? 0,
        deadline: goal.deadline,
        frequency: goal.frequency ?? 'mensual',
        paymentType: goal.paymentType ?? 'manual',
        progress: goal.progress ?? 0,
        status: goal.status,
        type: goal.type ?? (goal.hasRendimientos ? 'con-rendimiento' : 'sin-rendimiento'),
        hasRendimientos: goal.hasRendimientos,
        rendimientosGenerados: goal.rendimientosGenerados,
        nextAbonoDate: goal.nextAbonoDate,
        montoAPagar: goal.montoAPagar,
        isCompleted: goal.isCompleted,
        isExpired: goal.isExpired,
      }));
      
      // Filtrar duplicados por ID para evitar tarjetas duplicadas
      const uniqueGoals = normalizedGoals.filter((goal, index, self) => 
        index === self.findIndex(g => g.id === goal.id)
      );
      
      setGoals(uniqueGoals);
    }, [reloadData, contextGoals])
  );

  const goalsStats = useMemo(() => {
    const activeCount = goals.filter(goal => !(goal.isCompleted || goal.status === 'completed')).length;
    const completedCount = goals.filter(goal => goal.isCompleted || goal.status === 'completed').length;
    const totalSaved = goals.reduce((sum, goal) => sum + (goal.currentAmount ?? 0), 0);
    const totalReturns = goals.reduce((sum, goal) => sum + (goal.rendimientosGenerados ?? 0), 0);
    return { activeCount, completedCount, totalSaved, totalReturns };
  }, [goals]);

  const categories = [
    { label: 'Ordenar por', value: 'todas' },
    { label: 'Educación', value: 'educacion' },
    { label: 'Vivienda', value: 'vivienda' },
    { label: 'Viajes', value: 'viajes' },
    { label: 'Emergencias', value: 'emergencias' },
    { label: 'General', value: 'general' },
    { label: 'Familia', value: 'familia' },
    { label: 'Regalo', value: 'regalo' },
  ];

  const goalCategories = [
    { label: 'Educación', value: 'educacion' },
    { label: 'Vivienda', value: 'vivienda' },
    { label: 'Viajes', value: 'viajes' },
    { label: 'Emergencias', value: 'emergencias' },
    { label: 'Automóvil', value: 'automovil' },
    { label: 'Salud', value: 'salud' },
    { label: 'Entretenimiento', value: 'entretenimiento' },
    { label: 'General', value: 'general' },
    { label: 'Familia', value: 'familia' },
    { label: 'Regalo', value: 'regalo' },
  ];

  const frequencies = [
    { label: 'Diaria', value: 'diaria' },
    { label: 'Semanal', value: 'semanal' },
    { label: 'Quincenal', value: 'quincenal' },
    { label: 'Mensual', value: 'mensual' },
  ];

  const handleCreateGoal = async () => {
    // Validate required fields
    if (!goalData.name || !goalData.category || !goalData.targetAmount || !goalData.deadline || !goalData.frequency) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    const normalizedDeadline = parseDeadlineInput(goalData.deadline);
    if (!normalizedDeadline) {
      Alert.alert('Error', 'Ingresa una fecha válida en formato DD/MM/AAAA');
      return;
    }

    try {
      // Add to context (llama al backend)
      await addGoal({
        name: goalData.name,
        category: goalData.category,
        description: goalData.description,
        targetAmount: parseFloat(goalData.targetAmount),
        progress: 0,
        deadline: normalizedDeadline,
        frequency: goalData.frequency,
        paymentType: goalData.paymentType,
        type: goalType,
      });
      
      // Show success message
      Alert.alert('Éxito', 'Meta creada exitosamente', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form and close modal
            setGoalData({
              name: '',
              category: '',
              description: '',
              targetAmount: '',
              deadline: '',
              frequency: '',
              paymentType: 'manual'
            });
            setGoalType('sin-rendimiento');
            setGoalStep(1);
            setShowAddGoalModal(false);
          }
        }
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al crear la meta');
    }
  };

  const selectedCategoryLabel = categories.find(cat => cat.value === selectedCategory)?.label || 'Todas las categorías';

  // Filter goals based on selected filters
  const filteredGoals = goals.filter(goal => {
    const matchesFilter = selectedFilter === 'todas' || goal.type === selectedFilter;
    const matchesCategory = selectedCategory === 'todas' || goal.category === selectedCategory;
    return matchesFilter && matchesCategory;
  });

  // Get category icon
  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'educacion': 'school',
      'vivienda': 'home',
      'viajes': 'airplane',
      'emergencias': 'medical',
      'automovil': 'car',
      'salud': 'fitness',
      'entretenimiento': 'game-controller',
      'general': 'ellipsis-horizontal',
      'familia': 'people',
      'regalo': 'gift'
    };
    return icons[category] || 'ellipsis-horizontal';
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'educacion': '#1976D2',
      'vivienda': '#388E3C',
      'viajes': '#FF6F00',
      'emergencias': '#D32F2F',
      'automovil': '#7B1FA2',
      'salud': '#C2185B',
      'entretenimiento': '#FF5722',
      'general': '#607D8B',
      'familia': '#E91E63',
      'regalo': '#9C27B0'
    };
    return colors[category] || '#607D8B';
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return '—';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  // Calculate days remaining
  const getDaysRemaining = (deadline?: string) => {
    if (!deadline) {
      return '—';
    }
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleDeadlineChange = (text: string) => {
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
    
    setGoalData({...goalData, deadline: formatted});
  };

  const parseDeadlineInput = (rawValue: string) => {
    if (!rawValue) {
      return '';
    }

    const digitsOnly = rawValue.replace(/\D/g, '');

    let deadlineDate: Date | null = null;

    if (digitsOnly.length === 8) {
      const day = parseInt(digitsOnly.slice(0, 2), 10);
      const month = parseInt(digitsOnly.slice(2, 4), 10) - 1;
      const year = parseInt(digitsOnly.slice(4), 10);
      deadlineDate = new Date(year, month, day);
    } else {
      const parsed = new Date(rawValue.replace(/-/g, '/'));
      if (!Number.isNaN(parsed.getTime())) {
        deadlineDate = parsed;
      }
    }

    if (!deadlineDate || Number.isNaN(deadlineDate.getTime())) {
      return '';
    }

    return deadlineDate.toISOString().split('T')[0];
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Metas</Text>
        <TouchableOpacity 
          style={styles.helpButton}
          onPress={() => setShowHelpModal(true)}
        >
          <Ionicons name="help-circle" size={24} color="#3dbac6" />
        </TouchableOpacity>
      </View>
      <Text style={styles.description}>
        Establece metas y ahorra estratégicamente para alcanzar tus objetivos financieros.
      </Text>
      
      <View style={styles.spacer} />
      
      {/* Financial Goals Summary Card */}
      <View style={styles.summaryCard}>
        <Ionicons name="time" size={32} color="white" />
        <Text style={styles.summaryTitle}>Tus Metas Financieras</Text>
        <Text style={styles.summarySubtitle}>Cada meta es un paso hacia tu libertad</Text>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Balance disponible</Text>
          <Text style={styles.summaryBalance}>{formatCurrency(availableBalance ?? 0)}</Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.activeGoalsCard]}>
          <View style={styles.statHeader}>
            <Ionicons name="time" size={24} color="#1b3067" />
            <Text style={[styles.statTitle, styles.activeGoalsTitle]}>Metas activas</Text>
          </View>
          <Text style={styles.statValue}>{goalsStats.activeCount}</Text>
        </View>
        <View style={[styles.statCard, styles.completedGoalsCard]}>
          <View style={styles.statHeader}>
            <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
            <Text style={[styles.statTitle, styles.completedGoalsTitle]}>Metas completadas</Text>
          </View>
          <Text style={styles.statValue}>{goalsStats.completedCount}</Text>
        </View>
        <View style={[styles.statCard, styles.savedTotalCard]}>
          <View style={styles.statHeader}>
            <Ionicons name="arrow-up" size={24} color="#6A1B9A" />
            <Text style={[styles.statTitle, styles.savedTotalTitle]}>Total ahorrado</Text>
          </View>
          <Text style={styles.statValue}>{formatCurrency(goalsStats.totalSaved)}</Text>
        </View>
        <View style={[styles.statCard, styles.returnsCard]}>
          <View style={styles.statHeader}>
            <Ionicons name="arrow-down" size={24} color="#F57C00" />
            <Text style={[styles.statTitle, styles.returnsTitle]}>Rendimientos</Text>
          </View>
          <Text style={styles.statValue}>{formatCurrency(goalsStats.totalReturns)}</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.newGoalButton}
        onPress={() => {
          // Creación de metas bloqueada temporalmente (OTA), salvo allowlist
          if (canCreateGoals) {
            setShowAddGoalModal(true);
          } else {
            setShowComingSoonModal(true);
          }
        }}
      >
        <Ionicons name="add-circle" size={20} color="white" />
        <Text style={styles.newGoalButtonText}>Nueva meta</Text>
      </TouchableOpacity>


      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity 
            style={[styles.filterButton, selectedFilter === 'todas' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('todas')}
          >
            <Feather name="target" size={16} color={selectedFilter === 'todas' ? 'white' : '#666'} style={styles.filterIcon} />
            <Text style={[styles.filterButtonText, selectedFilter === 'todas' && styles.filterButtonTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, selectedFilter === 'con-rendimiento' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('con-rendimiento')}
          >
            <Text style={[styles.filterButtonText, selectedFilter === 'con-rendimiento' && styles.filterButtonTextActive]}>
              Con rendimiento
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, selectedFilter === 'sin-rendimiento' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('sin-rendimiento')}
          >
            <Text style={[styles.filterButtonText, selectedFilter === 'sin-rendimiento' && styles.filterButtonTextActive]}>
              Sin rendimiento
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <TouchableOpacity 
        style={styles.dropdownButton}
        onPress={() => setDropdownVisible(true)}
      >
        <Text style={styles.dropdownButtonText}>{selectedCategoryLabel}</Text>
        <Ionicons name="chevron-down" size={20} color="#666" />
      </TouchableOpacity>

      <View style={styles.spacer} />

      {filteredGoals.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Feather name="target" size={48} color="#3dbac6" style={styles.emptyStateIcon} />
          <Text style={styles.emptyStateTitle}>No tienes metas creadas</Text>
          <Text style={styles.emptyStateDescription}>
            Crea metas financieras para ahorrar de manera organizada. Puedes crear metas con o sin rendimientos.
          </Text>
          <TouchableOpacity 
            style={styles.emptyStateButton}
            onPress={() => {
              // Creación bloqueada (OTA) salvo allowlist
              if (!canCreateGoals) {
                setShowComingSoonModal(true);
                return;
              }
              // Reset específico para botones bloqueados
              resetBlockedButtons();

              // Pequeño delay para asegurar que el reset se complete
              setTimeout(() => {
                setShowAddGoalModal(true);
              }, 150);
            }}
          >
            <Ionicons name="add" size={24} color="white" style={styles.emptyStateButtonIcon} />
            <Text style={styles.emptyStateButtonText}>Crear mi primera meta</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.goalsList}>
          {filteredGoals.map((goal, index) => {
            const goalData = goal as unknown as GoalCardData;
            const categoryLabel =
              goalCategories.find(cat => cat.value === goal.category)?.label ?? goal.category;
            const categoryColor = getCategoryColor(goal.category);
            const categoryIcon = getCategoryIcon(goal.category);
            const frequencyLabel =
              frequencies.find(freq => freq.value === goal.frequency)?.label ?? goal.frequency;

            // Usar ID único o índice como fallback para evitar duplicados en React
            const uniqueKey = `${goal.id}-${index}`;

            return (
              <GoalCard
                key={uniqueKey}
                goal={goalData}
                categoryLabel={categoryLabel}
                categoryColor={categoryColor}
                categoryIcon={categoryIcon}
                frequencyLabel={frequencyLabel}
                formatDate={formatDate}
                getDaysRemaining={getDaysRemaining}
                onAdd={() => handleAddMoneyToGoal(goal)}
                onManage={() => handleGoalManagement(goal)}
                onWithdraw={goal.isCompleted ? () => handleWithdrawFromCompletedGoal(goal) : undefined}
              />
            );
          })}
        </View>
      )}

      <Modal
        visible={dropdownVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={styles.dropdownList}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.value}
                style={[
                  styles.dropdownItem,
                  selectedCategory === category.value && styles.dropdownItemSelected
                ]}
                onPress={() => {
                  setSelectedCategory(category.value);
                  setDropdownVisible(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedCategory === category.value && styles.dropdownItemTextSelected
                ]}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.helpModalOverlay}>
          <View style={styles.helpModalContent}>
            <View style={styles.helpModalHeader}>
              <Text style={styles.helpModalTitle}>Información de Metas</Text>
              <TouchableOpacity 
                style={styles.helpCloseButton}
                onPress={() => setShowHelpModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.helpModalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>¿Qué es?</Text>
                <Text style={styles.helpText}>
                  Es una herramienta para organizar tu dinero y ahorrar de forma estratégica. Te permite definir objetivos (viajes, emergencias, compras, etc.) y separar tus ahorros por meta.
                </Text>
              </View>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>Cómo usar</Text>
                <View style={styles.stepList}>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.stepText}>Entra a la sección Metas.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.stepText}>Toca Nueva meta.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.stepText}>Define nombre, monto objetivo y plazo.</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>4</Text>
                    </View>
                    <Text style={styles.stepText}>Selecciona meta con o sin rendimientos</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>5</Text>
                    </View>
                    <Text style={styles.stepText}>Abona dinero a tu meta y sigue tu progreso en la app.</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Goal Modal */}
      <Modal
        visible={showAddGoalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddGoalModal(false)}
      >
        <View style={styles.addGoalModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.addGoalKeyboardAvoidingView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={styles.addGoalModalContent}>
              <View style={styles.addGoalModalHeader}>
                <Text style={styles.addGoalModalTitle}>Crear nueva meta</Text>
                <TouchableOpacity 
                  style={styles.addGoalCloseButton}
                  onPress={() => setShowAddGoalModal(false)}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                style={styles.addGoalModalBody} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.addGoalModalScrollContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
              {/* Step 1: Goal Type Selection */}
              {goalStep === 1 && (
                <View style={styles.goalTypeSection}>
                  <Text style={styles.sectionTitle}>Tipo de meta</Text>
                  <Text style={styles.sectionDescription}>
                    Selecciona el tipo de meta que quieres crear
                  </Text>
                  
                  <TouchableOpacity 
                    style={[
                      styles.goalTypeCard,
                      goalType === 'sin-rendimiento' && styles.goalTypeCardSelected
                    ]}
                    onPress={() => setGoalType('sin-rendimiento')}
                  >
                    <View style={styles.goalTypeHeader}>
                      <Ionicons 
                        name="wallet" 
                        size={24} 
                        color={goalType === 'sin-rendimiento' ? '#3dbac6' : '#666'} 
                      />
                      <Text style={[
                        styles.goalTypeTitle,
                        goalType === 'sin-rendimiento' && styles.goalTypeTitleSelected
                      ]}>
                        Sin rendimiento
                      </Text>
                    </View>
                    <Text style={styles.goalTypeDescription}>
                      Ahorra tu dinero de forma segura sin generar intereses
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.goalTypeCard,
                      goalType === 'con-rendimiento' && styles.goalTypeCardSelected
                    ]}
                    onPress={() => setGoalType('con-rendimiento')}
                  >
                    <View style={styles.goalTypeHeader}>
                      <Ionicons 
                        name="trending-up" 
                        size={24} 
                        color={goalType === 'con-rendimiento' ? '#3dbac6' : '#666'} 
                      />
                      <Text style={[
                        styles.goalTypeTitle,
                        goalType === 'con-rendimiento' && styles.goalTypeTitleSelected
                      ]}>
                        Con rendimiento
                      </Text>
                    </View>
                    <Text style={styles.goalTypeDescription}>
                      Tu dinero genera intereses mientras ahorras
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.nextButton}
                    onPress={() => setGoalStep(2)}
                  >
                    <Text style={styles.nextButtonText}>Continuar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 2: Goal Details */}
              {goalStep === 2 && (
                <View style={styles.goalDetailsSection}>
                  <Text style={styles.sectionTitle}>Detalles de la meta</Text>
                  <Text style={styles.sectionDescription}>
                    Completa la información de tu meta
                  </Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nombre de la meta *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={goalData.name}
                      onChangeText={(text) => setGoalData({...goalData, name: text})}
                      placeholder="Ej: Viaje a Europa"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Categoría *</Text>
                    <TouchableOpacity 
                      style={styles.dropdownInput}
                      onPress={() => setCategoryDropdownVisible(true)}
                    >
                      <Text style={goalData.category ? styles.dropdownInputText : styles.dropdownInputPlaceholder}>
                        {goalData.category ? goalCategories.find(cat => cat.value === goalData.category)?.label : 'Seleccionar categoría'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Descripción (opcional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={goalData.description}
                      onChangeText={(text) => setGoalData({...goalData, description: text})}
                      placeholder="Describe tu meta..."
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Monto objetivo (MXN) *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={goalData.targetAmount}
                      onChangeText={(text) => setGoalData({...goalData, targetAmount: text})}
                      placeholder="Ej: 50000"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fecha límite *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={goalData.deadline}
                      onChangeText={handleDeadlineChange}
                      placeholder="DD/MM/AAAA"
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => setGoalStep(1)}
                    >
                      <Text style={styles.backButtonText}>Regresar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.nextButton}
                      onPress={() => setGoalStep(3)}
                    >
                      <Text style={styles.nextButtonText}>Continuar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Step 3: Payment Settings */}
              {goalStep === 3 && (
                <View style={styles.paymentSettingsSection}>
                  <Text style={styles.sectionTitle}>Configuración de pagos</Text>
                  <Text style={styles.sectionDescription}>
                    Define cómo quieres abonar a tu meta
                  </Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Frecuencia de abono recomendada *</Text>
                    <TouchableOpacity 
                      style={styles.dropdownInput}
                      onPress={() => setFrequencyDropdownVisible(true)}
                    >
                      <Text style={goalData.frequency ? styles.dropdownInputText : styles.dropdownInputPlaceholder}>
                        {goalData.frequency ? frequencies.find(freq => freq.value === goalData.frequency)?.label : 'Seleccionar frecuencia'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Tipo de abono *</Text>
                    <View style={styles.paymentTypeContainer}>
                      <TouchableOpacity 
                        style={[
                          styles.paymentTypeButton,
                          goalData.paymentType === 'manual' && styles.paymentTypeButtonSelected
                        ]}
                        onPress={() => setGoalData({...goalData, paymentType: 'manual'})}
                      >
                        <Ionicons 
                          name="hand-left" 
                          size={20} 
                          color={goalData.paymentType === 'manual' ? '#3dbac6' : '#666'} 
                        />
                        <Text style={[
                          styles.paymentTypeText,
                          goalData.paymentType === 'manual' && styles.paymentTypeTextSelected
                        ]}>
                          Manual
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[
                          styles.paymentTypeButton,
                          goalData.paymentType === 'domiciliar' && styles.paymentTypeButtonSelected
                        ]}
                        onPress={() => setGoalData({...goalData, paymentType: 'domiciliar'})}
                      >
                        <Ionicons 
                          name="card" 
                          size={20} 
                          color={goalData.paymentType === 'domiciliar' ? '#3dbac6' : '#666'} 
                        />
                        <Text style={[
                          styles.paymentTypeText,
                          goalData.paymentType === 'domiciliar' && styles.paymentTypeTextSelected
                        ]}>
                          Domiciliar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => setGoalStep(2)}
                    >
                      <Text style={styles.backButtonText}>Regresar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.createButton}
                      onPress={handleCreateGoal}
                    >
                      <Text style={styles.createButtonText}>Crear meta</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {/* Espacio adicional al final para que los campos inferiores sean accesibles cuando aparece el teclado */}
              <View style={{ height: 100 }} />
            </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>

        {/* Category Dropdown Modal */}
        <Modal
          visible={categoryDropdownVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setCategoryDropdownVisible(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => setCategoryDropdownVisible(false)}
          >
            <View style={styles.dropdownList}>
              {goalCategories.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.dropdownItem,
                    goalData.category === category.value && styles.dropdownItemSelected
                  ]}
                  onPress={() => {
                    setGoalData({...goalData, category: category.value});
                    setCategoryDropdownVisible(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    goalData.category === category.value && styles.dropdownItemTextSelected
                  ]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Frequency Dropdown Modal */}
        <Modal
          visible={frequencyDropdownVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setFrequencyDropdownVisible(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => setFrequencyDropdownVisible(false)}
          >
            <View style={styles.dropdownList}>
              {frequencies.map((frequency) => (
                <TouchableOpacity
                  key={frequency.value}
                  style={[
                    styles.dropdownItem,
                    goalData.frequency === frequency.value && styles.dropdownItemSelected
                  ]}
                  onPress={() => {
                    setGoalData({...goalData, frequency: frequency.value});
                    setFrequencyDropdownVisible(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    goalData.frequency === frequency.value && styles.dropdownItemTextSelected
                  ]}>
                    {frequency.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      </Modal>

      {/* Modal de Abono a Meta */}
      <Modal
        visible={showAddMoneyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddMoneyModal(false)}
      >
        <View style={styles.addMoneyModalOverlay}>
          <View style={styles.addMoneyModalContent}>
            <View style={styles.addMoneyModalHeader}>
              <Text style={styles.addMoneyModalTitle}>Abonar a meta</Text>
              <TouchableOpacity 
                style={styles.addMoneyCloseButton}
                onPress={() => setShowAddMoneyModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.addMoneyModalBody}>
              {selectedGoal && (
                <>
                  <View style={styles.selectedGoalInfo}>
                    <Text style={styles.selectedGoalName}>{selectedGoal.name}</Text>
                    <Text style={styles.selectedGoalTarget}>
                      Meta: ${selectedGoal.targetAmount.toLocaleString()}
                    </Text>
                    <Text style={styles.selectedGoalCurrent}>
                      Actual: ${selectedGoal.currentAmount.toLocaleString()}
                    </Text>
                    <Text style={styles.selectedGoalRemaining}>
                      Faltante: ${(selectedGoal.targetAmount - selectedGoal.currentAmount).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.amountInputSection}>
                    <Text style={styles.amountLabel}>Monto a abonar</Text>
                    <View style={styles.amountInputContainer}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.amountInput}
                        value={amountToAdd}
                        onChangeText={setAmountToAdd}
                        placeholder="0.00"
                        keyboardType="numeric"
                        placeholderTextColor="#999"
                      />
                    </View>
                    <Text style={styles.balanceInfo}>
                      Balance disponible: {formatCurrency(availableBalance)}
                    </Text>
                  </View>

                  <View style={styles.addMoneyModalActions}>
                    <TouchableOpacity 
                      style={styles.cancelButton}
                      onPress={() => setShowAddMoneyModal(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.confirmButton}
                      onPress={handleConfirmAddMoney}
                    >
                      <Text style={styles.confirmButtonText}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Gestión de Meta */}
      <Modal
        visible={showGoalManagementModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGoalManagementModal(false)}
      >
        <View style={styles.goalManagementModalOverlay}>
          <View style={styles.goalManagementModalContent}>
            <View style={styles.goalManagementModalHeader}>
              <Text style={styles.goalManagementModalTitle}>Gestionar Meta</Text>
              <TouchableOpacity 
                style={styles.goalManagementCloseButton}
                onPress={() => setShowGoalManagementModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.goalManagementModalBody}>
              {managementGoal && (
                <>
                  <View style={styles.goalManagementInfo}>
                    <Text style={styles.goalManagementName}>{managementGoal.name}</Text>
                    <Text style={styles.goalManagementDescription}>{managementGoal.description}</Text>
                  </View>

                  <View style={styles.goalManagementActions}>
                    {/* Solo mostrar botón de retirar fondos si NO tiene rendimientos */}
                    {!managementGoal.hasRendimientos && (
                      <TouchableOpacity 
                        style={styles.withdrawButton}
                        onPress={handleWithdrawFunds}
                      >
                        <Ionicons name="cash-outline" size={24} color="#ff6b35" />
                        <View style={styles.withdrawButtonText}>
                          <Text style={styles.withdrawButtonTitle}>Retirar Fondos</Text>
                          <Text style={styles.withdrawButtonSubtitle}>
                            Retirar ${managementGoal.currentAmount.toLocaleString()} a tu balance
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity 
                      style={styles.cancelGoalButton}
                      onPress={handleCancelGoal}
                    >
                      <Ionicons name="trash-outline" size={24} color="#f44336" />
                      <View style={styles.cancelGoalButtonText}>
                        <Text style={styles.cancelGoalButtonTitle}>Cancelar Meta</Text>
                        <Text style={styles.cancelGoalButtonSubtitle}>
                          Cancelar esta meta permanentemente
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmación de Retiro (para metas con rendimientos) */}
      <Modal
        visible={showWithdrawModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseWithdrawModals}
      >
        <View style={styles.withdrawModalOverlay}>
          <View style={styles.withdrawModalContent}>
            <View style={styles.withdrawModalHeader}>
              <Text style={styles.withdrawModalTitle}>Retirar Fondos</Text>
              <TouchableOpacity 
                style={styles.withdrawCloseButton}
                onPress={handleCloseWithdrawModals}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.withdrawModalBody}>
              <Text style={styles.withdrawModalMessage}>
                ¿Quieres retirar los ${managementGoal?.progress.toLocaleString()} asignados a la meta "{managementGoal?.name}"? Se perderán los rendimientos generados (${managementGoal?.rendimientosGenerados.toFixed(2)}).
              </Text>
              
              <View style={styles.withdrawModalActions}>
                <TouchableOpacity 
                  style={styles.withdrawCancelButton}
                  onPress={handleCloseWithdrawModals}
                >
                  <Text style={styles.withdrawCancelButtonText}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.withdrawConfirmButton}
                  onPress={handleWithdrawConfirm}
                >
                  <Text style={styles.withdrawConfirmButtonText}>Sí, retirar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Monto de Retiro (para metas sin rendimientos) */}
      <Modal
        visible={showWithdrawAmountModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseWithdrawModals}
      >
        <View style={styles.withdrawModalOverlay}>
          <View style={styles.withdrawModalContent}>
            <View style={styles.withdrawModalHeader}>
              <Text style={styles.withdrawModalTitle}>Retirar Fondos</Text>
              <TouchableOpacity 
                style={styles.withdrawCloseButton}
                onPress={handleCloseWithdrawModals}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.withdrawModalBody}>
              <Text style={styles.withdrawModalMessage}>
                ¿Cuánto quieres retirar de la meta "{managementGoal?.name}"?
              </Text>
              
              <Text style={styles.withdrawAvailableAmount}>
                Fondos disponibles: ${managementGoal?.progress.toLocaleString()}
              </Text>
              
              <View style={styles.withdrawAmountInputSection}>
                <Text style={styles.withdrawAmountLabel}>Monto a retirar</Text>
                <View style={styles.withdrawAmountInputContainer}>
                  <Text style={styles.withdrawCurrencySymbol}>$</Text>
                  <TextInput
                    style={styles.withdrawAmountInput}
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
              
              <View style={styles.withdrawModalActions}>
                <TouchableOpacity 
                  style={styles.withdrawCancelButton}
                  onPress={handleCloseWithdrawModals}
                >
                  <Text style={styles.withdrawCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.withdrawConfirmButton}
                  onPress={handleWithdrawAmountConfirm}
                >
                  <Text style={styles.withdrawConfirmButtonText}>Retirar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmación de Monto */}
      <Modal
        visible={showWithdrawConfirmModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseWithdrawModals}
      >
        <View style={styles.withdrawModalOverlay}>
          <View style={styles.withdrawModalContent}>
            <View style={styles.withdrawModalHeader}>
              <Text style={styles.withdrawModalTitle}>Confirmar Retiro</Text>
              <TouchableOpacity 
                style={styles.withdrawCloseButton}
                onPress={handleCloseWithdrawModals}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.withdrawModalBody}>
              <Text style={styles.withdrawModalMessage}>
                ¿Confirmas el retiro de ${parseFloat(withdrawAmount || '0').toLocaleString()}?
              </Text>
              
              <View style={styles.withdrawModalActions}>
                <TouchableOpacity 
                  style={styles.withdrawCancelButton}
                  onPress={handleCloseWithdrawModals}
                >
                  <Text style={styles.withdrawCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.withdrawConfirmButton}
                  onPress={handleWithdrawAmountConfirmFinal}
                >
                  <Text style={styles.withdrawConfirmButtonText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de NIP */}
      <Modal
        visible={showNipModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseWithdrawModals}
      >
        <View style={styles.withdrawModalOverlay}>
          <View style={styles.withdrawModalContent}>
            <View style={styles.withdrawModalHeader}>
              <Text style={styles.withdrawModalTitle}>Ingresa tu NIP</Text>
              <TouchableOpacity 
                style={styles.withdrawCloseButton}
                onPress={handleCloseWithdrawModals}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.withdrawModalBody}>
              <Text style={styles.withdrawModalMessage}>
                Ingresa tu NIP para confirmar el retiro:
              </Text>
              
              <View style={styles.withdrawNipInputSection}>
                <TextInput
                  style={styles.withdrawNipInput}
                  value={nipInput}
                  onChangeText={setNipInput}
                  placeholder="••••"
                  keyboardType="numeric"
                  secureTextEntry={true}
                  maxLength={4}
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.withdrawModalActions}>
                <TouchableOpacity 
                  style={styles.withdrawCancelButton}
                  onPress={handleCloseWithdrawModals}
                >
                  <Text style={styles.withdrawCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.withdrawConfirmButton}
                  onPress={handleNipConfirm}
                >
                  <Text style={styles.withdrawConfirmButtonText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Error */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.withdrawModalOverlay}>
          <View style={styles.withdrawModalContent}>
            <View style={styles.withdrawModalHeader}>
              <Text style={styles.withdrawModalTitle}>Error</Text>
              <TouchableOpacity 
                style={styles.withdrawCloseButton}
                onPress={() => setShowErrorModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.withdrawModalBody}>
              <Text style={styles.withdrawModalMessage}>{errorMessage}</Text>
              
              <View style={styles.withdrawModalActions}>
                <TouchableOpacity 
                  style={[styles.withdrawCancelButton, { flex: 1 }]}
                  onPress={() => setShowErrorModal(false)}
                >
                  <Text style={styles.withdrawCancelButtonText}>Entendido</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: creación de metas próximamente (bloqueo OTA) */}
      <Modal
        visible={showComingSoonModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowComingSoonModal(false)}
      >
        <View style={styles.withdrawModalOverlay}>
          <View style={styles.withdrawModalContent}>
            <View style={styles.withdrawModalHeader}>
              <Text style={styles.withdrawModalTitle}>Próximamente</Text>
              <TouchableOpacity
                style={styles.withdrawCloseButton}
                onPress={() => setShowComingSoonModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.withdrawModalBody}>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="time-outline" size={48} color="#3dbac6" />
              </View>
              <Text style={styles.withdrawModalMessage}>
                La creación de metas estará disponible próximamente. Estamos trabajando para mejorar esta función.
              </Text>

              <View style={styles.withdrawModalActions}>
                <TouchableOpacity
                  style={[styles.withdrawConfirmButton, { flex: 1 }]}
                  onPress={() => setShowComingSoonModal(false)}
                >
                  <Text style={styles.withdrawConfirmButtonText}>Entendido</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Éxito */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.withdrawModalOverlay}>
          <View style={styles.withdrawModalContent}>
            <View style={styles.withdrawModalHeader}>
              <Text style={styles.withdrawModalTitle}>Éxito</Text>
              <TouchableOpacity 
                style={styles.withdrawCloseButton}
                onPress={() => setShowSuccessModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.withdrawModalBody}>
              <Text style={styles.withdrawModalMessage}>{successMessage}</Text>
              
              <View style={styles.withdrawModalActions}>
                <TouchableOpacity 
                  style={[styles.withdrawConfirmButton, { flex: 1 }]}
                  onPress={() => setShowSuccessModal(false)}
                >
                  <Text style={styles.withdrawConfirmButtonText}>Entendido</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmación de Cancelación */}
      <Modal
        visible={showCancelConfirmModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCancelConfirmModal(false)}
      >
        <View style={styles.withdrawModalOverlay}>
          <View style={styles.withdrawModalContent}>
            <View style={styles.withdrawModalHeader}>
              <Text style={styles.withdrawModalTitle}>Cancelar Meta</Text>
              <TouchableOpacity 
                style={styles.withdrawCloseButton}
                onPress={() => setShowCancelConfirmModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.withdrawModalBody}>
              <Text style={styles.withdrawModalMessage}>
                {managementGoal?.hasRendimientos && managementGoal?.rendimientosGenerados > 0 
                  ? `¿Estás seguro de que quieres cancelar la meta "${managementGoal?.name}"? Se aplicará una comisión de $6 pesos y se perderán los rendimientos generados ($${managementGoal?.rendimientosGenerados.toFixed(2)}).`
                  : `¿Estás seguro de que quieres cancelar la meta "${managementGoal?.name}"? Esta acción no se puede deshacer.`
                }
              </Text>
              
              <View style={styles.withdrawModalActions}>
                <TouchableOpacity 
                  style={styles.withdrawCancelButton}
                  onPress={() => setShowCancelConfirmModal(false)}
                >
                  <Text style={styles.withdrawCancelButtonText}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.withdrawConfirmButton}
                  onPress={handleCancelConfirm}
                >
                  <Text style={styles.withdrawConfirmButtonText}>Sí, cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de NIP para Abonar */}
      <Modal
        visible={showNipModalForAdd}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNipModalForAdd(false)}
      >
        <View style={styles.withdrawModalOverlay}>
          <View style={styles.withdrawModalContent}>
            <View style={styles.withdrawModalHeader}>
              <Text style={styles.withdrawModalTitle}>Confirmar Abono</Text>
              <TouchableOpacity 
                style={styles.withdrawCloseButton}
                onPress={() => setShowNipModalForAdd(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.withdrawModalBody}>
              <Text style={styles.withdrawModalMessage}>
                Ingresa tu NIP para confirmar el abono:
              </Text>
              
              <View style={styles.withdrawNipInputSection}>
                <TextInput
                  style={styles.withdrawNipInput}
                  value={nipInputForAdd}
                  onChangeText={setNipInputForAdd}
                  placeholder="••••"
                  keyboardType="numeric"
                  secureTextEntry={true}
                  maxLength={4}
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.withdrawModalActions}>
                <TouchableOpacity 
                  style={styles.withdrawCancelButton}
                  onPress={() => setShowNipModalForAdd(false)}
                >
                  <Text style={styles.withdrawCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.withdrawConfirmButton, isLoadingAbono && styles.withdrawConfirmButtonDisabled]}
                  onPress={handleNipConfirmForAdd}
                  disabled={isLoadingAbono}
                >
                  <Text style={styles.withdrawConfirmButtonText}>
                    {isLoadingAbono ? 'Procesando...' : 'Confirmar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de NIP para Cancelar */}
      <Modal
        visible={showNipModalForCancel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNipModalForCancel(false)}
      >
        <View style={styles.withdrawModalOverlay}>
          <View style={styles.withdrawModalContent}>
            <View style={styles.withdrawModalHeader}>
              <Text style={styles.withdrawModalTitle}>Confirmar Cancelación</Text>
              <TouchableOpacity 
                style={styles.withdrawCloseButton}
                onPress={() => setShowNipModalForCancel(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.withdrawModalBody}>
              <Text style={styles.withdrawModalMessage}>
                Ingresa tu NIP para confirmar la cancelación:
              </Text>
              
              <View style={styles.withdrawNipInputSection}>
                <TextInput
                  style={styles.withdrawNipInput}
                  value={nipInputForCancel}
                  onChangeText={setNipInputForCancel}
                  placeholder="••••"
                  keyboardType="numeric"
                  secureTextEntry={true}
                  maxLength={4}
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.withdrawModalActions}>
                <TouchableOpacity 
                  style={styles.withdrawCancelButton}
                  onPress={() => setShowNipModalForCancel(false)}
                >
                  <Text style={styles.withdrawCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.withdrawConfirmButton}
                  onPress={handleNipConfirmForCancel}
                >
                  <Text style={styles.withdrawConfirmButtonText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  helpButton: {
    padding: 4,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginTop: 8,
  },
  spacer: {
    height: 24,
  },
  newGoalButton: {
    backgroundColor: '#3dbac6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  newGoalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  filterContainer: {
    marginBottom: 24,
  },
  filterScrollContent: {
    paddingRight: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E5E5',
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#3dbac6',
  },
  filterButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  dropdownButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownList: {
    backgroundColor: 'white',
    borderRadius: 8,
    width: '80%',
    maxHeight: '60%',
    padding: 8,
  },
  dropdownItem: {
    padding: 16,
    borderRadius: 8,
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
    fontWeight: '500',
  },
  filterIcon: {
    marginRight: 4,
  },
  emptyStateCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginTop: 24,
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
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyStateButton: {
    backgroundColor: '#3dbac6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyStateButtonIcon: {
    marginRight: 4,
  },
  summaryCard: {
    backgroundColor: '#528FAA',
    borderRadius: 20,
    padding: 28,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  summarySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  summaryBalance: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '48%',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  balanceContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
    width: '90%',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  activeGoalsCard: {
    backgroundColor: '#E3F2FD',
  },
  completedGoalsCard: {
    backgroundColor: '#E8F5E8',
  },
  savedTotalCard: {
    backgroundColor: '#F3E5F5',
  },
  returnsCard: {
    backgroundColor: '#FFF8E1',
  },
  activeGoalsTitle: {
    color: '#1976D2',
  },
  completedGoalsTitle: {
    color: '#2E7D32',
  },
  savedTotalTitle: {
    color: '#6A1B9A',
  },
  returnsTitle: {
    color: '#F57C00',
  },
  // Help Modal Styles
  helpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  helpModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  helpModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  helpModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  helpCloseButton: {
    padding: 4,
  },
  helpModalBody: {
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
  // Add Goal Modal Styles
  addGoalModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addGoalKeyboardAvoidingView: {
    width: '100%',
    maxWidth: 500,
  },
  addGoalModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addGoalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  addGoalModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addGoalCloseButton: {
    padding: 4,
  },
  addGoalModalBody: {
    flexGrow: 1,
  },
  addGoalModalScrollContent: {
    padding: 20,
    paddingBottom: 100, // Más padding al final para asegurar que los campos inferiores sean accesibles
    flexGrow: 1,
  },
  goalTypeSection: {
    marginBottom: 20,
  },
  goalDetailsSection: {
    marginBottom: 20,
  },
  paymentSettingsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  goalTypeCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalTypeCardSelected: {
    borderColor: '#3dbac6',
    backgroundColor: '#EFF3FE',
  },
  goalTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginLeft: 12,
  },
  goalTypeTitleSelected: {
    color: '#3dbac6',
  },
  goalTypeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  },
  dropdownInputText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownInputPlaceholder: {
    fontSize: 16,
    color: '#999',
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#666',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Goal Card Styles
  goalsList: {
    gap: 16,
  },
  goalCard: {
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
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  goalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goalInfo: {
    flex: 1,
  },
  goalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  goalCategory: {
    fontSize: 14,
    color: '#666',
  },
  goalHeaderRight: {
    alignItems: 'flex-end',
  },
  goalTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  rendimientoBadge: {
    backgroundColor: '#4CAF50',
  },
  sinRendimientoBadge: {
    backgroundColor: '#FF9800',
  },
  goalTypeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  rendimientosBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  rendimientosText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  goalDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3dbac6',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  amountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  targetAmount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  goalDetails: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  goalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#EFF3FE',
    borderWidth: 1,
    borderColor: '#3dbac6',
  },
  actionButtonText: {
    color: '#3dbac6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryAction: {
    backgroundColor: 'white',
    borderColor: '#E0E0E0',
  },
  secondaryActionText: {
    color: '#666',
  },
  // Add Money Modal Styles
  addMoneyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addMoneyModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addMoneyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  addMoneyModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addMoneyCloseButton: {
    padding: 4,
  },
  addMoneyModalBody: {
    padding: 20,
  },
  selectedGoalInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  selectedGoalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  selectedGoalTarget: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  selectedGoalCurrent: {
    fontSize: 14,
    color: '#3dbac6',
    marginBottom: 4,
  },
  selectedGoalRemaining: {
    fontSize: 14,
    color: '#ff6b35',
    fontWeight: '600',
  },
  amountInputSection: {
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  balanceInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  addMoneyModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    letterSpacing: 0.2,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#3dbac6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.3,
  },
  // Goal Management Modal Styles
  goalManagementModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  goalManagementModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  goalManagementModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  goalManagementModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  goalManagementCloseButton: {
    padding: 4,
  },
  goalManagementModalBody: {
    padding: 20,
  },
  goalManagementInfo: {
    marginBottom: 24,
  },
  goalManagementName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  goalManagementDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  goalManagementStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalManagementStat: {
    alignItems: 'center',
  },
  goalManagementStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  goalManagementStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  goalManagementActions: {
    gap: 12,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ff6b35',
  },
  withdrawButtonText: {
    marginLeft: 12,
    flex: 1,
  },
  withdrawButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b35',
    marginBottom: 4,
  },
  withdrawButtonSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  cancelGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  cancelGoalButtonText: {
    marginLeft: 12,
    flex: 1,
  },
  cancelGoalButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f44336',
    marginBottom: 4,
  },
  cancelGoalButtonSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  // Withdraw Modal Styles
  withdrawModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  withdrawModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  withdrawModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  withdrawModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  withdrawCloseButton: {
    padding: 4,
  },
  withdrawModalBody: {
    padding: 20,
  },
  withdrawModalMessage: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 20,
  },
  withdrawAvailableAmount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  withdrawAmountInputSection: {
    marginBottom: 20,
  },
  withdrawAmountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  withdrawAmountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
  },
  withdrawCurrencySymbol: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  withdrawAmountInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  withdrawNipInputSection: {
    marginBottom: 20,
  },
  withdrawNipInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
    backgroundColor: '#F8F9FA',
  },
  withdrawModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  withdrawCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  withdrawCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  withdrawConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#3dbac6',
    alignItems: 'center',
  },
  withdrawConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  withdrawConfirmButtonDisabled: {
    opacity: 0.6,
  },
}); 