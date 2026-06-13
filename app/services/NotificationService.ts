import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configurar el comportamiento de las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  priority?: 'default' | 'normal' | 'high';
  vibrate?: number[];
  color?: string;
  channelId?: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;

  private constructor() {
    this.setupNotificationChannels();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Configurar canales de notificación para Android
  private async setupNotificationChannels() {
    if (Platform.OS === 'android') {
      // Canal principal
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificaciones generales',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // Canal para alertas financieras
      await Notifications.setNotificationChannelAsync('financial-alerts', {
        name: 'Alertas financieras',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#FF0000',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      // Canal para recordatorios
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Recordatorios',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4CAF50',
        sound: 'default',
        enableVibrate: true,
        showBadge: false,
      });
    }
  }

  // Registrar el dispositivo para recibir notificaciones
  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        return null;
      }

      // Verificar permisos
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      // Obtener el token de Expo
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId || projectId === 'your-eas-project-id') {
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });

      this.expoPushToken = token.data;

      return this.expoPushToken;
    } catch (error) {
      console.error('Error al registrar notificaciones:', error);
      return null;
    }
  }

  // Enviar notificación local con estilos personalizados
  async sendLocalNotification(notification: NotificationData): Promise<void> {
    try {
      const notificationContent: Notifications.NotificationContentInput = {
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: notification.sound !== false ? 'default' : undefined,
        priority: notification.priority || 'default',
        vibrate: notification.vibrate,
        color: notification.color,
      };

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Enviar inmediatamente
      });
    } catch (error) {
      console.error('Error al enviar notificación local:', error);
    }
  }

  // Enviar notificación de alerta financiera
  async sendFinancialAlert(title: string, body: string, data?: Record<string, any>): Promise<void> {
    await this.sendLocalNotification({
      title,
      body,
      data,
      channelId: 'financial-alerts',
      priority: 'high',
      vibrate: [0, 500, 200, 500],
      color: '#FF0000',
      sound: true,
    });
  }

  // Enviar notificación de recordatorio
  async sendReminder(title: string, body: string, data?: Record<string, any>): Promise<void> {
    await this.sendLocalNotification({
      title,
      body,
      data,
      channelId: 'reminders',
      priority: 'default',
      vibrate: [0, 250, 250, 250],
      color: '#4CAF50',
      sound: true,
    });
  }

  // Programar notificación local con estilos
  async scheduleLocalNotification(
    notification: NotificationData,
    trigger: Notifications.NotificationTriggerInput
  ): Promise<void> {
    try {
      const notificationContent: Notifications.NotificationContentInput = {
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: notification.sound !== false ? 'default' : undefined,
        priority: notification.priority || 'default',
        vibrate: notification.vibrate,
        color: notification.color,
      };

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger,
      });
    } catch (error) {
      console.error('Error al programar notificación:', error);
    }
  }

  // Obtener el token actual
  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  // Cancelar todas las notificaciones programadas
  async cancelAllScheduledNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error al cancelar notificaciones:', error);
    }
  }

  // Configurar listener para notificaciones recibidas
  addNotificationReceivedListener(
    listener: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(listener);
  }

  // Configurar listener para notificaciones tocadas
  addNotificationResponseReceivedListener(
    listener: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }
}

// Exportar instancia singleton
export const notificationService = NotificationService.getInstance();
