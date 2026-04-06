# 📘 Documentación Técnica: Integración WMS ↔ Microsoft Dynamics 365

**Proyecto:** WMS Taco Bell Guatemala  
**Versión:** 2.0  
**Fecha:** Abril 2026  
**Autor:** Equipo Movida TCI  
**Estado:** Producción (Modo Demo) — Listo para conexión Live  

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura de la Integración](#2-arquitectura-de-la-integración)
3. [Guía: Crear Cuenta Business Central Trial](#3-guía-crear-cuenta-business-central-trial)
4. [Guía: Registrar App en Azure (Microsoft Entra ID)](#4-guía-registrar-app-en-azure-microsoft-entra-id)
5. [Guía: Configurar Permisos en Business Central](#5-guía-configurar-permisos-en-business-central)
6. [Variables de Entorno](#6-variables-de-entorno)
7. [API Endpoints del WMS](#7-api-endpoints-del-wms)
8. [Mapeo de Entidades (Dynamics ↔ WMS)](#8-mapeo-de-entidades-dynamics--wms)
9. [Flujo de Autenticación OAuth 2.0](#9-flujo-de-autenticación-oauth-20)
10. [Código Fuente — Estructura de Archivos](#10-código-fuente--estructura-de-archivos)
11. [Base de Datos — Modelos de Integración](#11-base-de-datos--modelos-de-integración)
12. [Modos de Operación (Demo vs Live)](#12-modos-de-operación-demo-vs-live)
13. [Monitoreo y Troubleshooting](#13-monitoreo-y-troubleshooting)
14. [Seguridad](#14-seguridad)
15. [Roadmap de Mejoras](#15-roadmap-de-mejoras)

---

## 1. Resumen Ejecutivo

El módulo de integración conecta el WMS (Warehouse Management System) de Taco Bell Guatemala con **Microsoft Dynamics 365 Business Central** de forma bidireccional:

| Dirección | Qué se sincroniza | Frecuencia |
|---|---|---|
| **Dynamics → WMS** (Inbound) | Items, Customers, Vendors, Purchase Orders, Sales Orders | Cada 15 min (configurable) o manual |
| **WMS → Dynamics** (Outbound) | Recepciones confirmadas, Despachos, Ajustes de inventario | En tiempo real o manual |

### Stack Tecnológico

| Componente | Tecnología |
|---|---|
| **Backend** | NestJS (TypeScript) en Render |
| **Frontend** | React + Vite en Vercel |
| **Base de Datos** | PostgreSQL en Supabase |
| **ERP** | Microsoft Dynamics 365 Business Central |
| **Autenticación** | OAuth 2.0 Client Credentials (Azure Entra ID) |
| **API** | Business Central REST API v2.0 |

---

## 2. Arquitectura de la Integración

```
┌──────────────────────────┐
│    FRONTEND (Vercel)      │
│    wms-movida.vercel.app  │
│                           │
│  DynamicsSync.tsx         │
│  - Status badge           │
│  - Sync buttons           │
│  - History table          │
│  - Config panel           │
└───────────┬───────────────┘
            │ HTTPS (fetch)
            ▼
┌──────────────────────────────────────────────────────────┐
│    BACKEND (Render) — wms-movida.onrender.com            │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ DynamicsController (api/dynamics/*)                 │ │
│  │  GET  /status          → Estado de conexión         │ │
│  │  POST /sync/full       → Sync completo              │ │
│  │  POST /sync/items      → Solo items                 │ │
│  │  POST /sync/customers  → Solo clientes              │ │
│  │  POST /sync/vendors    → Solo proveedores           │ │
│  │  POST /push/receipts   → Enviar recepciones         │ │
│  │  POST /push/dispatches → Enviar despachos           │ │
│  │  GET  /sync/history    → Historial                  │ │
│  │  GET  /sync/stats      → Estadísticas               │ │
│  └──────────┬──────────────────────────────────────────┘ │
│             │                                            │
│  ┌──────────▼──────────┐   ┌──────────────────────────┐ │
│  │ DynamicsService     │   │ DynamicsSyncService      │ │
│  │ - OAuth 2.0 tokens  │   │ - Lógica de mapeo        │ │
│  │ - GET/POST/PATCH    │◄──│ - Upsert a BD            │ │
│  │ - Token caching     │   │ - Logging de sync        │ │
│  │ - Demo mode data    │   │ - Error handling         │ │
│  └──────────┬──────────┘   └──────────────────────────┘ │
│             │                          │                 │
└─────────────┼──────────────────────────┼─────────────────┘
              │ OAuth 2.0               │ Prisma ORM
              ▼                          ▼
┌──────────────────┐          ┌──────────────────┐
│  Azure Entra ID  │          │  Supabase        │
│  (Token Server)  │          │  PostgreSQL      │
│                  │          │                  │
│  login.          │          │  Tables:         │
│  microsoftonline │          │  - SyncLog       │
│  .com            │          │  - DynamicsMapp. │
└────────┬─────────┘          │  - SkuMaster     │
         │                    │  - Restaurante   │
         │ Bearer Token       │  - etc.          │
         ▼                    └──────────────────┘
┌──────────────────┐
│  Dynamics 365    │
│  Business Central│
│                  │
│  API v2.0:       │
│  /items          │
│  /customers      │
│  /vendors        │
│  /purchaseOrders │
│  /salesOrders    │
└──────────────────┘
```

---

## 3. Guía: Crear Cuenta Business Central Trial

> ⚠️ **Requisito:** Necesitas un email de dominio empresarial (por ejemplo `tu-nombre@movidatci.com`). Gmail, Hotmail, Yahoo NO funcionan.

### Paso 3.1 — Crear el Trial

1. Abre tu navegador y ve a:  
   **https://www.microsoft.com/en-us/dynamics-365/products/business-central**

2. Click en **"Try for free"** (botón azul)

3. Ingresa tu email empresarial: `admin@movidatci.com` (o el que prefieras)

4. Si tu dominio no tiene un tenant de Microsoft 365:
   - Te pedirá crear una cuenta nueva
   - Llena: Nombre, Apellido, Teléfono, Empresa: `Movida TCI`
   - País: `Guatemala`
   - Crea un usuario: `admin@MoVidaTCI.onmicrosoft.com` (este es tu usuario admin)
   - Guarda la contraseña en un lugar seguro

5. Espera 2-3 minutos mientras Microsoft provisiona tu entorno

6. Se abrirá **Business Central** en: `https://businesscentral.dynamics.com`

### Paso 3.2 — Configurar Business Central

1. En Business Central, usa la barra de búsqueda (lupa arriba) y escribe **"Companies"**
2. Verás una compañía demo creada (ej. "CRONUS US")
3. Anota el nombre — lo necesitarás luego

4. Busca **"API Setup"** en la barra de búsqueda
5. Click en **"Integrate"** para habilitar todas las APIs
6. Espera que termine (1-2 minutos)

### Paso 3.3 — Obtener el Company ID

1. Abre una nueva pestaña del navegador
2. Ve a:  
   `https://api.businesscentral.dynamics.com/v2.0/environments`
3. Inicia sesión con tu cuenta admin
4. Verás algo como:
   ```json
   {
     "value": [
       {
         "name": "Production",
         "type": "Production",
         "aadTenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
       }
     ]
   }
   ```
5. El `aadTenantId` es tu **DYNAMICS_TENANT_ID** — ¡cópialo!
6. El `name` es tu **DYNAMICS_ENVIRONMENT** (normalmente "Production")

7. Ahora ve a:  
   `https://api.businesscentral.dynamics.com/v2.0/{tu-tenant-id}/Production/api/v2.0/companies`
8. Verás las compañías con sus IDs:
   ```json
   {
     "value": [
       {
         "id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
         "name": "CRONUS US Inc."
       }
     ]
   }
   ```
9. El `id` es tu **DYNAMICS_COMPANY_ID** — ¡cópialo!

> 📋 **Checkpoint:** Ahora ya tienes:
> - ✅ Business Central funcionando
> - ✅ `DYNAMICS_TENANT_ID` (el aadTenantId)
> - ✅ `DYNAMICS_ENVIRONMENT` ("Production")
> - ✅ `DYNAMICS_COMPANY_ID` (el id de la compañía)

---

## 4. Guía: Registrar App en Azure (Microsoft Entra ID)

Esta es la parte más importante. La app registrada es la "identidad" que usa el WMS para comunicarse con Dynamics.

### Paso 4.1 — Ir al Azure Portal

1. Abre: **https://portal.azure.com**
2. Inicia sesión con la misma cuenta admin que creaste

### Paso 4.2 — Registrar la Aplicación

1. En la barra de búsqueda de Azure, escribe **"App registrations"** y selecciónalo
2. Click en **"+ New registration"**
3. Llena los campos:
   - **Name:** `WMS Taco Bell Integración`
   - **Supported account types:** `Accounts in this organizational directory only (Single tenant)`
   - **Redirect URI:** Déjalo vacío (no lo necesitamos para Client Credentials)
4. Click **"Register"**

### Paso 4.3 — Copiar Client ID y Tenant ID

En la página que se abre después del registro:

| Campo | Dónde está | Variable de entorno |
|---|---|---|
| **Application (client) ID** | Panel principal, arriba | `DYNAMICS_CLIENT_ID` |
| **Directory (tenant) ID** | Panel principal, arriba | `DYNAMICS_TENANT_ID` |

**Cópialos ambos y guárdalos.**

### Paso 4.4 — Crear Client Secret

1. En el menú lateral izquierdo, click en **"Certificates & secrets"**
2. Click en **"+ New client secret"**
3. Descripción: `WMS Backend - Producción`
4. Expira en: **24 months** (o lo que prefieras)
5. Click **"Add"**

> ⚠️ **IMPORTANTE:** Copia el **Value** (no el Secret ID) inmediatamente. **Solo se muestra una vez.** Si lo pierdes, tendrás que crear uno nuevo.

6. El `Value` copiado es tu **DYNAMICS_CLIENT_SECRET**

### Paso 4.5 — Asignar Permisos de API

1. En el menú lateral izquierdo, click en **"API permissions"**
2. Click en **"+ Add a permission"**
3. En la lista, busca y selecciona **"Dynamics 365 Business Central"**
4. Selecciona **"Application permissions"** (NO delegated)
5. Marca el checkbox de **"Financials.ReadWrite.All"**
6. Click **"Add permissions"**
7. Click en **"✅ Grant admin consent for [tu organización]"**
8. Confirma con **"Yes"**

> 📋 **Checkpoint:** Ahora ya tienes:
> - ✅ `DYNAMICS_CLIENT_ID`
> - ✅ `DYNAMICS_CLIENT_SECRET`
> - ✅ Permisos de API concedidos

---

## 5. Guía: Configurar Permisos en Business Central

Este paso es **obligatorio** — sin él, la app puede autenticarse pero recibirá `403 Forbidden`.

### Paso 5.1 — Registrar la App en Business Central

1. Vuelve a Business Central: `https://businesscentral.dynamics.com`
2. En la barra de búsqueda, escribe **"Microsoft Entra Applications"**
3. Click en **"+ New"**
4. Pega tu **Client ID** en el campo correspondiente
5. En **Description:** escribe `WMS Backend`
6. En **State:** cambia a **"Enabled"**

### Paso 5.2 — Asignar Permission Sets

1. En la parte inferior de la ficha, sección **"User Permission Sets"**
2. Click **"+ Add"** y agrega:
   - `D365 BUS FULL ACCESS` (acceso completo a datos)
   - `D365 READ` (lectura general)
3. Guarda los cambios

> 📋 **Checkpoint Final:** Ahora ya tienes TODOS los datos:
>
> | Variable | Valor |
> |---|---|
> | `DYNAMICS_TENANT_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
> | `DYNAMICS_CLIENT_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
> | `DYNAMICS_CLIENT_SECRET` | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
> | `DYNAMICS_ENVIRONMENT` | `Production` |
> | `DYNAMICS_COMPANY_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

---

## 6. Variables de Entorno

### En el Backend (Render)

Ve a **Render → tu servicio → Environment → Add Environment Variable** y agrega:

```env
# Dynamics 365 Business Central
DYNAMICS_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DYNAMICS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DYNAMICS_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DYNAMICS_ENVIRONMENT=Production
DYNAMICS_COMPANY_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Después de agregarlas, haz **Redeploy** del servicio.

### En el Frontend (Vercel)

No se necesitan variables adicionales para Dynamics. El frontend usa la misma `VITE_API_URL` que ya está configurada.

---

## 7. API Endpoints del WMS

Base URL: `https://wms-movida.onrender.com/api/dynamics`

### Estado y Configuración

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/status` | Devuelve el estado de conexión (demo/live) |
| `GET` | `/sync/stats` | Estadísticas de sincronización |
| `GET` | `/sync/history?limit=50` | Historial de ejecuciones |

#### Ejemplo: `GET /status`
```json
{
  "configured": true,
  "mode": "live",
  "tenantId": "a1b2c3d4...",
  "environment": "Production"
}
```

### Sincronización Inbound (Dynamics → WMS)

| Método | Endpoint | Entidad |
|---|---|---|
| `POST` | `/sync/full` | Todas las entidades |
| `POST` | `/sync/items` | Items → SkuMaster |
| `POST` | `/sync/customers` | Customers → Restaurante |
| `POST` | `/sync/vendors` | Vendors → Proveedores |
| `POST` | `/sync/purchase-orders` | POs → Recepción |
| `POST` | `/sync/sales-orders` | SOs → Despacho |

#### Ejemplo: `POST /sync/full`
```json
{
  "success": true,
  "message": "Sincronización completa: 28 registros procesados",
  "totalRecords": 28,
  "results": [
    {
      "id": "f69f515a-...",
      "tipo": "INBOUND",
      "entidad": "items",
      "registros": 12,
      "estado": "SUCCESS",
      "detalle": "12 creados, 0 actualizados de 12 items",
      "duracionMs": 6077,
      "createdAt": "2026-04-06T18:00:19.068Z"
    }
  ]
}
```

### Sincronización Outbound (WMS → Dynamics)

| Método | Endpoint | Entidad |
|---|---|---|
| `POST` | `/push/receipts` | Recepciones confirmadas |
| `POST` | `/push/dispatches` | Despachos confirmados |
| `POST` | `/push/inventory-adjustments` | Ajustes de inventario |

Todos aceptan `?usuario=nombre` como query parameter opcional.

---

## 8. Mapeo de Entidades (Dynamics ↔ WMS)

### Inbound: Dynamics → WMS

| API Endpoint BC | Campos usados | Tabla WMS | Campos WMS |
|---|---|---|---|
| `/api/v2.0/items` | `number`, `displayName`, `unitOfMeasureCode`, `blocked` | `SkuMaster` | `codigoDynamics`, `descripcion`, `uomBase`, `activo` |
| `/api/v2.0/customers` | `number`, `displayName`, `addressLine1`, `city` | `Restaurante` | `nombre`, `zona`, `direccion` |
| `/api/v2.0/vendors` | `number`, `displayName`, `addressLine1` | (referencial) | Almacenado en SyncLog |
| `/api/v2.0/purchaseOrders` | `number`, `buyFromVendorName`, `status`, `orderDate` | (referencial) | Pre-prepara recepciones |
| `/api/v2.0/salesOrders` | `number`, `sellToCustomerName`, `status`, `orderDate` | `OutboundOrder` | Pre-prepara despachos |

### Outbound: WMS → Dynamics

| Tabla WMS | Datos enviados | API Endpoint BC |
|---|---|---|
| `InventoryMovement` (ENTRADA) | SKU, lote, cantidad, fecha | `itemLedgerEntries` |
| `OutboundOrder` (DESPACHADO) | Orden, líneas, restaurante | `salesShipments` |
| `InventoryMovement` (AJUSTE) | SKU, cantidad, motivo | `itemJournals` |

### Tabla de Mapeo de IDs: `DynamicsMapping`

```sql
-- Ejemplo de registro
SELECT * FROM "DynamicsMapping" WHERE entidad = 'SkuMaster';

id          | entidad    | wmsId         | dynamicsId | dynamicsNumber | lastSyncAt
--------    | ---------- | ------------- | ---------- | -------------- | ----------
uuid-1      | SkuMaster  | wms-uuid-123  | bc-001     | FRI-REF-2KG    | 2026-04-06
```

---

## 9. Flujo de Autenticación OAuth 2.0

```
WMS Backend                   Azure Entra ID              Business Central
    │                              │                            │
    │ 1. POST /oauth2/v2.0/token   │                            │
    │ ──────────────────────────►  │                            │
    │   grant_type=client_creds    │                            │
    │   client_id=xxx              │                            │
    │   client_secret=xxx          │                            │
    │   scope=https://api.         │                            │
    │   businesscentral.dynamics   │                            │
    │   .com/.default              │                            │
    │                              │                            │
    │ ◄──────────────────────────  │                            │
    │   { access_token, expires }  │                            │
    │                              │                            │
    │ 2. GET /api/v2.0/items       │                            │
    │ ─────────────────────────────────────────────────────────► │
    │   Authorization: Bearer xxx  │                            │
    │                              │                            │
    │ ◄───────────────────────────────────────────────────────── │
    │   { value: [...items] }      │                            │
    │                              │                            │
```

### Detalles del Token

- **URL del Token:** `https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token`
- **Scope:** `https://api.businesscentral.dynamics.com/.default`
- **Grant Type:** `client_credentials`
- **Duración del Token:** ~3600 segundos (1 hora)
- **Cache:** El WMS cachea el token y lo renueva 5 minutos antes de que expire

---

## 10. Código Fuente — Estructura de Archivos

```
wms-backend/
├── src/
│   └── modules/
│       └── integrations/
│           ├── integrations.module.ts       # Módulo NestJS (registra providers)
│           ├── dynamics.service.ts          # OAuth + HTTP client + Demo data
│           ├── dynamics-sync.service.ts     # Lógica de sincronización bidireccional
│           └── dynamics.controller.ts       # REST endpoints (10 rutas)
├── prisma/
│   └── schema.prisma                        # SyncLog + DynamicsMapping models
└── .env                                     # Variables de entorno
```

### `dynamics.service.ts` — Responsabilidades:
- Manejo de tokens OAuth 2.0 con caching
- Métodos HTTP genéricos: `get()`, `post()`, `patch()`
- Detección automática de modo Demo vs Live (`isConfigured()`)
- Datos mock realistas para demos

### `dynamics-sync.service.ts` — Responsabilidades:
- `runFullSync()` — Ejecuta todas las sincronizaciones secuencialmente
- `syncItems()` — Items → SkuMaster (create or update)
- `syncCustomers()` — Customers → Restaurante (create or update)
- `syncVendors()` — Registra proveedores disponibles
- `syncPurchaseOrders()` — Detecta OC pendientes
- `syncSalesOrders()` — Detecta pedidos pendientes
- `pushReceipts()` — Envía recepciones confirmadas a Dynamics
- `pushDispatches()` — Envía despachos a Dynamics
- `pushInventoryAdjustments()` — Envía ajustes
- `getSyncHistory()` — Consulta historial de logs
- `getSyncStats()` — Retorna estadísticas agregadas

### `dynamics.controller.ts` — Rutas expuestas:
- 10 endpoints bajo `/api/dynamics/*`
- Ver sección 7 para documentación completa de cada uno

---

## 11. Base de Datos — Modelos de Integración

### `SyncLog` — Registro de cada sincronización

```prisma
model SyncLog {
  id              String   @id @default(uuid())
  tipo            String   // INBOUND o OUTBOUND
  entidad         String   // items, customers, vendors, etc.
  registros       Int      @default(0)
  estado          String   // SUCCESS, ERROR, PARTIAL
  detalle         String?  // Mensaje descriptivo o error
  usuario         String?  // Quién lo disparó (null = automático)
  duracionMs      Int?     // Tiempo de ejecución en ms
  createdAt       DateTime @default(now())
}
```

### `DynamicsMapping` — Relación de IDs bidireccional

```prisma
model DynamicsMapping {
  id              String   @id @default(uuid())
  entidad         String   // SkuMaster, Restaurante, etc.
  wmsId           String   // UUID en nuestra BD
  dynamicsId      String   // ID en Dynamics 365
  dynamicsNumber  String?  // Número legible (ej: FRI-REF-2KG)
  lastSyncAt      DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([entidad, wmsId])       // Un registro WMS → un registro Dynamics
  @@unique([entidad, dynamicsId])  // Un registro Dynamics → un registro WMS
}
```

---

## 12. Modos de Operación (Demo vs Live)

### Modo Demo 🎭

- **Cuándo:** Las variables `DYNAMICS_*` están vacías
- **Comportamiento:** Usa datos mock realistas (12 SKUs de TB Guatemala, 5 restaurantes, 4 proveedores, etc.)
- **Uso:** Demos para clientes, pruebas de frontend, desarrollo local
- **El badge muestra:** "🎭 Modo Demo — Datos simulados"

### Modo Live 🟢

- **Cuándo:** Las 5 variables `DYNAMICS_*` están configuradas
- **Comportamiento:** Conecta vía OAuth a la API real de Business Central
- **Uso:** Producción, pruebas de integración real
- **El badge muestra:** "🟢 Live — Tenant a1b2c3d4..."

### Cambiar de Demo a Live:

1. Agregar las 5 variables en Render (ver sección 6)
2. Redeploy el servicio
3. El cambio es automático — no se requiere cambiar código

---

## 13. Monitoreo y Troubleshooting

### Verificar estado de conexión

```bash
curl https://wms-movida.onrender.com/api/dynamics/status
```

Respuesta esperada en modo Live:
```json
{ "configured": true, "mode": "live", "tenantId": "a1b2c3d4...", "environment": "Production" }
```

### Ver últimas sincronizaciones

```bash
curl https://wms-movida.onrender.com/api/dynamics/sync/history?limit=10
```

### Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `OAuth failed: AADSTS700016` | Client ID incorrecto | Verificar `DYNAMICS_CLIENT_ID` en Azure Portal |
| `OAuth failed: AADSTS7000215` | Client Secret incorrecto o expirado | Crear nuevo secret en Azure > Certificates & secrets |
| `403 Forbidden` en API calls | Permisos no configurados en BC | Ir a Business Central → Microsoft Entra Applications → verificar que la app esté **Enabled** y tenga `D365 BUS FULL ACCESS` |
| `404 Not Found` en `/items` | Company ID incorrecto | Verificar `DYNAMICS_COMPANY_ID` usando la URL de companies (ver sección 3.3) |
| `401 Unauthorized` | Token expirado (no debería pasar) | El servicio renueva automáticamente. Si persiste, reiniciar el servicio en Render |
| `Timeout 30s` | API de BC lenta | Reintentar. Si es recurrente, considerar aumentar timeout en `dynamics.service.ts` línea 26 |

### Logs del servidor

En Render → tu servicio → Logs, busca mensajes con:
- `✅ Dynamics 365 OAuth token obtained successfully` → OK
- `❌ Failed to obtain Dynamics token` → Error de autenticación
- `✅ Items sync: X created, Y updated` → Sync exitoso
- `❌ Items sync failed:` → Error en sync

---

## 14. Seguridad

### Buenas prácticas implementadas

1. **Client Secret** solo en variables de entorno del servidor (nunca en código ni frontend)
2. **Token caching** para minimizar llamadas a Azure
3. **CORS** configurado para permitir solo dominios autorizados
4. **Sin credenciales en logs** — los logs muestran estados pero nunca tokens ni secrets
5. **Tenant ID truncado** en la respuesta del frontend (solo muestra los primeros 8 caracteres)

### Rotación de secretos

Los Client Secrets de Azure expiran. Procedimiento para rotar:

1. Ir a Azure Portal → App registrations → tu app → Certificates & secrets
2. Crear un **nuevo** secret antes de que el actual expire
3. Actualizar `DYNAMICS_CLIENT_SECRET` en Render
4. Redeploy
5. Verificar que funciona con `GET /api/dynamics/status`
6. Eliminar el secret antiguo de Azure

### Si el cliente usa F&O en lugar de Business Central

Los cambios necesarios serían:
- **Token URL:** igual (Azure Entra ID)
- **Scope:** cambiar a `https://fin-ops-url.operations.dynamics.com/.default`
- **Base URL:** cambiar a la URL de la instancia F&O del cliente
- **API Format:** OData en lugar de REST v2.0 (similar pero con diferencias en filtros y paginación)
- **Mapeo de entidades:** Las tablas de F&O tienen nombres diferentes (ej: `ReleasedProducts` en vez de `items`)

---

## 15. Roadmap de Mejoras

### Fase 2 — Automatización (próximo sprint)
- [ ] Cron job cada 15 minutos para sync automático (NestJS `@Cron()`)
- [ ] Webhook de Business Central para sincronización en tiempo real
- [ ] Retry automático con backoff exponencial para errores transitorios

### Fase 3 — Integración profunda
- [ ] Crear Purchase Orders en Dynamics desde recepciones del WMS
- [ ] Actualizar estado de Sales Orders al despachar
- [ ] Sincronizar Item Ledger Entries para trazabilidad completa
- [ ] Reportes de conciliación WMS vs Dynamics

### Fase 4 — Observabilidad
- [ ] Dashboard de salud de la integración en el WMS
- [ ] Alertas por email cuando un sync falla 3 veces seguidas
- [ ] Métricas de latencia de API

---

## Contacto y Soporte

| Rol | Contacto |
|---|---|
| **Arquitecto WMS** | Equipo Movida TCI |
| **Email técnico** | wms@movidatci.com |
| **Repositorio** | https://github.com/mov1datc1/wms_movida |
| **Frontend prod** | https://wms-movida.vercel.app |
| **Backend prod** | https://wms-movida.onrender.com |

---

*Documento generado para el equipo de desarrollo y mantenimiento de la plataforma WMS Taco Bell Guatemala. Confidencial.*
