import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from './admin.service';

describe('AdminService - updateExternalTransferStatus', () => {
  const makeService = (adminClient: any) => {
    const supabaseServiceMock: any = {
      getAdminClient: jest.fn().mockReturnValue(adminClient),
      getClient: jest.fn().mockReturnValue(adminClient),
    };

    const service = new AdminService(
      supabaseServiceMock,
      {} as JwtService,
      {} as ConfigService,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service };
  };

  const buildClient = (state: { existing?: any; updated?: any; latest?: any; updateError?: any }) => {
    let updateCallCount = 0;

    return {
      from: jest.fn().mockImplementation(() => {
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockImplementation(async () => {
            if (updateCallCount === 0) {
              return { data: state.existing ?? null, error: null };
            }
            return { data: state.latest ?? state.updated ?? null, error: null };
          }),
          update: jest.fn().mockImplementation(() => {
            updateCallCount += 1;
            return {
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({
                data: state.updated ?? null,
                error: state.updateError ?? null,
              }),
            };
          }),
        };
        return chain;
      }),
    };
  };

  it('throws 400 when status missing', async () => {
    const { service } = makeService(null);
    await expect(service.updateExternalTransferStatus('trf-1', 'admin-1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 400 when status is invalid', async () => {
    const { service } = makeService(null);
    await expect(
      service.updateExternalTransferStatus('trf-1', 'admin-1', { status: 'rejected' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates pending transfer to completed when body uses completed', async () => {
    const existing = { id: 'trf-1', status: 'pending', clabe: '012345678901234567', metadata: {} };
    const updated = { ...existing, status: 'completed' };
    const client = buildClient({ existing, updated });
    const { service } = makeService(client);

    const result = await service.updateExternalTransferStatus('trf-1', 'admin-1', { status: 'completed' });
    expect(result.status).toBe('completed');
  });

  it('updates pending transfer to completed when body uses approved (compat)', async () => {
    const existing = { id: 'trf-1', status: 'pending', clabe: '012345678901234567', metadata: {} };
    const updated = { ...existing, status: 'completed' };
    const client = buildClient({ existing, updated });
    const { service } = makeService(client);

    const result = await service.updateExternalTransferStatus('trf-1', 'admin-1', { status: 'approved' });
    expect(result.status).toBe('completed');
  });

  it('is idempotent when transfer is already completed', async () => {
    const existing = { id: 'trf-1', status: 'completed' };
    const client = buildClient({ existing });
    const { service } = makeService(client);

    const result = await service.updateExternalTransferStatus('trf-1', 'admin-1', { status: 'completed' });
    expect(result).toEqual(existing);
  });

  it('is idempotent when transfer is already approved (legacy)', async () => {
    const existing = { id: 'trf-1', status: 'approved' };
    const client = buildClient({ existing });
    const { service } = makeService(client);

    const result = await service.updateExternalTransferStatus('trf-1', 'admin-1', { status: 'completed' });
    expect(result).toEqual(existing);
  });

  it('updates completed transfer back to pending', async () => {
    const existing = { id: 'trf-1', status: 'completed', clabe: '012345678901234567', metadata: {} };
    const updated = { ...existing, status: 'pending' };
    const client = buildClient({ existing, updated });
    const { service } = makeService(client);

    const result = await service.updateExternalTransferStatus('trf-1', 'admin-1', { status: 'pending' });
    expect(result.status).toBe('pending');
  });

  it('updates from any legacy status to pending', async () => {
    const existing = { id: 'trf-1', status: 'failed', metadata: {} };
    const updated = { ...existing, status: 'pending' };
    const client = buildClient({ existing, updated });
    const { service } = makeService(client);

    const result = await service.updateExternalTransferStatus('trf-1', 'admin-1', { status: 'pending' });
    expect(result.status).toBe('pending');
  });

  it('throws 404 when transfer does not exist', async () => {
    const client = buildClient({ existing: null });
    const { service } = makeService(client);

    await expect(
      service.updateExternalTransferStatus('missing', 'admin-1', { status: 'approved' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminService - CSV reports', () => {
  const makeService = (adminClient: any) => {
    const supabaseServiceMock: any = {
      getAdminClient: jest.fn().mockReturnValue(adminClient),
      getClient: jest.fn().mockReturnValue(adminClient),
    };

    return new AdminService(
      supabaseServiceMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  };

  const buildTransactionsClient = (options: {
    branch?: { id: string; name: string } | null;
    transactions?: any[];
    earliest?: string | null;
  }) => {
    const from = jest.fn().mockImplementation((table: string) => {
      if (table === 'branches') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: options.branch ?? null,
            error: null,
          }),
        };
      }

      if (table === 'transactions') {
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: options.earliest ? { created_at: options.earliest } : null,
            error: null,
          }),
        };
        chain.then = undefined;
        Object.defineProperty(chain, 'then', {
          get() {
            return (resolve: (value: unknown) => void) =>
              resolve({ data: options.transactions ?? [], error: null });
          },
        });
        return chain;
      }

      return {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    return { from };
  };

  it('rejects invalid date format', async () => {
    const service = makeService(buildTransactionsClient({}));
    await expect(
      service.generateAbonosCsvReport({
        startDate: '01-01-2024',
        includePhone: true,
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'El formato de fecha debe ser YYYY-MM-DD',
        error: 'VALIDATION_ERROR',
        statusCode: 400,
      },
    });
  });

  it('rejects end date before start date', async () => {
    const service = makeService(buildTransactionsClient({}));
    await expect(
      service.generatePagosCsvReport({
        startDate: '2024-12-31',
        endDate: '2024-01-01',
        includePhone: false,
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'La fecha de fin debe ser posterior o igual a la fecha de inicio',
        error: 'VALIDATION_ERROR',
        statusCode: 400,
      },
    });
  });

  it('returns 404 when branch does not exist', async () => {
    const service = makeService(buildTransactionsClient({ branch: null }));
    await expect(
      service.generateAbonosCsvReport({
        branchId: 'missing-branch',
        includePhone: true,
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Sucursal no encontrada',
        error: 'NOT_FOUND',
        statusCode: 404,
      },
    });
  });

  it('returns CSV headers only when there are no transactions', async () => {
    const service = makeService(buildTransactionsClient({ transactions: [] }));
    const csv = await service.generateAbonosCsvReport({ includePhone: true });
    expect(csv).toBe('Teléfono,Monto,Tipo,Autorización,Sucursal,Fecha (México)');
  });

  it('maps transfer status to Pendiente or Completado only', async () => {
    const transfers = [
      {
        reference: 'EXT-1',
        amount: 100,
        beneficiary_name: 'Ben',
        bank_name: 'BBVA',
        clabe: '012345678901234567',
        status: 'pending',
        created_at: '2024-06-01T12:00:00.000Z',
        user: { first_name: 'Ana', last_name: 'López', phone_number: '5512345678' },
      },
      {
        reference: 'EXT-2',
        amount: 200,
        beneficiary_name: 'Ben 2',
        bank_name: 'Santander',
        clabe: '012345678901234568',
        status: 'approved',
        created_at: '2024-06-02T12:00:00.000Z',
        user: { first_name: 'Luis', last_name: 'Pérez', phone_number: '5598765432' },
      },
    ];

    const from = jest.fn().mockImplementation((table: string) => {
      if (table === 'external_transfers') {
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
        Object.defineProperty(chain, 'then', {
          get() {
            return (resolve: (value: unknown) => void) =>
              resolve({ data: transfers, error: null });
          },
        });
        return chain;
      }
      return buildTransactionsClient({}).from(table);
    });

    const service = makeService({ from });
    const csv = await service.generateTransferenciasCsvReport({ includePhone: false });
    expect(csv).toContain('Pendiente');
    expect(csv).toContain('Completado');
    expect(csv).not.toContain('Aprobado');
    expect(csv).not.toContain('Fallido');
  });
});
