import { Injectable } from '@nestjs/common';
import { BalanceService } from '../balance/balance.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PayServiceDto, QueryBillDto } from './dto/mt-center.dto';

@Injectable()
export class MtCenterService {
  // MT Center API configuration from documentation
  // Testing credentials for CENT Pruebas
  private readonly mtCenterApiUrl = process.env.MT_CENTER_API_URL || '';
  private readonly cadena = parseInt(process.env.MT_CENTER_CADENA || '0', 10);
  private readonly establecimiento = parseInt(process.env.MT_CENTER_ESTABLECIMIENTO || '0', 10);
  private readonly terminal = parseInt(process.env.MT_CENTER_TERMINAL || '0', 10);
  private readonly cajero = parseInt(process.env.MT_CENTER_CAJERO || '0', 10);
  private readonly clave = process.env.MT_CENTER_CLAVE || '';
  
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private supabaseService: SupabaseService,
    private balanceService: BalanceService
  ) {}

  /**
   * Authenticate and get token from MT Center API
   * Token is valid for 24 hours, refresh 5 minutes before expiry
   */
  private async authenticate(): Promise<string> {
    // Check if we have a valid token
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.tokenExpiry > now + 300) { // 5 minutes buffer
      return this.token;
    }

    try {
      const authRequest = {
        cadena: this.cadena,
        establecimiento: this.establecimiento,
        terminal: this.terminal,
        cajero: this.cajero,
        clave: this.clave,
      };


      const response = await fetch(`${this.mtCenterApiUrl}/token/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authRequest),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = JSON.parse(responseText);
          errorDetails = errorData.mensajeRespuesta || errorData.message || `HTTP ${response.status}`;
        } catch {
          errorDetails = responseText || `HTTP ${response.status}`;
        }
        throw new Error(`Error de autenticación con MT Center: ${errorDetails}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing authentication response:', parseError);
        throw new Error('Respuesta inválida de MT Center durante autenticación');
      }
      
      if (data.codigoRespuesta !== 0) {
        const errorMessage = data.mensajeRespuesta || 'Error desconocido de autenticación';
        console.error('MT Center authentication error code:', data.codigoRespuesta);
        console.error('MT Center authentication error message:', errorMessage);
        throw new Error(`Error de autenticación: ${errorMessage} (código: ${data.codigoRespuesta})`);
      }

      if (!data.token) {
        throw new Error('No se recibió token de MT Center');
      }

      this.token = data.token;
      this.tokenExpiry = now + parseInt(data.expires_in || '86400');
      
      
      return this.token;
    } catch (error) {
      console.error('Error authenticating with MT Center:', error);
      if (error instanceof Error) {
        throw error; // Re-throw with original message
      }
      throw new Error('No se pudo autenticar con MT Center');
    }
  }

  /**
   * Get available service providers from MT Center API
   * Doc: emisores/productos (MTCenter_integracion_Servicios)
   */
  async getProviders() {
    try {
      const token = await this.authenticate();
      
      const response = await fetch(`${this.mtCenterApiUrl}/emisores/productos`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const data = await response.json();
      const codigo = data.codigo_respuesta ?? data.codigoRespuesta;
      if (codigo !== 0) {
        throw new Error(data.descripcion_respuesta || data.mensajeRespuesta || 'Error al obtener productos');
      }

      // Transform: doc uses ClaveProducto, Producto
      const providers: any[] = [];
      if (data.productos && Array.isArray(data.productos)) {
        data.productos.forEach((producto: any) => {
          const id = producto.ClaveProducto?.toString() || producto.codigoProducto?.toString() || producto.id?.toString();
          providers.push({
            id,
            codigoProducto: producto.ClaveProducto ?? producto.codigoProducto,
            name: producto.Producto || producto.nombreProducto || producto.nombre,
            category: producto.categoria || 'Servicios',
            description: producto.Producto || producto.descripcion,
          });
        });
      }

      return { providers };
    } catch {
      return { providers: [] };
    }
  }

  /**
   * Query bill (get amount to pay) - emisores/consultaReferencia
   * Doc: referencia1, sku → cantidadAPagar
   */
  async queryBill(userId: string, queryBillDto: QueryBillDto) {
    try {
      const token = await this.authenticate();
      const requestBody = {
        referencia1: queryBillDto.accountNumber,
        sku: queryBillDto.providerId,
      };


      const response = await fetch(`${this.mtCenterApiUrl}/emisores/consultaReferencia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let err = '';
        try { const d = JSON.parse(responseText); err = d.descripcion_respuesta || d.mensajeRespuesta || responseText.slice(0, 200); } catch { err = responseText.slice(0, 200); }
        throw new Error(`Error al consultar con MT Center: ${err}`);
      }

      const data = JSON.parse(responseText);
      const codigo = data.codigo_respuesta ?? data.codigoRespuesta ?? 0;
      if (codigo !== 0) {
        throw new Error(this.getServiceErrorMessage(codigo) || data.descripcion_respuesta || data.mensajeRespuesta || 'Error al consultar');
      }

      const amount = parseFloat(data.cantidadAPagar ?? data.importe ?? data.monto ?? '0');
      return {
        bill: {
          id: `ref-${Date.now()}`,
          providerId: queryBillDto.providerId,
          providerName: queryBillDto.providerId,
          accountNumber: queryBillDto.accountNumber,
          accountName: 'N/A',
          amount,
          status: 'pending',
          reference: data.referencia ?? queryBillDto.accountNumber,
          additionalInfo: data,
        },
      };
    } catch (error) {
      console.error('Error querying bill from MT Center:', error);
      // Re-throw the error so the controller can handle it
      throw error instanceof Error ? error : new Error('No se pudo consultar el recibo. Por favor, verifica los datos e intenta nuevamente.');
    }
  }

  /**
   * Pay a service bill - emisores/servicio
   * Doc: referencia1, referencia2, sku, no_transaccion, fecha_hora, monto
   */
  async payService(userId: string, payServiceDto: PayServiceDto) {
    try {
      const userBalance = await this.balanceService.getUserBalance(userId);
      if (userBalance.available_balance < payServiceDto.amount) {
        throw new Error('Saldo insuficiente');
      }

      const token = await this.authenticate();
      const noTransaccion = Math.floor(Date.now() / 1000) % 100000;
      const fechaHora = new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).replace(',', '');

      const requestBody = {
        referencia1: payServiceDto.accountNumber,
        referencia2: '',
        sku: payServiceDto.providerId,
        no_transaccion: noTransaccion,
        fecha_hora: fechaHora,
        monto: payServiceDto.amount,
      };

      const response = await fetch(`${this.mtCenterApiUrl}/emisores/servicio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MT Center API error: ${response.status} - ${errorText}`);
      }

      const paymentData = await response.json();
      const codigo = paymentData.codigo_respuesta ?? paymentData.codigoRespuesta;
      if (codigo !== 0) {
        const errorMessage = this.getServiceErrorMessage(codigo);
        throw new Error(errorMessage || paymentData.descripcion_respuesta || paymentData.mensajeRespuesta || 'Error al procesar el pago');
      }

      const reference = paymentData.no_autorizacion
        ? `MT-${paymentData.no_autorizacion}`
        : `MT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      // Create transaction record
      const transactionData = {
        user_id: userId,
        type: 'payment',
        amount: payServiceDto.amount,
        description: `Pago de servicio - ${payServiceDto.providerId}`,
        reference,
        status: 'completed',
        metadata: {
          providerId: payServiceDto.providerId,
          accountNumber: payServiceDto.accountNumber,
          mtCenterTicket: paymentData.no_autorizacion,
          mtCenterTransaction: paymentData.no_transaccion ?? paymentData.noTransaccion,
          fechaHoraSolicitud: paymentData.fecha_hora_solicitud ?? paymentData.fechaHoraSolicitud,
          fechaHoraRespuesta: paymentData.fecha_hora_respuesta ?? paymentData.fechaHoraRespuesta,
          nombreProducto: paymentData.instruccion1 ?? paymentData.nombreProducto,
          nombreCliente: paymentData.nombreCliente,
        },
      };

      const transaction = await this.supabaseService.createTransaction(transactionData);

      // Deduct balance
      await this.balanceService.deductBalance(
        userId,
        payServiceDto.amount,
        reference,
        `Pago de servicio - ${payServiceDto.providerId}`,
        true
      );

      return {
        payment: {
          transactionId: transaction.id,
          reference,
          amount: payServiceDto.amount,
          providerName: paymentData.instruccion1 || paymentData.nombreProducto || payServiceDto.providerId,
          status: 'completed',
          timestamp: new Date().toISOString(),
          mtCenterTicket: paymentData.no_autorizacion ?? paymentData.numeroTicket,
        },
      };
    } catch (error) {
      console.error('Error paying service through MT Center:', error);
      throw error instanceof Error ? error : new Error('No se pudo procesar el pago');
    }
  }

  /**
   * Query balance - emisores/saldo
   * Doc: POST with fecha_hora (dd/mm/yyyy HH:mm:ss)
   */
  async queryBalance() {
    try {
      const token = await this.authenticate();
      const fechaHora = new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).replace(',', '');

      const response = await fetch(`${this.mtCenterApiUrl}/emisores/saldo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ fecha_hora: fechaHora }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`MT Center saldo HTTP ${response.status}: ${responseText.slice(0, 200)}`);
      }

      const data = JSON.parse(responseText);
      const codigo = data.codigo_respuesta ?? data.codigoRespuesta;
      if (codigo !== 0 && codigo !== undefined) {
        throw new Error(data.descripcion_respuesta || data.mensajeRespuesta || `Código ${codigo}`);
      }

      return {
        saldo: data.saldo ?? 0,
        codigoRespuesta: codigo ?? 0,
        mensajeRespuesta: data.descripcion_respuesta ?? data.mensajeRespuesta ?? 'OK',
      };
    } catch (error) {
      console.error('Error querying balance from MT Center:', error);
      const msg = error instanceof Error ? error.message : 'No se pudo consultar el saldo';
      throw new Error(msg);
    }
  }

  /**
   * Query transaction - emisores/consultaReferencia (by referencia1+sku) or legacy numeroTicket
   * Doc: consultaReferencia uses referencia1, sku. For ticket lookup we try numeroTicket as referencia1.
   */
  async queryReference(numeroTicket: string) {
    try {
      const token = await this.authenticate();
      const response = await fetch(`${this.mtCenterApiUrl}/emisores/consultaReferencia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ referencia1: numeroTicket, sku: '' }),
      });

      if (!response.ok) {
        throw new Error(`Failed to query reference: ${response.status}`);
      }

      const data = await response.json();
      const codigo = data.codigo_respuesta ?? data.codigoRespuesta;
      return {
        transaction: data,
        codigoRespuesta: codigo,
        mensajeRespuesta: data.descripcion_respuesta ?? data.mensajeRespuesta,
      };
    } catch (error) {
      console.error('Error querying reference from MT Center:', error);
      throw new Error('No se pudo consultar la referencia');
    }
  }

  /**
   * Query a specific transaction (legacy method for compatibility)
   */
  async queryTransaction(noTransaccion: number) {
    // For bill payments, we use queryReference with numeroTicket
    return this.queryReference(noTransaccion.toString());
  }

  /**
   * Get error message from MT Center bill payment response code
   */
  private getServiceErrorMessage(codigo: number): string {
    const errorMessages: Record<number, string> = {
      0: 'Proceso ejecutado correctamente',
      1: 'Error no esperado por la aplicación, verificación comunicación del punto de venta',
      2: 'El número de tienda no está registrado dentro de la plataforma PagoExpress',
      3: 'Error de conexión o desconexión con el servidor PX',
      4: 'La transacción fue denegada por el proveedor',
      5: 'La transacción no puede ser atendida por error de proceso',
      8: 'No contesto el servidor PX o se interrumpió la comunicación',
      9: 'No existe movimiento original de la transacción',
      10: 'No se logró reversar la operación',
      12: 'La transacción no es válida para el proveedor',
      13: 'Longitud de la referencia no cuadro con el DV o no es válida para el servicio a pagar',
      15: 'Código del producto del servicio no existe o no está activado',
      16: 'Error de acceso a la BD',
      17: 'Error al escribir en la base de datos PagoExpress',
      18: 'Importe en la referencia invalido',
      19: 'El número de ticket no es válido para la plataforma',
      20: 'El pago no puede ser aplicado por políticas de cobranza del proveedor',
      21: 'Posible duplicación dentro de la plataforma',
      30: 'Error en el formato de la mensajera enviada en la solicitud',
      34: 'Sospecha de fraude al realizar el pago dentro de la plataforma',
      60: 'Los parámetros enviados para registrar la sucursal en la plataforma no cumplen con el formato establecido',
      // Application response codes
      [-1]: 'Código de producto inválido',
      [-2]: 'La tienda/Terminal no está registrada',
      [-3]: 'Uso futuro',
      [-4]: 'Denegada. La transacción no aplica',
      [-5]: 'Cadena sin Saldo',
      [-6]: 'Error Indeterminado en Aplicación',
      [-7]: 'Error de Base de Datos',
      [-8]: 'Error de Autenticación',
      [-9]: 'Parámetros Incorrectos',
      // Códigos adicionales de autenticación
      [-505]: 'Usuario inactivo - Las credenciales están desactivadas en MT Center',
      [-500]: 'Error de autenticación - Credenciales inválidas',
    };
    
    return errorMessages[codigo] || `Error desconocido (código: ${codigo})`;
  }

  /**
   * Get payment history for the user
   */
  async getPaymentHistory(userId: string) {
    try {
      const transactions = await this.supabaseService.getTransactions(userId, {
        type: 'payment',
      });

      // Filter MT Center payments (those with metadata.providerId)
      const mtCenterPayments = transactions
        .filter((t: any) => t.metadata?.providerId)
        .map((t: any) => ({
          transactionId: t.id,
          reference: t.reference,
          amount: t.amount,
          providerName: t.metadata.providerId,
          status: t.status === 'completed' ? 'completed' : 'pending',
          timestamp: t.created_at,
        }));

      return { payments: mtCenterPayments };
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw new Error('No se pudo obtener el historial de pagos');
    }
  }
}

