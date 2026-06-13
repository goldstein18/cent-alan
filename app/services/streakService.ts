import AsyncStorage from '@react-native-async-storage/async-storage';
import { UsersService } from './usersService';

const STREAK_KEY = 'user_streak_data';

interface StreakData {
  currentStreak: number; // días consecutivos
  lastAppOpenDate: string; // fecha del último día en que se abrió la app (formato YYYY-MM-DD)
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD (solo la fecha, sin hora)
 */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula la diferencia en días entre dos fechas (solo la parte de fecha, ignorando la hora)
 */
function getDaysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Resetear horas para comparar solo fechas
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Actualiza la racha localmente (fallback cuando no hay conexión)
 */
async function updateStreakLocal(): Promise<{ days: number; weeks: number }> {
  try {
    const today = getTodayDateString();
    
    // Obtener datos guardados
    const storedData = await AsyncStorage.getItem(STREAK_KEY);
    let streakData: StreakData;
    
    if (storedData) {
      streakData = JSON.parse(storedData);
    } else {
      // Primera vez que se abre la app
      streakData = {
        currentStreak: 1,
        lastAppOpenDate: today,
      };
      await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(streakData));
      return { days: 1, weeks: 0 };
    }
    
    // Si ya se abrió la app hoy, no hacer nada
    if (streakData.lastAppOpenDate === today) {
      const weeks = Math.floor(streakData.currentStreak / 7);
      return { days: streakData.currentStreak, weeks };
    }
    
    // Calcular diferencia de días
    const daysDiff = getDaysDifference(streakData.lastAppOpenDate, today);
    
    if (daysDiff === 1) {
      // Día consecutivo - incrementar racha
      streakData.currentStreak += 1;
      streakData.lastAppOpenDate = today;
    } else if (daysDiff > 1) {
      // Se perdió la racha - reiniciar
      streakData.currentStreak = 1;
      streakData.lastAppOpenDate = today;
    }
    // Si daysDiff === 0, ya se procesó arriba
    
    // Guardar datos actualizados
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(streakData));
    
    // Calcular semanas (solo si tiene 7 días o más)
    const weeks = Math.floor(streakData.currentStreak / 7);
    
    return { days: streakData.currentStreak, weeks };
  } catch (error) {
    console.error('Error updating streak locally:', error);
    return { days: 0, weeks: 0 };
  }
}

/**
 * Obtiene la racha local (fallback cuando no hay conexión)
 */
async function getStreakLocal(): Promise<{ days: number; weeks: number }> {
  try {
    const storedData = await AsyncStorage.getItem(STREAK_KEY);
    
    if (!storedData) {
      return { days: 0, weeks: 0 };
    }
    
    const streakData: StreakData = JSON.parse(storedData);
    const weeks = Math.floor(streakData.currentStreak / 7);
    
    return { days: streakData.currentStreak, weeks };
  } catch (error) {
    console.error('Error getting streak locally:', error);
    return { days: 0, weeks: 0 };
  }
}

/**
 * Actualiza la racha cuando el usuario abre la app
 * Intenta usar Supabase primero, si falla usa AsyncStorage local
 * @returns Promise con los datos actualizados de la racha (días y semanas)
 */
export async function updateStreak(): Promise<{ days: number; weeks: number }> {
  try {
    // Intentar con Supabase primero
    const result = await UsersService.updateStreak();
    if (result.success && result.data) {
      // También guardar localmente como respaldo
      await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({
        currentStreak: result.data.days,
        lastAppOpenDate: getTodayDateString(),
      }));
      return result.data;
    }
  } catch (error) {
    console.error('Error updating streak with Supabase, using local fallback:', error);
  }
  
  // Si falla, usar implementación local
  return updateStreakLocal();
}

/**
 * Obtiene la racha actual sin actualizarla
 * Intenta usar Supabase primero, si falla usa AsyncStorage local
 * @returns Promise con los datos actuales de la racha (días y semanas)
 */
export async function getStreak(): Promise<{ days: number; weeks: number }> {
  try {
    // Intentar con Supabase primero
    const result = await UsersService.getStreak();
    if (result.success && result.data) {
      return result.data;
    }
  } catch (error) {
    console.error('Error getting streak from Supabase, using local fallback:', error);
  }
  
  // Si falla, usar implementación local
  return getStreakLocal();
}

/**
 * Reinicia la racha (útil para testing o reset manual)
 */
export async function resetStreak(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STREAK_KEY);
    await AsyncStorage.removeItem('streak_cache');
  } catch (error) {
    console.error('Error resetting streak:', error);
  }
}

