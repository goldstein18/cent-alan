import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type GoalCardData = {
  id: string | number;
  name: string;
  category: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  frequency: string;
  paymentType: string;
  progress: number;
  status?: string;
  type?: 'sin-rendimiento' | 'con-rendimiento';
  hasRendimientos?: boolean;
  rendimientosGenerados?: number;
  nextAbonoDate?: string;
  montoAPagar?: number;
  isCompleted?: boolean;
  isExpired?: boolean;
};

interface GoalCardProps {
  goal: GoalCardData;
  categoryLabel: string;
  categoryColor: string;
  categoryIcon: string;
  frequencyLabel: string;
  formatDate: (dateString?: string) => string;
  getDaysRemaining: (dateString?: string) => string | number;
  onAdd: () => void;
  onManage: () => void;
  onWithdraw?: () => void;
}

export function GoalCard({
  goal,
  categoryLabel,
  categoryColor,
  categoryIcon,
  frequencyLabel,
  formatDate,
  getDaysRemaining,
  onAdd,
  onManage,
  onWithdraw,
}: GoalCardProps) {
  // Estado para forzar re-render cada minuto para actualizar los días restantes
  const [, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Actualizar cada minuto para recalcular días restantes
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 60 segundos

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={styles.goalHeaderLeft}>
          <View style={[styles.categoryIcon, { backgroundColor: categoryColor }]}>
            <Ionicons name={categoryIcon as any} size={20} color="white" />
          </View>
          <View style={styles.goalInfo}>
            <Text style={styles.goalName}>{goal.name}</Text>
            <Text style={styles.goalCategory}>{categoryLabel}</Text>
          </View>
        </View>
        <View style={styles.goalHeaderRight}>
          <View
            style={[
              styles.goalTypeBadge,
              goal.hasRendimientos ? styles.rendimientoBadge : styles.sinRendimientoBadge,
            ]}
          >
            <Ionicons
              name={goal.hasRendimientos ? 'trending-up' : 'wallet'}
              size={12}
              color="white"
            />
            <Text style={styles.goalTypeText}>
              {goal.hasRendimientos ? 'Con rendimiento' : 'Sin rendimiento'}
            </Text>
          </View>
          {goal.hasRendimientos && (
            <View style={styles.rendimientosBadge}>
              <Text style={styles.rendimientosText}>
                +${((goal.rendimientosGenerados ?? 0)).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {goal.description && <Text style={styles.goalDescription}>{goal.description}</Text>}

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progreso</Text>
          <Text style={styles.progressPercentage}>
            {goal.targetAmount > 0 
              ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
              : 0}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${goal.targetAmount > 0 
                  ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
                  : 0}%`,
                backgroundColor: goal.status === 'completed' ? '#2E7D32' : '#3dbac6',
              },
            ]}
          />
        </View>
        <View style={styles.amountInfo}>
          <Text style={styles.currentAmount}>${goal.currentAmount.toLocaleString()}</Text>
          <Text style={styles.targetAmount}>de ${goal.targetAmount.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.goalDetails}>
        {goal.deadline && (() => {
          const daysRemaining = getDaysRemaining(goal.deadline);
          const daysText = typeof daysRemaining === 'number' 
            ? (daysRemaining < 0 
                ? `vencida hace ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'día' : 'días'}`
                : daysRemaining === 0
                ? 'vence hoy'
                : `${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'} restantes`)
            : '';
          return (
            <View style={styles.detailItem}>
              <Ionicons name='calendar' size={16} color='#666' />
              <Text style={styles.detailText}>
                Fecha de vencimiento: {formatDate(goal.deadline)} ({daysText})
              </Text>
            </View>
          );
        })()}
        {goal.nextAbonoDate && (
          <View style={styles.detailItem}>
            <Ionicons name='time' size={16} color='#3dbac6' />
            <Text style={styles.detailText}>
              Próximo abono: {formatDate(goal.nextAbonoDate)}
              {goal.montoAPagar && goal.montoAPagar > 0
                ? ` · $${goal.montoAPagar.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : ''}
            </Text>
          </View>
        )}
        <View style={styles.detailItem}>
          <Ionicons name='refresh' size={16} color='#666' />
          <Text style={styles.detailText}>Abono {frequencyLabel.toLowerCase()}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name={goal.paymentType === 'manual' ? 'hand-left' : 'card'} size={16} color='#666' />
          <Text style={styles.detailText}>
            {goal.paymentType === 'manual' ? 'Abono manual' : 'Domiciliado'}
          </Text>
        </View>
      </View>

      <View style={goal.isCompleted ? [styles.goalActions, { flexDirection: 'column' }] : styles.goalActions}>
        {goal.isCompleted ? (
          <TouchableOpacity 
            style={[styles.actionButton, { 
              backgroundColor: '#4CAF50', 
              borderColor: '#4CAF50',
              width: '100%',
              flex: 0
            }]} 
            onPress={onWithdraw}
          >
            <Ionicons name='cash-outline' size={20} color='#FFFFFF' />
            <Text style={[styles.actionButtonText, { color: '#FFFFFF', fontWeight: 'bold' }]}>RETIRAR FONDOS</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.actionButton} onPress={onAdd}>
              <Ionicons name='add-circle' size={20} color='#3dbac6' />
              <Text style={styles.actionButtonText}>Abonar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.secondaryAction]} onPress={onManage}>
              <Ionicons name='settings' size={20} color='#666' />
              <Text style={[styles.actionButtonText, styles.secondaryActionText]}>Gestionar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  goalCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
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
    position: 'relative',
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
});


