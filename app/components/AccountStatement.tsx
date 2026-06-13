import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AccountStatement as AccountStatementType } from '../contexts/DataContext';

interface AccountStatementProps {
  statements: AccountStatementType[];
  limit?: number;
  showFilters?: boolean;
}

export default function AccountStatement({ statements, limit, showFilters = true }: AccountStatementProps) {
  const [selectedFilter, setSelectedFilter] = useState<
    'all' | 'deposit' | 'internal_transfer' | 'external_transfer' | 'payment' | 'investment' | 'investment_cancellation'
  >('all');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'add-circle';
      case 'internal_transfer':
        return 'swap-horizontal';
      case 'external_transfer':
        return 'arrow-forward';
      case 'payment':
        return 'card';
      case 'investment':
        return 'trending-up';
      case 'investment_cancellation':
        return 'close-circle';
      default:
        return 'document';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return '#4CAF50';
      case 'internal_transfer':
        return '#2196F3';
      case 'external_transfer':
        return '#FF9800';
      case 'payment':
        return '#9C27B0';
      case 'investment':
        return '#3dbac6';
      case 'investment_cancellation':
        return '#FF6B6B';
      default:
        return '#757575';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'Abono';
      case 'internal_transfer':
        return 'Transferencia Interna';
      case 'external_transfer':
        return 'Transferencia Externa';
      case 'payment':
        return 'Pago';
      case 'investment':
        return 'Inversión';
      case 'investment_cancellation':
        return 'Cancelación de Inversión';
      default:
        return 'Transacción';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'failed':
        return '#F44336';
      case 'active':
        return '#3dbac6';
      case 'matured':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'pending':
        return 'En proceso';
      case 'failed':
        return 'Fallido';
      case 'active':
        return 'Activa';
      case 'matured':
        return 'Vencida';
      case 'cancelled':
        return 'Cancelada';
      default:
        return 'Desconocido';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Hace menos de 1 hora';
    } else if (diffInHours < 24) {
      return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    } else if (diffInHours < 48) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  const filteredStatements = statements
    .filter(statement => 
      selectedFilter === 'all' || statement.type === selectedFilter
    )
    .slice(0, limit || statements.length);

  const filterOptions = [
    { key: 'all', label: 'Todos' },
    { key: 'deposit', label: 'Abonos' },
    { key: 'internal_transfer', label: 'Internas' },
    { key: 'external_transfer', label: 'Externas' },
    { key: 'payment', label: 'Pagos' },
    { key: 'investment', label: 'Inversiones' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.sectionHeader}>
          <Ionicons name="document-text" size={24} color="#3dbac6" />
          <Text style={styles.sectionTitle}>Estado de Cuenta</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      {showFilters && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.filterButton,
                selectedFilter === option.key && styles.filterButtonActive
              ]}
              onPress={() => setSelectedFilter(option.key as any)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedFilter === option.key && styles.filterButtonTextActive
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Statements List */}
      <ScrollView style={styles.statementsList} showsVerticalScrollIndicator={false}>
        {filteredStatements.length > 0 ? (
          filteredStatements.map((statement) => (
            <View key={statement.id} style={styles.statementCard}>
              <View style={styles.statementHeader}>
                <View style={styles.statementIconContainer}>
                  <Ionicons 
                    name={getTypeIcon(statement.type)} 
                    size={20} 
                    color={getTypeColor(statement.type)} 
                  />
                </View>
                <View style={styles.statementInfo}>
                  <Text style={styles.statementDescription}>{statement.description}</Text>
                  <Text style={styles.statementType}>{getTypeLabel(statement.type)}</Text>
                </View>
                <View style={styles.statementAmountContainer}>
                  <Text
                    style={[
                    styles.statementAmount,
                      {
                        color: statement.type === 'deposit' || statement.type === 'investment_cancellation'
                          ? '#4CAF50'
                          : statement.type === 'investment'
                            ? '#3dbac6'
                            : '#F44336',
                      },
                    ]}
                  >
                    {statement.type === 'deposit' || statement.type === 'investment_cancellation' ? '+' : '-'}${statement.amount.toLocaleString()}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(statement.status) }
                  ]}>
                    <Text style={styles.statusText}>{getStatusLabel(statement.status)}</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.statementDetails}>
                {statement.reference && (
                <View style={styles.statementDetailRow}>
                  <Text style={styles.statementDetailLabel}>Referencia:</Text>
                  <Text style={styles.statementDetailValue}>{statement.reference}</Text>
                </View>
                )}
                <View style={styles.statementDetailRow}>
                  <Text style={styles.statementDetailLabel}>Fecha:</Text>
                  <Text style={styles.statementDetailValue}>{formatDate(statement.createdAt)}</Text>
                </View>
                {statement.type === 'investment' && statement.termMonths !== undefined && (
                  <View style={styles.statementDetailRow}>
                    <Text style={styles.statementDetailLabel}>Plazo:</Text>
                    <Text style={styles.statementDetailValue}>{statement.termMonths} meses</Text>
                  </View>
                )}
                {statement.type === 'investment' && statement.maturityDate && (
                  <View style={styles.statementDetailRow}>
                    <Text style={styles.statementDetailLabel}>Vence:</Text>
                    <Text style={styles.statementDetailValue}>
                      {new Date(statement.maturityDate).toLocaleDateString('es-MX')}
                    </Text>
                  </View>
                )}
                {statement.type === 'investment' && statement.interestRate !== undefined && (
                  <View style={styles.statementDetailRow}>
                    <Text style={styles.statementDetailLabel}>Tasa anual:</Text>
                    <Text style={styles.statementDetailValue}>{statement.interestRate ? `${statement.interestRate.toFixed(2)}%` : '—'}</Text>
                  </View>
                )}
                {statement.type === 'investment' && (
                  <View style={styles.statementDetailRow}>
                    <Text style={styles.statementDetailLabel}>Estado:</Text>
                    <Text style={styles.statementDetailValue}>{getStatusLabel(statement.status)}</Text>
                  </View>
                )}
                {statement.toAccount && (
                  <View style={styles.statementDetailRow}>
                    <Text style={styles.statementDetailLabel}>Para:</Text>
                    <Text style={styles.statementDetailValue}>{statement.toAccount}</Text>
                  </View>
                )}
                {statement.bankName && (
                  <View style={styles.statementDetailRow}>
                    <Text style={styles.statementDetailLabel}>Banco:</Text>
                    <Text style={styles.statementDetailValue}>{statement.bankName}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No hay transacciones para mostrar</Text>
            <Text style={styles.emptyStateSubtext}>
              {selectedFilter === 'all' 
                ? 'Realiza tu primera transacción' 
                : `No hay ${filterOptions.find(opt => opt.key === selectedFilter)?.label.toLowerCase()} para mostrar`
              }
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterContent: {
    paddingHorizontal: 4,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#3dbac6',
    borderColor: '#3dbac6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  statementsList: {
    flex: 1,
  },
  statementCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statementHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statementIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statementInfo: {
    flex: 1,
    marginRight: 12,
  },
  statementDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  statementType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statementAmountContainer: {
    alignItems: 'flex-end',
  },
  statementAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  statementDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  statementDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statementDetailLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statementDetailValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
