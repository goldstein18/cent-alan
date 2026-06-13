import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { BeneficiariesService, BeneficiaryModel } from '../services/beneficiariesService';
import { AuthService } from '../services/authService';

export default function More() {
  const { user, logout, isLoggedIn } = useAuth();
  const [showContact, setShowContact] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showChangePIN, setShowChangePIN] = useState(false);
  const [showAddBeneficiary, setShowAddBeneficiary] = useState(false);
  const [showReferralInfo, setShowReferralInfo] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralLink, setReferralLink] = useState<string>('');
  const [isLoadingReferral, setIsLoadingReferral] = useState(false);
  
  // PIN change state
  const [newPIN, setNewPIN] = useState(['', '', '', '']);
  const [confirmNewPIN, setConfirmNewPIN] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [isChangingPIN, setIsChangingPIN] = useState(false);
  const newPINRefs = useRef<(TextInput | null)[]>([null, null, null, null]);
  const confirmPINRefs = useRef<(TextInput | null)[]>([null, null, null, null]);
  
  // Beneficiary state
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [beneficiaryError, setBeneficiaryError] = useState('');
  const [beneficiaryEmail, setBeneficiaryEmail] = useState('');
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryModel[]>([]);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = useState(false);
  const [beneficiariesError, setBeneficiariesError] = useState('');

  const faqData = [
    {
      question: "¿Qué es Cent?",
      answer: "Cent es una app financiera mexicana que te ayuda a ahorrar, invertir, pagar servicios y protegerte con seguros, todo desde un mismo lugar. Convierte tus pequeños gastos en grandes ahorros sin que te des cuenta."
    },
    {
      question: "¿Mi dinero está seguro en Cent?",
      answer: "Sí. El dinero que inviertes se canaliza a instrumentos seguros como CETES, y las operaciones están respaldadas por contratos claros. Además, contamos con asesoría legal externa que garantiza que operamos dentro del marco legal vigente."
    },
    {
      question: "¿Dónde puedo abonar dinero a mi cuenta Cent?",
      answer: "En cualquier sucursal afiliada (tiendas, cafés, farmacias, etc.). Solo proporcionas tu número de teléfono y el monto que deseas abonar. No necesitas una cuenta bancaria para usar Cent."
    },
    {
      question: "¿Puedo retirar mi dinero en cualquier momento?",
      answer: "Depende del tipo de ahorro o inversión que hayas escogido. Tu saldo disponible sí puede retirarse en cualquier momento, mientras que las metas o inversiones con rendimiento estarán disponibles al finalizar el plazo acordado (o antes, con posible penalización)."
    },
    {
      question: "¿Cent cobra comisiones?",
      answer: "No hay comisión por usar la app. Las inversiones con rendimiento pueden tener una comisión por retiro anticipado. Puedes comenzar a ahorrar o invertir desde $1 peso."
    },
    {
      question: "¿Qué incluye el seguro de $100 pesos?",
      answer: "El seguro incluye:\n• Gastos funerarios por hasta $50,000 MXN\n• Gastos médicos por accidente por hasta $50,000 MXN\n• Videollamadas médicas de emergencia 24/7\n• Tarjeta de descuentos en farmacias y servicios de laboratorio\n\nEs un producto exclusivo de Cent, respaldado por la aseguradora THONA."
    },
    {
      question: "¿Cómo contacto al equipo de Cent?",
      answer: "Desde la app o a través de nuestro asistente virtual Vicente. También puedes escribirnos por WhatsApp o en nuestras redes sociales: Vicente está diseñado para ayudarte con todo lo que necesites de manera rápida y sencilla."
    }
  ];

  const openWhatsApp = async () => {
    const phoneNumber = '520000000000';
    const message = 'Hola, necesito ayuda con Cent.';
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

  const openEmail = () => {
    const email = 'contacto@example.com';
    const subject = 'Soporte Cent';
    const body = 'Hola, necesito ayuda con mi cuenta de Cent.';
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.canOpenURL(mailtoUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(mailtoUrl);
        } else {
          Alert.alert('Error', 'No se encontró una aplicación de correo');
        }
      })
      .catch((err) => {
        Alert.alert('Error', 'No se pudo abrir el correo');
      });
  };

  const handlePINChange = (index: number, value: string, type: 'new' | 'confirm') => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 1);

    switch (type) {
      case 'new':
        const newNewPIN = [...newPIN];
        newNewPIN[index] = cleanValue;
        setNewPIN(newNewPIN);
        break;
      case 'confirm':
        const newConfirmPIN = [...confirmNewPIN];
        newConfirmPIN[index] = cleanValue;
        setConfirmNewPIN(newConfirmPIN);
        break;
    }
    setPinError('');

    // Auto-advance to next field
    if (cleanValue !== '' && index < 3) {
      const refs = type === 'new' ? newPINRefs : confirmPINRefs;
      refs.current[index + 1]?.focus();
    }
  };

  const handlePINKeyPress = (index: number, key: string, type: 'new' | 'confirm') => {
    const currentPin = type === 'new' ? newPIN : confirmNewPIN;
    if (key === 'Backspace' && currentPin[index] === '' && index > 0) {
      const refs = type === 'new' ? newPINRefs : confirmPINRefs;
      refs.current[index - 1]?.focus();
    }
  };

  const handleChangePIN = async () => {
    // Validate new PIN
    if (newPIN.join('').length !== 4) {
      setPinError('El nuevo PIN debe tener 4 dígitos');
      return;
    }

    // Validate confirmation
    if (newPIN.join('') !== confirmNewPIN.join('')) {
      setPinError('Los PINs no coinciden');
      return;
    }

    try {
      setIsChangingPIN(true);
      setPinError('');

      // Enviar PIN actual vacío (el backend lo manejará)
      const response = await AuthService.changePin(
        '',
        newPIN.join('')
      );

      if (response.success) {
        Alert.alert('Éxito', 'PIN actualizado correctamente', [
          {
            text: 'OK',
            onPress: () => {
              setShowChangePIN(false);
              setNewPIN(['', '', '', '']);
              setConfirmNewPIN(['', '', '', '']);
              setPinError('');
            }
          }
        ]);
      } else {
        setPinError(response.error || 'Error al cambiar el PIN');
      }
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'Error al cambiar el PIN');
    } finally {
      setIsChangingPIN(false);
    }
  };

  const loadBeneficiaries = useCallback(async () => {
    if (!isLoggedIn) {
      return;
    }
    try {
      setIsLoadingBeneficiaries(true);
      const response = await BeneficiariesService.getBeneficiaries();
      if (response.success && response.data) {
        setBeneficiaries(response.data);
        setBeneficiariesError('');
      } else {
        setBeneficiariesError(response.error || 'No fue posible obtener los beneficiarios');
      }
    } catch (error) {
      setBeneficiariesError(error instanceof Error ? error.message : 'Error al cargar beneficiarios');
    } finally {
      setIsLoadingBeneficiaries(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    loadBeneficiaries();
  }, [loadBeneficiaries]);

  // Cargar código de referido cuando el usuario abre la sección de invitar
  useEffect(() => {
    if (showInvite && !referralCode) {
      setIsLoadingReferral(true);
      (async () => {
        try {
          const token = await AuthService.ensureValidToken();
          const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
          const res = await fetch(`${baseUrl}/referrals/code`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.code) {
            setReferralCode(data.code);
            setReferralLink(data.link || `https://example.com/registro?ref=${data.code}`);
          }
        } catch {}
        setIsLoadingReferral(false);
      })();
    }
  }, [showInvite]);

  const handleShareReferral = async () => {
    const code = referralCode || '…';
    try {
      await Share.share({
        message: `¡Únete a CENT con mi código de referido y empieza a ahorrar hoy!\n\nCódigo: ${code}\n\nDescarga la app: ${referralLink}`,
        title: 'Invitación a CENT',
      });
    } catch {}
  };

  const handleDeleteBeneficiary = useCallback(
    (beneficiary: BeneficiaryModel) => {
      Alert.alert('Eliminar beneficiario', '¿Confirma que desea eliminar este beneficiario?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const result = await BeneficiariesService.deleteBeneficiary(beneficiary.id);
            if (result.success) {
              loadBeneficiaries();
            } else {
              Alert.alert('Error', result.error || 'No fue posible eliminar el beneficiario');
            }
          },
        },
      ]);
    },
    [loadBeneficiaries],
  );

  const handleAddBeneficiary = () => {
    // Validate name
    if (!beneficiaryName || beneficiaryName.trim().length === 0) {
      setBeneficiaryError('El nombre es requerido');
      return;
    }

    // Validate phone
    if (!beneficiaryPhone || beneficiaryPhone.trim().length === 0) {
      setBeneficiaryError('El número de teléfono es requerido');
      return;
    }
    
    const payload = {
      name: beneficiaryName.trim(),
      phone: beneficiaryPhone.trim(),
      email: beneficiaryEmail.trim() || undefined,
      relationship: 'general',
      isPrimary: true,
    };

    // Success - in real app, this would add the beneficiary to the backend
    BeneficiariesService.createBeneficiary(payload)
      .then(response => {
        if (response.success) {
          setShowAddBeneficiary(false);
          setBeneficiaryName('');
          setBeneficiaryPhone('');
          setBeneficiaryEmail('');
          setBeneficiaryError('');
          loadBeneficiaries();
          Alert.alert('Éxito', 'Beneficiario agregado correctamente', [
            { text: 'OK' }
          ]);
        } else {
          setBeneficiaryError(response.error || 'Error al agregar el beneficiario');
        }
      })
      .catch(error => {
        setBeneficiaryError(error instanceof Error ? error.message : 'Error al agregar el beneficiario');
      });
  };
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Configuración</Text>
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <View style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color="#3dbac6" />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user?.displayName || 'Usuario'}
              </Text>
              <Text style={styles.profileEmail}>{user?.phoneNumber || 'Sin número'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Account Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cuenta</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/edit')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={20} color="#3dbac6" />
              <Text style={styles.menuItemText}>Editar Perfil</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => {
            setShowChangePIN(!showChangePIN);
            if (showChangePIN) {
              // Limpiar campos al cerrar
              setNewPIN(['', '', '', '']);
              setConfirmNewPIN(['', '', '', '']);
              setPinError('');
            }
          }}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="key-outline" size={20} color="#3dbac6" />
              <Text style={styles.menuItemText}>Cambiar PIN</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
          
          {showChangePIN && (
            <View style={styles.pinChangeContainer}>
              <Text style={styles.pinChangeTitle}>Cambiar PIN de seguridad</Text>
              
              <View style={styles.pinInputContainer}>
                <Text style={styles.pinLabel}>Nuevo PIN</Text>
                <View style={styles.pinInputRow}>
                  {newPIN.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={el => { newPINRefs.current[index] = el; }}
                      style={styles.pinInput}
                      value={digit}
                      onChangeText={(text) => handlePINChange(index, text, 'new')}
                      onKeyPress={({ nativeEvent }) => handlePINKeyPress(index, nativeEvent.key, 'new')}
                      placeholder="•"
                      keyboardType="numeric"
                      maxLength={1}
                      textAlign="center"
                      secureTextEntry
                    />
                  ))}
                </View>
              </View>

              <View style={styles.pinInputContainer}>
                <Text style={styles.pinLabel}>Confirmar nuevo PIN</Text>
                <View style={styles.pinInputRow}>
                  {confirmNewPIN.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={el => { confirmPINRefs.current[index] = el; }}
                      style={styles.pinInput}
                      value={digit}
                      onChangeText={(text) => handlePINChange(index, text, 'confirm')}
                      onKeyPress={({ nativeEvent }) => handlePINKeyPress(index, nativeEvent.key, 'confirm')}
                      placeholder="•"
                      keyboardType="numeric"
                      maxLength={1}
                      textAlign="center"
                      secureTextEntry
                    />
                  ))}
                </View>
              </View>

              {pinError ? <Text style={styles.pinErrorText}>{pinError}</Text> : null}

              <View style={styles.pinButtonContainer}>
                <TouchableOpacity style={styles.pinCancelButton} onPress={() => {
                  setShowChangePIN(false);
                  setNewPIN(['', '', '', '']);
                  setConfirmNewPIN(['', '', '', '']);
                  setPinError('');
                }}>
                  <Text style={styles.pinCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.pinSaveButton, isChangingPIN && styles.pinSaveButtonDisabled]} 
                  onPress={handleChangePIN}
                  disabled={isChangingPIN}
                >
                  <Text style={styles.pinSaveButtonText}>
                    {isChangingPIN ? 'Guardando...' : 'Guardar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowAddBeneficiary(!showAddBeneficiary)}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-add-outline" size={20} color="#3dbac6" />
              <Text style={styles.menuItemText}>Agregar Beneficiario</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
          
          {showAddBeneficiary && (
            <View style={styles.pinChangeContainer}>
              <Text style={styles.pinChangeTitle}>Agregar Beneficiario</Text>
              
              <View style={styles.beneficiaryInputContainer}>
                <Text style={styles.pinLabel}>Nombre</Text>
                <TextInput
                  style={styles.beneficiaryInput}
                  value={beneficiaryName}
                  onChangeText={(text) => {
                    setBeneficiaryName(text);
                    setBeneficiaryError('');
                  }}
                  placeholder="Nombre del beneficiario"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.beneficiaryInputContainer}>
                <Text style={styles.pinLabel}>Número de teléfono</Text>
                <TextInput
                  style={styles.beneficiaryInput}
                  value={beneficiaryPhone}
                  onChangeText={(text) => {
                    setBeneficiaryPhone(text);
                    setBeneficiaryError('');
                  }}
                  placeholder="Número de teléfono del beneficiario"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.beneficiaryInputContainer}>
                <Text style={styles.pinLabel}>Correo electrónico (opcional)</Text>
                <TextInput
                  style={styles.beneficiaryInput}
                  value={beneficiaryEmail}
                  onChangeText={(text) => setBeneficiaryEmail(text)}
                  placeholder="Correo del beneficiario"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {beneficiaryError ? <Text style={styles.pinErrorText}>{beneficiaryError}</Text> : null}

              <View style={styles.pinButtonContainer}>
                <TouchableOpacity style={styles.pinCancelButton} onPress={() => {
                  setShowAddBeneficiary(false);
                  setBeneficiaryName('');
                  setBeneficiaryPhone('');
                  setBeneficiaryError('');
                  setBeneficiaryEmail('');
                }}>
                  <Text style={styles.pinCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pinSaveButton} onPress={handleAddBeneficiary}>
                  <Text style={styles.pinSaveButtonText}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowDeleteAccountModal(true)}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Eliminar cuenta</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#3dbac6" />
              <Text style={styles.menuItemText}>Seguridad</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications-outline" size={20} color="#3dbac6" />
              <Text style={styles.menuItemText}>Notificaciones</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
          
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Beneficiarios guardados</Text>
        {beneficiariesError ? <Text style={styles.pinErrorText}>{beneficiariesError}</Text> : null}
        {isLoadingBeneficiaries ? (
          <Text style={styles.sectionDescription}>Cargando beneficiarios...</Text>
        ) : beneficiaries.length === 0 ? (
          <Text style={styles.sectionDescription}>No hay beneficiarios registrados aún.</Text>
        ) : (
          <View style={styles.beneficiaryList}>
            {beneficiaries.map(beneficiary => (
              <View key={beneficiary.id} style={styles.beneficiaryItem}>
                <View style={styles.beneficiaryRow}>
                  <View>
                    <Text style={styles.beneficiaryName}>{beneficiary.name}</Text>
                    <Text style={styles.beneficiaryPhone}>{beneficiary.phone}</Text>
                    {beneficiary.email ? <Text style={styles.beneficiaryEmail}>{beneficiary.email}</Text> : null}
                    <Text style={styles.beneficiaryRelationship}>{beneficiary.relationship}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteBeneficiary(beneficiary)}
                    style={styles.beneficiaryDeleteButton}
                  >
                    <Text style={styles.beneficiaryDeleteText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Support & Legal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Soporte y Legal</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowContact(!showContact)}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="call-outline" size={20} color="#3dbac6" />
              <Text style={styles.menuItemText}>Contacto</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
          {showContact && (
            <View style={{padding: 20, borderTopWidth: 1, borderTopColor: '#F0F0F0'}}>
              <TouchableOpacity onPress={openWhatsApp} style={styles.contactButton}>
                <View style={styles.buttonContent}>
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                  <Text style={styles.buttonText}>WhatsApp: +52 00 0000 0000</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={openEmail} style={styles.contactButton}>
                <View style={styles.buttonContent}>
                  <Ionicons name="mail-outline" size={20} color="#3dbac6" />
                  <Text style={styles.buttonText}>Correo: contacto@example.com</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  const customerServiceUrl = 'https://example.com/soporte';
                  Linking.canOpenURL(customerServiceUrl)
                    .then((supported) => {
                      if (supported) {
                        return Linking.openURL(customerServiceUrl);
                      } else {
                        Alert.alert('Error', 'No se pudo abrir el enlace');
                      }
                    })
                    .catch((err) => {
                      Alert.alert('Error', 'No se pudo abrir el enlace');
                    });
                }} 
                style={styles.contactButton}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="headset-outline" size={20} color="#3dbac6" />
                  <Text style={styles.buttonText}>Atención a Clientes por Bot</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
          
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/terms')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={20} color="#3dbac6" />
              <Text style={styles.menuItemText}>Términos y Condiciones</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/privacy')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-outline" size={20} color="#3dbac6" />
              <Text style={styles.menuItemText}>Política de Privacidad</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
        </View>
      </View>

      {/* FAQ Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preguntas Frecuentes</Text>
        <View style={styles.faqCard}>
          {faqData.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
              <TouchableOpacity 
                style={styles.faqQuestion} 
                onPress={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
              >
                <View style={styles.faqQuestionContent}>
                  <Ionicons 
                    name="help-circle-outline" 
                    size={20} 
                    color="#3dbac6" 
                    style={styles.faqIcon}
                  />
                  <Text style={styles.faqQuestionText} numberOfLines={expandedFAQ === index ? undefined : 2}>
                    {faq.question}
                  </Text>
                </View>
                <Ionicons 
                  name={expandedFAQ === index ? "chevron-up" : "chevron-down"} 
                  size={16} 
                  color="#999" 
                />
              </TouchableOpacity>
              {expandedFAQ === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Invite a Friend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invitar a un amigo</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowInvite(true)}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="share-social-outline" size={20} color="#3dbac6" />
              <Text style={styles.menuItemText}>Invitar</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
        </View>
        {showInvite && (
          <View style={{backgroundColor: 'white', borderRadius: 12, padding: 20, marginTop: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5}}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
              <Text style={{fontSize: 16, fontWeight: 'bold', color: '#3dbac6', marginRight: 8}}>¡Comparte tu código único!</Text>
              <TouchableOpacity onPress={() => setShowReferralInfo(true)}>
                <Ionicons name="help-circle" size={20} color="#3dbac6" />
              </TouchableOpacity>
            </View>
            <View style={{backgroundColor: '#F3F4F7', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: '#3dbac6', borderStyle: 'dashed'}}>
              <Text style={{fontSize: 24, fontWeight: 'bold', color: '#3dbac6', textAlign: 'center', letterSpacing: 2}}>
                {isLoadingReferral ? '...' : (referralCode || '...')}
              </Text>
              <Text style={{fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4}}>Tu código de referido</Text>
            </View>
            <TouchableOpacity
              style={{backgroundColor: '#3dbac6', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24, opacity: isLoadingReferral ? 0.6 : 1}}
              onPress={handleShareReferral}
              disabled={isLoadingReferral}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>Compartir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{marginTop: 10}} onPress={() => setShowInvite(false)}>
              <Text style={{color: '#FF3B30'}}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteAccountModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Eliminar cuenta</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDeleteAccountModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={styles.sectionDescription}>
                Tu cuenta será eliminada en 72 horas. Si cambias de opinión, inicia sesión antes de que termine este plazo para cancelar la eliminación.
              </Text>
              <TouchableOpacity
                style={[styles.pinSaveButton, styles.deleteModalButton]}
                onPress={() => setShowDeleteAccountModal(false)}
              >
                <Text style={[styles.pinSaveButtonText, styles.deleteModalButtonText]}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Referral Info Modal */}
      <Modal
        visible={showReferralInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReferralInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Programa de Referidos – Cómo funciona</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowReferralInfo(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.referralInfoSection}>
                    <View style={styles.referralStep}>
                          <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>1</Text>
                          </View>
                          <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Comparte tu código personal</Text>
                            <Text style={styles.stepDescription}>
                              Dentro de la aplicación encontrarás tu código único. Compártelo con tus amigos, familiares o conocidos para que descarguen CENT.
                            </Text>
                          </View>
                        </View>

                        <View style={styles.referralStep}>
                          <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>2</Text>
                          </View>
                          <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>El usuario se registra</Text>
                            <Text style={styles.stepDescription}>
                              Cuando alguien descarga la aplicación desde tu código y completa su registro, queda vinculado automáticamente a tu cuenta como referido.
                            </Text>
                          </View>
                        </View>

                        <View style={styles.referralStep}>
                          <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>3</Text>
                          </View>
                          <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Tu referido abona $1,000 pesos</Text>
                            <Text style={styles.stepDescription}>
                              Para activar tu recompensa, la persona que usó tu código debe acumular al menos $1,000 pesos en abonos dentro de la aplicación.
                            </Text>
                          </View>
                        </View>

                <View style={styles.referralStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>4</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>¡Recibes $50 pesos!</Text>
                    <Text style={styles.stepDescription}>
                      En cuanto tu referido acumule $1,000 pesos en abonos, tú recibirás $50 pesos de recompensa automáticamente en tu cuenta CENT.
                    </Text>
                  </View>
                </View>

                <View style={styles.importantSection}>
                  <Text style={styles.importantTitle}>Importante tener en cuenta</Text>
                  <View style={styles.importantList}>
                            <View style={styles.importantItem}>
                              <Text style={styles.bulletPoint}>•</Text>
                              <Text style={styles.importantText}>
                                Solo recibirás la recompensa si el referido se registra con tu código y acumula al menos $1,000 pesos en abonos.
                              </Text>
                            </View>
                    <View style={styles.importantItem}>
                      <Text style={styles.bulletPoint}>•</Text>
                      <Text style={styles.importantText}>
                        Los $50 pesos se acreditan una sola vez por cada referido que cumpla con el mínimo de $1,000 pesos.
                      </Text>
                    </View>
                    <View style={styles.importantItem}>
                      <Text style={styles.bulletPoint}>•</Text>
                      <Text style={styles.importantText}>
                        No hay límite de invitados: mientras más personas invites, más puedes ganar.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    backgroundColor: '#3dbac6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  menuCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemValue: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  logoutButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
  contactButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  faqCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  faqQuestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  faqIcon: {
    marginRight: 12,
  },
  faqQuestionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    lineHeight: 22,
  },
  faqAnswer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#F8F9FA',
  },
  faqAnswerText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  // PIN Change Styles
  pinChangeContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  pinChangeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  pinInputContainer: {
    marginBottom: 20,
  },
  pinLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  pinInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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
  pinErrorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 16,
    textAlign: 'center',
  },
  pinButtonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  pinCancelButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pinCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  pinSaveButton: {
    flex: 1,
    backgroundColor: '#3dbac6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pinSaveButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  pinSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  deleteModalButton: {
    marginTop: 24,
    width: '100%',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  deleteModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Beneficiary Styles
  beneficiaryInputContainer: {
    marginBottom: 20,
  },
  beneficiaryInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  beneficiaryList: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  beneficiaryItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 12,
    marginBottom: 12,
  },
  beneficiaryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  beneficiaryPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  beneficiaryEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  beneficiaryRelationship: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  beneficiaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beneficiaryDeleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  beneficiaryDeleteText: {
    color: '#8f3b3b',
    fontWeight: '500',
  },
  // Referral Info Modal Styles
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
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  referralInfoSection: {
    gap: 20,
  },
  referralStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3dbac6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  importantSection: {
    marginTop: 10,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3dbac6',
  },
  importantTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  importantList: {
    gap: 8,
  },
  importantItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#3dbac6',
    fontWeight: 'bold',
    marginTop: 2,
  },
  importantText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    flex: 1,
  },
}); 