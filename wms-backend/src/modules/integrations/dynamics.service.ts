import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service.js';
import axios, { AxiosInstance } from 'axios';

/**
 * DynamicsService — Handles OAuth 2.0 authentication and HTTP communication
 * with Microsoft Dynamics 365 Business Central API v2.0
 * 
 * Configuration priority:
 *   1. IntegrationConfig from DB (editable from UI)
 *   2. Environment variables (fallback)
 *   3. Demo mode (if neither is configured)
 */
@Injectable()
export class DynamicsService {
  private readonly logger = new Logger(DynamicsService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private httpClient: AxiosInstance;

  // Active configuration (loaded on demand)
  private activeTenantId: string = '';
  private activeClientId: string = '';
  private activeClientSecret: string = '';
  private activeEnvironment: string = 'production';
  private activeCompanyId: string = '';
  private configLoaded: boolean = false;

  constructor(private prisma: PrismaService) {
    this.httpClient = axios.create({
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Load configuration from DB first, then env vars as fallback.
   * Called lazily on first use and can be force-refreshed.
   */
  async loadConfig(force = false): Promise<void> {
    if (this.configLoaded && !force) return;

    try {
      const dbConfig = await this.prisma.integrationConfig.findUnique({
        where: { provider: 'dynamics365' },
      });

      if (dbConfig && dbConfig.isActive && dbConfig.tenantId && dbConfig.clientId && dbConfig.clientSecret) {
        this.activeTenantId = dbConfig.tenantId;
        this.activeClientId = dbConfig.clientId;
        this.activeClientSecret = dbConfig.clientSecret;
        this.activeEnvironment = dbConfig.environment || 'production';
        this.activeCompanyId = dbConfig.companyId || '';
        this.logger.log('✅ Dynamics config loaded from database (UI-configured)');
      } else {
        // Fallback to env vars
        this.activeTenantId = process.env['DYNAMICS_TENANT_ID'] || '';
        this.activeClientId = process.env['DYNAMICS_CLIENT_ID'] || '';
        this.activeClientSecret = process.env['DYNAMICS_CLIENT_SECRET'] || '';
        this.activeEnvironment = process.env['DYNAMICS_ENVIRONMENT'] || 'production';
        this.activeCompanyId = process.env['DYNAMICS_COMPANY_ID'] || '';
        if (this.activeTenantId) {
          this.logger.log('✅ Dynamics config loaded from environment variables');
        }
      }
    } catch (error) {
      // If DB fails, fallback to env
      this.activeTenantId = process.env['DYNAMICS_TENANT_ID'] || '';
      this.activeClientId = process.env['DYNAMICS_CLIENT_ID'] || '';
      this.activeClientSecret = process.env['DYNAMICS_CLIENT_SECRET'] || '';
      this.activeEnvironment = process.env['DYNAMICS_ENVIRONMENT'] || 'production';
      this.activeCompanyId = process.env['DYNAMICS_COMPANY_ID'] || '';
    }

    this.configLoaded = true;
  }

  /** Check if Dynamics credentials are configured */
  isConfigured(): boolean {
    return !!(this.activeTenantId && this.activeClientId && this.activeClientSecret);
  }

  /** Ensure config is loaded before checking */
  async ensureConfigLoaded(): Promise<void> {
    await this.loadConfig();
  }

  /** Get connection status */
  async getStatus(): Promise<{
    configured: boolean;
    mode: 'live' | 'demo';
    tenantId: string;
    environment: string;
    configSource: 'database' | 'environment' | 'none';
  }> {
    await this.loadConfig();

    let configSource: 'database' | 'environment' | 'none' = 'none';
    try {
      const dbConfig = await this.prisma.integrationConfig.findUnique({
        where: { provider: 'dynamics365' },
      });
      if (dbConfig?.isActive && dbConfig.tenantId && dbConfig.clientId && dbConfig.clientSecret) {
        configSource = 'database';
      } else if (process.env['DYNAMICS_TENANT_ID'] && process.env['DYNAMICS_CLIENT_ID'] && process.env['DYNAMICS_CLIENT_SECRET']) {
        configSource = 'environment';
      }
    } catch { /* ignore */ }

    return {
      configured: this.isConfigured(),
      mode: this.isConfigured() ? 'live' : 'demo',
      tenantId: this.activeTenantId ? `${this.activeTenantId.slice(0, 8)}...` : 'N/A',
      environment: this.activeEnvironment,
      configSource,
    };
  }

  // =====================================================
  //  INTEGRATION CONFIG CRUD (UI-editable)
  // =====================================================

  /** Get current integration config (secrets masked) */
  async getConfig(): Promise<any> {
    const dbConfig = await this.prisma.integrationConfig.findUnique({
      where: { provider: 'dynamics365' },
    });

    if (dbConfig) {
      return {
        id: dbConfig.id,
        provider: dbConfig.provider,
        tenantId: dbConfig.tenantId || '',
        clientId: dbConfig.clientId || '',
        clientSecret: dbConfig.clientSecret ? '●●●●●●●●●●●●●●●●' : '',
        clientSecretSet: !!dbConfig.clientSecret,
        environment: dbConfig.environment,
        companyId: dbConfig.companyId || '',
        isActive: dbConfig.isActive,
        lastTestedAt: dbConfig.lastTestedAt,
        lastTestResult: dbConfig.lastTestResult,
        updatedBy: dbConfig.updatedBy,
        updatedAt: dbConfig.updatedAt,
        configSource: 'database',
      };
    }

    // Return env var status if no DB config
    const envConfigured = !!(process.env['DYNAMICS_TENANT_ID'] && process.env['DYNAMICS_CLIENT_ID'] && process.env['DYNAMICS_CLIENT_SECRET']);
    return {
      id: null,
      provider: 'dynamics365',
      tenantId: process.env['DYNAMICS_TENANT_ID'] || '',
      clientId: process.env['DYNAMICS_CLIENT_ID'] ? '●●●●●●●●' : '',
      clientSecret: process.env['DYNAMICS_CLIENT_SECRET'] ? '●●●●●●●●●●●●●●●●' : '',
      clientSecretSet: !!process.env['DYNAMICS_CLIENT_SECRET'],
      environment: process.env['DYNAMICS_ENVIRONMENT'] || 'production',
      companyId: process.env['DYNAMICS_COMPANY_ID'] || '',
      isActive: envConfigured,
      lastTestedAt: null,
      lastTestResult: null,
      updatedBy: null,
      updatedAt: null,
      configSource: envConfigured ? 'environment' : 'none',
    };
  }

  /** Save or update integration config */
  async updateConfig(data: {
    tenantId: string;
    clientId: string;
    clientSecret?: string; // Optional — only update if provided (not masked value)
    environment: string;
    companyId: string;
    isActive: boolean;
    updatedBy?: string;
  }): Promise<any> {
    const updateData: any = {
      tenantId: data.tenantId,
      clientId: data.clientId,
      environment: data.environment,
      companyId: data.companyId,
      isActive: data.isActive,
      updatedBy: data.updatedBy || 'system',
    };

    // Only update secret if a real value was provided (not the masked placeholder)
    if (data.clientSecret && !data.clientSecret.includes('●')) {
      updateData.clientSecret = data.clientSecret;
    }

    const config = await this.prisma.integrationConfig.upsert({
      where: { provider: 'dynamics365' },
      create: {
        provider: 'dynamics365',
        ...updateData,
        clientSecret: data.clientSecret || '',
      },
      update: updateData,
    });

    // Force reload config
    this.configLoaded = false;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    await this.loadConfig(true);

    this.logger.log(`✅ Integration config updated by ${data.updatedBy}`);

    return {
      success: true,
      message: 'Configuración guardada exitosamente',
      isActive: config.isActive,
    };
  }

  /**
   * Test connection with given or current credentials.
   * Tries to obtain an OAuth token without saving anything.
   */
  async testConnection(credentials?: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    environment: string;
    companyId: string;
  }): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const tenantId = credentials?.tenantId || this.activeTenantId;
    const clientId = credentials?.clientId || this.activeClientId;
    let clientSecret = credentials?.clientSecret || this.activeClientSecret;
    const environment = credentials?.environment || this.activeEnvironment;
    const companyId = credentials?.companyId || this.activeCompanyId;

    if (!tenantId || !clientId || !clientSecret) {
      return {
        success: false,
        message: 'Faltan credenciales: Tenant ID, Client ID y Client Secret son obligatorios.',
      };
    }

    // If the secret is masked, try to get the real one from DB
    if (clientSecret.includes('●')) {
      const dbConfig = await this.prisma.integrationConfig.findUnique({
        where: { provider: 'dynamics365' },
      });
      if (dbConfig?.clientSecret) {
        clientSecret = dbConfig.clientSecret;
      } else {
        clientSecret = process.env['DYNAMICS_CLIENT_SECRET'] || '';
      }
      if (!clientSecret) {
        return {
          success: false,
          message: 'No se pudo obtener el Client Secret. Por favor ingresa el valor real.',
        };
      }
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    try {
      // Step 1: Try to get OAuth token
      const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://api.businesscentral.dynamics.com/.default',
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });

      const token = tokenResponse.data.access_token;
      if (!token) {
        throw new Error('Token vacío recibido de Azure');
      }

      // Step 2: Try to hit the BC API to verify company access
      let companyInfo = null;
      if (companyId) {
        try {
          const baseUrl = `https://api.businesscentral.dynamics.com/v2.0/${tenantId}/${environment}/api/v2.0/companies(${companyId})`;
          const companyResponse = await this.httpClient.get(baseUrl, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          });
          companyInfo = {
            name: companyResponse.data.name,
            displayName: companyResponse.data.displayName,
          };
        } catch (apiError: any) {
          return {
            success: false,
            message: `✅ OAuth exitoso, pero ❌ Company ID inválido: ${apiError.response?.data?.error?.message || apiError.message}`,
            details: { oauthOk: true, companyOk: false },
          };
        }
      }

      // Save test result to DB
      await this.prisma.integrationConfig.upsert({
        where: { provider: 'dynamics365' },
        create: {
          provider: 'dynamics365',
          tenantId, clientId, clientSecret, environment, companyId,
          lastTestedAt: new Date(),
          lastTestResult: 'SUCCESS',
        },
        update: {
          lastTestedAt: new Date(),
          lastTestResult: 'SUCCESS',
        },
      });

      return {
        success: true,
        message: `✅ Conexión exitosa — OAuth OK${companyInfo ? `, Company: "${companyInfo.displayName || companyInfo.name}"` : ''}`,
        details: { oauthOk: true, companyOk: !!companyInfo, company: companyInfo },
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.error_description || error.response?.data?.error?.message || error.message;

      // Save failed test result
      try {
        await this.prisma.integrationConfig.upsert({
          where: { provider: 'dynamics365' },
          create: {
            provider: 'dynamics365',
            tenantId, clientId, clientSecret, environment, companyId,
            lastTestedAt: new Date(),
            lastTestResult: `FAILED: ${errorMsg}`,
          },
          update: {
            lastTestedAt: new Date(),
            lastTestResult: `FAILED: ${errorMsg}`,
          },
        });
      } catch { /* ignore */ }

      this.logger.error(`❌ Connection test failed: ${errorMsg}`);

      return {
        success: false,
        message: `❌ Error de conexión: ${errorMsg}`,
        details: { oauthOk: false },
      };
    }
  }

  /**
   * Get OAuth 2.0 access token using Client Credentials flow
   * Token is cached until 5 minutes before expiry
   */
  async getAccessToken(): Promise<string> {
    await this.loadConfig();

    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 300000) {
      return this.accessToken;
    }

    if (!this.isConfigured()) {
      throw new Error('Dynamics 365 credentials not configured. Set DYNAMICS_TENANT_ID, DYNAMICS_CLIENT_ID, DYNAMICS_CLIENT_SECRET env vars or configure from UI.');
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.activeTenantId}/oauth2/v2.0/token`;

    try {
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.activeClientId,
        client_secret: this.activeClientSecret,
        scope: 'https://api.businesscentral.dynamics.com/.default',
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
      this.logger.log('✅ Dynamics 365 OAuth token obtained successfully');
      return this.accessToken!;
    } catch (error: any) {
      this.logger.error(`❌ Failed to obtain Dynamics token: ${error.response?.data?.error_description || error.message}`);
      throw new Error(`OAuth failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /** Base URL for Business Central API v2.0 */
  private getBaseUrl(): string {
    return `https://api.businesscentral.dynamics.com/v2.0/${this.activeTenantId}/${this.activeEnvironment}/api/v2.0/companies(${this.activeCompanyId})`;
  }

  /**
   * GET request to Dynamics 365 API
   */
  async get<T = any>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/${endpoint}`;

    try {
      const response = await this.httpClient.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`GET ${endpoint} failed: ${error.response?.data?.error?.message || error.message}`);
      throw error;
    }
  }

  /**
   * POST request to Dynamics 365 API
   */
  async post<T = any>(endpoint: string, data: any): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/${endpoint}`;

    try {
      const response = await this.httpClient.post(url, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`POST ${endpoint} failed: ${error.response?.data?.error?.message || error.message}`);
      throw error;
    }
  }

  /**
   * PATCH request to Dynamics 365 API
   */
  async patch<T = any>(endpoint: string, data: any, etag?: string): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/${endpoint}`;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (etag) headers['If-Match'] = etag;

    try {
      const response = await this.httpClient.patch(url, data, { headers });
      return response.data;
    } catch (error: any) {
      this.logger.error(`PATCH ${endpoint} failed: ${error.response?.data?.error?.message || error.message}`);
      throw error;
    }
  }

  // =====================================================
  //  DEMO MODE — Mock data for demos without credentials
  // =====================================================

  getDemoItems(): any[] {
    return [
      { id: 'bc-001', number: 'FRI-REF-2KG', displayName: 'Frijoles Refritos 2Kg', type: 'Inventory', unitOfMeasureCode: 'KG', unitPrice: 45.50, blocked: false },
      { id: 'bc-002', number: 'TOR-MAI-30', displayName: 'Tortillas de Maíz x30', type: 'Inventory', unitOfMeasureCode: 'PQT', unitPrice: 22.00, blocked: false },
      { id: 'bc-003', number: 'SAL-TOM-5L', displayName: 'Salsa Roja Tomate 5L', type: 'Inventory', unitOfMeasureCode: 'GAL', unitPrice: 78.00, blocked: false },
      { id: 'bc-004', number: 'QUE-CHE-5K', displayName: 'Queso Cheddar 5Kg', type: 'Inventory', unitOfMeasureCode: 'KG', unitPrice: 185.00, blocked: false },
      { id: 'bc-005', number: 'CAR-MOL-10K', displayName: 'Carne Molida Premium 10Kg', type: 'Inventory', unitOfMeasureCode: 'KG', unitPrice: 320.00, blocked: false },
      { id: 'bc-006', number: 'ARR-BLA-25K', displayName: 'Arroz Blanco 25Kg', type: 'Inventory', unitOfMeasureCode: 'SACO', unitPrice: 155.00, blocked: false },
      { id: 'bc-007', number: 'LEC-HUG-GAL', displayName: 'Lechuga Iceberg', type: 'Inventory', unitOfMeasureCode: 'UND', unitPrice: 12.50, blocked: false },
      { id: 'bc-008', number: 'CRE-AGR-1L', displayName: 'Crema Agria 1L', type: 'Inventory', unitOfMeasureCode: 'LT', unitPrice: 35.00, blocked: false },
      { id: 'bc-009', number: 'JAL-VER-2K', displayName: 'Jalapeños Verdes 2Kg', type: 'Inventory', unitOfMeasureCode: 'KG', unitPrice: 28.00, blocked: false },
      { id: 'bc-010', number: 'ACE-VEG-20L', displayName: 'Aceite Vegetal 20L', type: 'Inventory', unitOfMeasureCode: 'BIDON', unitPrice: 240.00, blocked: false },
      { id: 'bc-011', number: 'NAC-QUE-5K', displayName: 'Nachos con Queso 5Kg', type: 'Inventory', unitOfMeasureCode: 'KG', unitPrice: 95.00, blocked: false },
      { id: 'bc-012', number: 'GUA-FRE-1K', displayName: 'Guacamole Fresco 1Kg', type: 'Inventory', unitOfMeasureCode: 'KG', unitPrice: 65.00, blocked: false },
    ];
  }

  getDemoCustomers(): any[] {
    return [
      { id: 'rc-001', number: 'REST-001', displayName: 'Taco Bell Zona 10', addressLine1: 'Blvd Los Próceres 18-24, Zona 10', city: 'Guatemala' },
      { id: 'rc-002', number: 'REST-002', displayName: 'Taco Bell Miraflores', addressLine1: 'CC Miraflores, Calzada Roosevelt', city: 'Guatemala' },
      { id: 'rc-003', number: 'REST-003', displayName: 'Taco Bell Pradera', addressLine1: 'CC Pradera Concepción, Km 14.5', city: 'Villa Nueva' },
      { id: 'rc-004', number: 'REST-004', displayName: 'Taco Bell Oakland Mall', addressLine1: 'Oakland Mall, Diagonal 6', city: 'Guatemala' },
      { id: 'rc-005', number: 'REST-005', displayName: 'Taco Bell Portales', addressLine1: 'CC Portales, Zona 17', city: 'Guatemala' },
    ];
  }

  getDemoVendors(): any[] {
    return [
      { id: 'vd-001', number: 'PROV-001', displayName: 'Fresh Produce GT', addressLine1: 'Zona 12, Guatemala', phoneNumber: '2234-5678' },
      { id: 'vd-002', number: 'PROV-002', displayName: 'Distribuidora La Criolla', addressLine1: 'Mixco, Guatemala', phoneNumber: '2456-7890' },
      { id: 'vd-003', number: 'PROV-003', displayName: 'Cárnica Centroamericana', addressLine1: 'Amatitlán, Guatemala', phoneNumber: '2345-6789' },
      { id: 'vd-004', number: 'PROV-004', displayName: 'Aceites del Pacífico S.A.', addressLine1: 'Escuintla', phoneNumber: '7888-9012' },
    ];
  }

  getDemoPurchaseOrders(): any[] {
    return [
      { id: 'po-001', number: 'OC-2026-0045', buyFromVendorName: 'Fresh Produce GT', status: 'Open', orderDate: '2026-04-06', currencyCode: 'GTQ', totalAmountIncludingTax: 15250.00 },
      { id: 'po-002', number: 'OC-2026-0046', buyFromVendorName: 'Distribuidora La Criolla', status: 'Open', orderDate: '2026-04-06', currencyCode: 'GTQ', totalAmountIncludingTax: 8700.00 },
      { id: 'po-003', number: 'OC-2026-0047', buyFromVendorName: 'Cárnica Centroamericana', status: 'Released', orderDate: '2026-04-05', currencyCode: 'GTQ', totalAmountIncludingTax: 32000.00 },
    ];
  }

  getDemoSalesOrders(): any[] {
    return [
      { id: 'so-001', number: 'PED-2026-0089', sellToCustomerName: 'Taco Bell Zona 10', status: 'Open', orderDate: '2026-04-06', currencyCode: 'GTQ', totalAmountIncludingTax: 4500.00 },
      { id: 'so-002', number: 'PED-2026-0090', sellToCustomerName: 'Taco Bell Miraflores', status: 'Open', orderDate: '2026-04-06', currencyCode: 'GTQ', totalAmountIncludingTax: 6200.00 },
      { id: 'so-003', number: 'PED-2026-0091', sellToCustomerName: 'Taco Bell Pradera', status: 'Released', orderDate: '2026-04-05', currencyCode: 'GTQ', totalAmountIncludingTax: 3800.00 },
      { id: 'so-004', number: 'PED-2026-0092', sellToCustomerName: 'Taco Bell Oakland Mall', status: 'Open', orderDate: '2026-04-06', currencyCode: 'GTQ', totalAmountIncludingTax: 5100.00 },
    ];
  }
}
