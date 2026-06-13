import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
    StatusBar,
} from 'react-native';
import { AuthService } from './services/authService';

export default function EditProfile() {
  const router = useRouter();
  
  // Estados para los campos del perfil
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [frontId, setFrontId] = useState<string | null>(null);
  const [backId, setBackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // Validaciones básicas
    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword && !password) {
      Alert.alert('Error', 'Ingresa tu contraseña actual para poder cambiarla');
      return;
    }

    try {
      setIsSaving(true);

      if (newPassword) {
        const passwordResult = await AuthService.changePassword(password, newPassword);
        if (!passwordResult.success) {
          Alert.alert('Error', passwordResult.error || 'No fue posible cambiar la contraseña');
          return;
        }
      }

      Alert.alert('Éxito', 'Perfil actualizado correctamente', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No fue posible guardar cambios');
    } finally {
      setIsSaving(false);
    }
  };

  // Cargar datos del perfil al montar el componente
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const response = await AuthService.getProfile();
      
      if (response.success && response.data) {
        const user = response.data;
        
        // Mapear datos del usuario
        setPhoneNumber(user.phone_number || user.phoneNumber || '');
        setEmail(user.email || '');
        
        // Formatear dirección
        const addressParts = [];
        if (user.address_street) addressParts.push(user.address_street);
        if (user.address_number) addressParts.push(user.address_number);
        if (user.address_colony) addressParts.push(`Col. ${user.address_colony}`);
        if (user.address_city) addressParts.push(user.address_city);
        if (user.address_state) addressParts.push(user.address_state);
        if (user.address_postal_code) addressParts.push(`CP ${user.address_postal_code}`);
        
        setAddress(addressParts.join(', ') || '');
        
        // Cargar documentos KYC si existen
        if (user.kyc_documents) {
          const kycDocs = typeof user.kyc_documents === 'string' 
            ? JSON.parse(user.kyc_documents) 
            : user.kyc_documents;
          if (kycDocs.front_id) setFrontId(kycDocs.front_id);
          if (kycDocs.back_id) setBackId(kycDocs.back_id);
        }
      } else {
        Alert.alert('Error', 'No se pudo cargar el perfil. Por favor intenta de nuevo.');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Error al cargar el perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async (type: 'front' | 'back') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 2],
      quality: 1,
    });

    if (!result.canceled) {
      if (type === 'front') {
        setFrontId(result.assets[0].uri);
      } else {
        setBackId(result.assets[0].uri);
      }
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#3dbac6" />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Perfil</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Información Personal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Personal</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Número de teléfono</Text>
            <TextInput
              style={styles.textInput}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+52 55 1234 5678"
              keyboardType="phone-pad"
            />
            <Text style={styles.inputNote}>
              Si cambias tu número, necesitarás verificar el nuevo número
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Correo electrónico</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="usuario@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contraseña actual</Text>
            <TextInput
              style={styles.textInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Ingresa tu contraseña actual"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nueva contraseña</Text>
            <TextInput
              style={styles.textInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Nueva contraseña"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirmar nueva contraseña</Text>
            <TextInput
              style={styles.textInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirma tu nueva contraseña"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Dirección */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dirección</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Dirección completa</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Calle, número, colonia, ciudad"
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Documentos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documentos de Identidad</Text>
          
          <View style={styles.documentSection}>
            <Text style={styles.documentLabel}>INE - Frente</Text>
            <TouchableOpacity
              style={styles.documentButton}
              onPress={() => pickImage('front')}
            >
              {frontId ? (
                <View style={styles.documentPreview}>
                  <Ionicons name="checkmark-circle" size={24} color="#3dbac6" />
                  <Text style={styles.documentText}>Documento subido</Text>
                </View>
              ) : (
                <View style={styles.documentUpload}>
                  <Ionicons name="camera" size={24} color="#666" />
                  <Text style={styles.documentText}>Subir documento</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.documentSection}>
            <Text style={styles.documentLabel}>INE - Reverso</Text>
            <TouchableOpacity
              style={styles.documentButton}
              onPress={() => pickImage('back')}
            >
              {backId ? (
                <View style={styles.documentPreview}>
                  <Ionicons name="checkmark-circle" size={24} color="#3dbac6" />
                  <Text style={styles.documentText}>Documento subido</Text>
                </View>
              ) : (
                <View style={styles.documentUpload}>
                  <Ionicons name="camera" size={24} color="#666" />
                  <Text style={styles.documentText}>Subir documento</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Botones de Acción */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    marginTop: -8,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  documentSection: {
    marginBottom: 16,
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  documentButton: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  documentPreview: {
    alignItems: 'center',
  },
  documentUpload: {
    alignItems: 'center',
  },
  documentText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3dbac6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
