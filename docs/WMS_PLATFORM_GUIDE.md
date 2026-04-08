# 📘 WMS Taco Bell Guatemala — Guía de Plataforma v3.0

**Versión:** 3.0  
**Fecha:** 8 de Abril 2026  
**Equipo:** Movida TCI  
**Clasificación:** Documento interno confidencial

---

## 📋 Tabla de Contenido

1. [Infraestructura de Producción](#1-infraestructura-de-producción)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Variables de Entorno](#3-variables-de-entorno)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Base de Datos (25 Modelos)](#5-base-de-datos-25-modelos)
6. [Módulos Funcionales](#6-módulos-funcionales)
7. [PWA Mobile (iOS / Android / Zebra)](#7-pwa-mobile)
8. [Integración Dynamics 365 Business Central](#8-integración-dynamics-365)
9. [Cron Job — Sync Automático](#9-cron-job--sync-automático)
10. [Flujo de Inventario (Entrada / Salida / Capacidad)](#10-flujo-de-inventario)
11. [Seguridad y Autenticación](#11-seguridad-y-autenticación)
12. [Comandos Útiles](#12-comandos-útiles)
13. [Troubleshooting](#13-troubleshooting)
14. [Changelog v3.0](#14-changelog-v30)

---

## 1. Infraestructura de Producción

| Servicio | Plataforma | URL | Tecnología |
|---|---|---|---|
| **Frontend** | Vercel | `https://wms-movida.vercel.app` | React 18 + Vite 6 + TypeScript |
| **Dominio Custom** | Vercel | `https://wms-360plus.movidatci.com` | CNAME via SiteGround |
| **Backend** | Render | `https://wms-movida.onrender.com` | NestJS 11 + TypeScript |
| **Base de Datos** | Supabase | PostgreSQL (AWS) | Prisma ORM v7.6 |
| **Repositorio** | GitHub | `github.com/mov1datc1/wms_movida` | Git (main branch) |
| **Email** | SMTP propio | `mail.movidatci.com:465` | Nodemailer (SSL) |
| **ERP** | Microsoft | Dynamics 365 Business Central | API REST + OAuth2 |

### CI/CD (Despliegue Automático)

```
git push origin main
       │
       ├──► Vercel detecta push
       │    └─ build frontend (~30s) → deploy automático
       │    └─ PWA manifest + service worker incluidos
       │
       └──► Render detecta push
            └─ npm install --include=dev
            └─ npx prisma generate
            └─ npx nest build
            └─ node dist/src/main → deploy (~2min)
            └─ Cron auto-sync arranca automáticamente
```

### Dominio Personalizado (SiteGround → Vercel)

```
DNS en SiteGround:
  CNAME  wms-360plus  →  a1b1a835fc1d9787.vercel-dns-017.com
  TTL: 1 hora

Vercel:
  wms-360plus.movidatci.com → proyecto wms-movida
  SSL: automático (Let's Encrypt)
```

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO FINAL                            │
│         (Desktop / iPhone / Android / Zebra TC22)           │
└───────────────┬─────────────────────────────┬───────────────┘
                │ HTTPS                       │ PWA
                ▼                             ▼
┌───────────────────────┐     ┌───────────────────────────────┐
│   Vercel (Frontend)   │     │  Mobile Bottom Nav + Menu     │
│   React + Vite + TS   │     │  Glassmorphism UI             │
│   PWA Manifest        │     │  iOS Safe-Area Support        │
└───────────┬───────────┘     └───────────────────────────────┘
            │ REST API
            ▼
┌───────────────────────┐     ┌───────────────────────────────┐
│   Render (Backend)    │────►│  @nestjs/schedule             │
│   NestJS 11           │     │  Cron: c/30min Lun-Sáb        │
│   11 Controllers      │     │  Auto-sync Dynamics 365       │
│   Prisma ORM          │     └───────────────────────────────┘
└───────────┬───────────┘
            │
     ┌──────┴──────┐
     ▼              ▼
┌──────────┐  ┌────────────────┐
│ Supabase │  │ Dynamics 365   │
│ Postgres │  │ Business       │
│ 25 tablas│  │ Central (API)  │
└──────────┘  └────────────────┘
```

---

## 3. Variables de Entorno

### Backend (Render)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | PostgreSQL (Supabase) | `postgresql://postgres.xxx:pass@aws...com:5432/postgres` |
| `JWT_SECRET` | Clave para firmar tokens JWT | `wms-tb-gt-secret-2026` |
| `SMTP_HOST` | Servidor de correo saliente | `mail.movidatci.com` |
| `SMTP_PORT` | Puerto SMTP (SSL) | `465` |
| `SMTP_USER` | Email de envío | `wms@movidatci.com` |
| `SMTP_PASS` | Contraseña SMTP | `(configuración interna)` |
| `NODE_ENV` | Entorno | `production` |

> **Nota:** Las credenciales de Dynamics 365 ya NO se manejan como variables de entorno. Se guardan en la base de datos (tabla `IntegrationConfig`) a través de la interfaz **Sync Dynamics → Configuración**. Esto las hace persistentes ante reinicios de Render.

### Frontend (Vercel)

| Variable | Descripción | Valor |
|---|---|---|
| `VITE_API_URL` | URL del backend | `https://wms-movida.onrender.com/api` |

---

## 4. Estructura del Proyecto

```
wms_movida/
├── wms-frontend/                       # React 18 + Vite 6
│   ├── public/
│   │   ├── manifest.json              # PWA manifest
│   │   ├── sw.js                      # Service Worker
│   │   ├── icon-192.png               # App icon 192×192
│   │   └── icon-512.png               # App icon 512×512
│   ├── src/
│   │   ├── config/api.ts              # URL centralizada del backend
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx         # Autenticación JWT + roles
│   │   │   └── WarehouseContext.tsx    # CEDIS activo (multi-almacén)
│   │   ├── components/
│   │   │   └── Layout/
│   │   │       ├── Sidebar.tsx         # Navegación desktop (>768px)
│   │   │       ├── TopBar.tsx          # Barra superior desktop
│   │   │       ├── MobileNav.tsx       # ★ Nav móvil: bottom bar + slide-up menu
│   │   │       └── AppLayout.tsx       # Layout wrapper (desktop + mobile)
│   │   └── pages/ (14 páginas)
│   │       ├── Login.tsx               # Login + OTP SuperAdmin
│   │       ├── Dashboard.tsx           # Panel principal con KPIs
│   │       ├── Inventory.tsx           # Stock por lote (FEFO)
│   │       ├── Locations.tsx           # Ubicaciones CEDIS (mapa visual)
│   │       ├── Receiving.tsx           # Recepción contra OC (★ toggle sin vencimiento)
│   │       ├── Picking.tsx             # Picking FEFO inteligente
│   │       ├── Dispatch.tsx            # Despacho + tracking + firma
│   │       ├── CycleCount.tsx          # ★ Conteo cíclico con ajuste automático
│   │       ├── Traceability.tsx        # Rastreo de lotes completo
│   │       ├── LabelPreview.tsx        # Etiquetado QR/Barcode térmico
│   │       ├── MasterData.tsx          # SKUs y datos maestros
│   │       ├── QualityRules.tsx        # Reglas de calidad
│   │       ├── DynamicsSync.tsx        # Sync bidireccional con BC
│   │       └── AdminPanel.tsx          # Roles, usuarios, CEDIS, RBAC
│   ├── index.css                       # ★ Design System v2 + Mobile CSS
│   ├── vercel.json                     # SPA rewrite para Vercel
│   └── package.json
│
├── wms-backend/                        # NestJS 11
│   ├── src/
│   │   ├── main.ts                    # Bootstrap + CORS + globalPrefix
│   │   ├── app.module.ts             # Módulo raíz + ScheduleModule
│   │   ├── prisma.service.ts         # Prisma client singleton
│   │   └── modules/
│   │       ├── auth/                  # JWT + OTP + RBAC
│   │       ├── users/                 # Gestión de usuarios
│   │       ├── master-data/           # SKUs maestros
│   │       ├── inventory/             # Stock, lotes, movimientos
│   │       ├── operations/            # Recepción, picking, despacho, conteo cíclico
│   │       └── integrations/          # Dynamics 365 Business Central
│   │           ├── dynamics.service.ts        # HTTP client + OAuth2 + demo mode
│   │           ├── dynamics-sync.service.ts   # Sync bidireccional (6 entidades)
│   │           ├── dynamics-cron.service.ts   # ★ Auto-sync c/30min (Lun-Sáb)
│   │           ├── dynamics.controller.ts     # REST endpoints
│   │           └── integrations.module.ts     # NestJS module
│   ├── prisma/
│   │   ├── schema.prisma              # ★ 25 modelos
│   │   ├── prisma.config.ts           # pg adapter para Supabase
│   │   └── seed.ts                    # Seed de datos demo
│   └── package.json
│
├── docs/
│   ├── WMS_PLATFORM_GUIDE.md          # ★ Este documento (v3.0)
│   ├── DYNAMICS_365_INTEGRATION.md    # Guía detallada de integración
│   └── COST_PLAN.md                   # Plan de costos operativos
│
└── render.yaml                         # Config de Render (build + start)
```

---

## 5. Base de Datos (25 Modelos)

### Diagrama de Entidades

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Warehouse   │     │   SkuMaster  │     │  Restaurante  │
│  (CEDIS)     │     │  (Productos) │     │  (Destinos)   │
└──────┬───────┘     └──────┬───────┘     └───────┬───────┘
       │                     │                     │
       │              ┌──────┴───────┐      ┌──────┴──────────┐
       │              │ LotInventory │      │ OutboundOrder    │
       │              │ (Stock real) │      │ (Pedidos venta)  │
       │              └──────┬───────┘      │ OutboundOrderLine│
       │                     │              │ DispatchTracking │
       │              ┌──────┴───────┐      └─────────────────┘
       │              │ HandlingUnit │
       │              │ (Pallets/HU) │
       │              └──────────────┘
       │
┌──────┴───────┐     ┌──────────────┐     ┌───────────────┐
│  Location    │     │ InboundOrder │     │  CycleCount   │
│  (Ubicaciones│     │ (OC Compra)  │     │  (Conteos)    │
│   con zonas) │     │ InboundLine  │     │  CycleCountLine│
└──────────────┘     └──────────────┘     └───────────────┘
       
┌──────────────┐     ┌──────────────┐     ┌───────────────┐
│ InventoryMov.│     │  AuditLog    │     │  QualityRule  │
│ (Trazabilidad│     │  (Auditoría) │     │  (Calidad)    │
└──────────────┘     └──────────────┘     └───────────────┘

┌──────────────┐     ┌──────────────┐     ┌───────────────┐
│  User        │     │  SyncLog     │     │ IntegrationCfg│
│  Role        │     │  DynamicsMap │     │ (Credenciales)│
│  RolePerm.   │     │              │     │ PlatformSettin│
│  OtpCode     │     │              │     │  TraceLink    │
└──────────────┘     └──────────────┘     └───────────────┘
```

### Modelos principales

| # | Modelo | Descripción | Campos clave |
|---|--------|-------------|-------------|
| 1 | `Warehouse` | CEDIS/Bodegas | nombre, tipo, activo |
| 2 | `SkuMaster` | Catálogo de productos | codigoDynamics, descripcion, categoria, temperaturaRequerida |
| 3 | `Restaurante` | Destinos de despacho | nombre, zona, activo |
| 4 | `Location` | Ubicaciones físicas | codigo, zona, capacidad, **ocupacion**, **estado** |
| 5 | `LotInventory` | Stock real por lote | lote, fechaVencimiento, **cantidadDisponible**, ubicacionId |
| 6 | `HandlingUnit` | Pallets/Cajas | tipoHu, cantidad, ubicacionActual |
| 7 | `InventoryMovement` | Historial de movimientos | tipoMovimiento (ENTRADA/SALIDA/TRANSFERENCIA), from/to |
| 8 | `InboundOrder` | Órdenes de compra (BC) | numeroDynamics, proveedor, estado |
| 9 | `InboundOrderLine` | Líneas de OC | cantidadEsperada, cantidadRecibida, estado |
| 10 | `OutboundOrder` | Pedidos de venta | origenDynamics, restauranteId, despachador |
| 11 | `OutboundOrderLine` | Líneas de pedido | cantidadSolicitada, cantidadAsignada |
| 12 | `DispatchTracking` | Tracking en ruta | estado, usuario, latitud, longitud, firmaBase64 |
| 13 | `TraceabilityLink` | Rastreo de cadena | loteOrigen → loteDestino |
| 14 | `AuditLog` | Log de auditoría | usuario, accion, entidad, detalle |
| 15 | `QualityRule` | Reglas de calidad | sku, regla, accion, activo |
| 16 | `User` | Usuarios del sistema | email, passwordHash, warehouseId |
| 17 | `Role` | Roles (Admin, Operador...) | nombre, permisos |
| 18 | `RolePermission` | Permisos granulares | modulo, accion (read/write/delete) |
| 19 | `PlatformSettings` | Config global | clave, valor |
| 20 | `OtpCode` | Códigos OTP email | codigo, expiresAt, usado |
| 21 | `SyncLog` | Historial de syncs | tipo, entidad, registros, estado |
| 22 | `DynamicsMapping` | Mapeo BC↔WMS | entidadBC, idBC, entidadWMS, idWMS |
| 23 | `IntegrationConfig` | Credenciales BC | clave, valor (encriptado) |
| 24 | `CycleCount` | Conteos cíclicos | estado, ubicaciones, ajustesAplicados |
| 25 | `CycleCountLine` | Líneas de conteo | stockSistema, stockContado, discrepancia |

---

## 6. Módulos Funcionales

### 6.1 Dashboard
- KPIs en tiempo real: total SKUs, stock, alertas de vencimiento
- Gráficos de distribución por zona y movimientos recientes
- Alertas de lotes próximos a vencer (FEFO)

### 6.2 Inventario — Stock por Lote
- Vista consolidada de todo el stock con filtros por SKU, lote, ubicación
- Estado de calidad (LIBERADO, CUARENTENA, BLOQUEADO)
- Fechas de vencimiento con indicadores visuales (verde/amarillo/rojo)

### 6.3 Ubicaciones CEDIS
- Mapa visual del almacén con celdas coloreadas por ocupación
- Zonas: RECIBO, PICKING, RESERVA, STAGING, CUARENTENA, QUÍMICOS
- Control de temperatura por zona: AMBIENTE, REFRIGERADO, CONGELADO
- **Capacidad dinámica:** se actualiza automáticamente con entradas y salidas ✅

### 6.4 Recepción de Mercancía
- Recepción contra Órdenes de Compra sincronizadas de BC
- Asignación inteligente de ubicación (putaway por zona/temperatura)
- Registro de lote, fecha de vencimiento, proveedor, HU
- **Toggle "Sin Vencimiento":** Asigna fecha `2099-12-31` para insumos no perecederos ✅
- Estados: PENDIENTE → PARCIAL → COMPLETO
- Movimiento de tipo ENTRADA generado automáticamente

### 6.5 Picking FEFO
- Selección automática de lotes con menor fecha de vencimiento (FEFO)
- Vista de sugerencias por ubicación con cantidad disponible
- Confirmación línea por línea
- Cambio de estado: PENDIENTE → EN_PICKING → CONSOLIDADO

### 6.6 Despacho a Restaurantes
- Consolidación de pedidos listos
- Formulario de despacho: despachador + placa de vehículo
- **Descuento automático de inventario al despachar (FEFO)** ✅
- **Liberación automática de ubicaciones vacías** ✅
- Tracking en ruta con estados: SALIDA_CEDIS → EN_RUTA → ENTREGADO
- Captura de firma del receptor + nombre
- Movimientos de tipo SALIDA generados para trazabilidad

### 6.7 Conteo Cíclico
- Creación de conteos por ubicaciones seleccionadas
- Auto-carga del stock del sistema como referencia
- Registro del conteo físico línea por línea
- Cálculo automático de discrepancias
- **Ajuste automático de stock al cerrar conteo** ✅
- Trazabilidad de ajustes en `AuditLog`

### 6.8 Etiquetado
- Generación de QR Code + Barcode (Code128) por lote
- Formato optimizado para impresoras térmicas 4"×2"
- Vista previa e impresión directa desde navegador

### 6.9 Trazabilidad
- Rastreo completo de la cadena: proveedor → recepción → ubicación → picking → despacho
- Historial de movimientos por lote
- Links de trazabilidad (lote origen → lote destino)

### 6.10 Datos Maestros
- CRUD de SKUs con código Dynamics, categoría, UoM, temperatura
- Sincronización con catálogo de Items de BC

### 6.11 Reglas de Calidad
- Reglas configurables por SKU/categoría
- Acciones: bloquear, alertar, cuarentena

### 6.12 Sync Dynamics 365
- Panel de control con sync individual por entidad
- Sincronización completa (full sync)
- Historial de ejecuciones con estado y duración
- Configuración de credenciales vía interfaz (persiste en DB)
- Ver sección [8. Integración Dynamics 365](#8-integración-dynamics-365)

### 6.13 Administración
- Gestión de usuarios con roles (SuperAdmin, Admin, Operador, Visor)
- Permisos granulares por módulo y acción
- Gestión de CEDIS/Bodegas
- Configuración de plataforma

---

## 7. PWA Mobile

### Compatibilidad

| Dispositivo | Navegador | PWA | Estado |
|---|---|---|---|
| iPhone (iOS 15+) | Safari → Agregar a pantalla de inicio | ✅ App icon + splash | Producción |
| Android | Chrome → Instalar app | ✅ App icon + splash | Producción |
| Zebra TC22 | Chrome | ✅ App icon | Producción |
| Desktop | Chrome/Edge | ✅ | Producción |

### Navegación Móvil

En pantallas menores a 768px:

- **Se oculta:** Sidebar desktop + TopBar
- **Se muestra:** Bottom Navigation Bar (5 botones)

```
┌─────────────────────────────────────┐
│          Contenido de la página      │
│                                      │
│                                      │
│                                      │
├─────────────────────────────────────┤
│  🏠      📥       📦      🚚    ☰  │
│ Inicio  Recepción Picking Despacho Menú│
└─────────────────────────────────────┘
```

**Botón ☰ Menú** → Abre slide-up fullscreen con:
- Tarjeta de usuario + logout
- Todas las secciones: Inventario, Operaciones, Trazabilidad, Admin
- Indicador de página activa

### Responsive Design

| Componente | Desktop | Mobile |
|---|---|---|
| Stat Cards | 4 columnas, texto izquierda | 2 columnas, centradas |
| Tablas | Scroll horizontal | Padding compacto, font 10px |
| Dispatch Cards | Inline: título + botones | Flex-wrap: se apilan |
| Formularios | Grid 3 columnas | auto-fit, full-width |
| Inputs | Normal | `font-size: 16px` (no zoom iOS), `min-height: 44px` |
| Tabs | Flex wrap | Scroll horizontal, scrollbar oculto |
| Modals | 60% width | 95% width |
| Filtros | Horizontal | Stack vertical |

---

## 8. Integración Dynamics 365

### Entidades sincronizadas

| Dirección | BC → WMS | Entidad BC | Entidad WMS |
|---|---|---|---|
| INBOUND | Items | `items` | `SkuMaster` |
| INBOUND | Customers | `customers` | `Restaurante` |
| INBOUND | Vendors | `vendors` | (referencia en OC) |
| INBOUND | Purchase Orders | `purchaseOrders` | `InboundOrder` + `InboundOrderLine` |
| INBOUND | Sales Orders | `salesOrders` | `OutboundOrder` + `OutboundOrderLine` |
| OUTBOUND | Recepciones Confirmadas | `InboundOrder` | → Purchase Receipt (BC) |
| OUTBOUND | Despachos Confirmados | `OutboundOrder` | → Sales Shipment (BC) |
| OUTBOUND | Ajustes de Inventario | `InventoryMovement` | → Item Journal (BC) |

### Autenticación (OAuth2 / Azure AD)

```
WMS Backend                    Azure AD                    Business Central
     │                            │                              │
     │  1. POST /oauth2/token     │                              │
     │    client_id + secret      │                              │
     │ ─────────────────────────► │                              │
     │                            │                              │
     │  2. Bearer token (1h)      │                              │
     │ ◄───────────────────────── │                              │
     │                            │                              │
     │  3. GET /api/v2.0/items    │                              │
     │    Authorization: Bearer   │                              │
     │ ──────────────────────────────────────────────────────────►│
     │                            │                              │
     │  4. JSON response          │                              │
     │ ◄──────────────────────────────────────────────────────────│
```

### Credenciales (almacenadas en DB)

| Credencial | Tabla | Clave |
|---|---|---|
| Tenant ID | `IntegrationConfig` | `DYNAMICS_TENANT_ID` |
| Client ID | `IntegrationConfig` | `DYNAMICS_CLIENT_ID` |
| Client Secret | `IntegrationConfig` | `DYNAMICS_CLIENT_SECRET` |
| Environment | `IntegrationConfig` | `DYNAMICS_ENVIRONMENT` |
| Company ID | `IntegrationConfig` | `DYNAMICS_COMPANY_ID` |

> **Importante:** Las credenciales se configuran desde la interfaz (Sync Dynamics → Configuración → Editar) y persisten en la base de datos. No se pierden con reinicios de Render.

### Costos de sincronización

**$0.00 adicional.** Azure AD viene incluido con la licencia de Business Central. Las llamadas API a tu propio BC son gratuitas. El límite de Microsoft es ~6,000 llamadas/5 minutos. Nuestro uso es ~5 llamadas cada 30 minutos (<0.05% del límite).

---

## 9. Cron Job — Sync Automático

### Configuración

| Parámetro | Valor |
|---|---|
| **Frecuencia** | Cada 30 minutos (a las :00 y :30) |
| **Días** | Lunes a Sábado |
| **Horario** | 6:00 AM - 8:00 PM (hora Guatemala, CST / UTC-6) |
| **Entidades** | Items, Customers, Vendors, Purchase Orders, Sales Orders |
| **Usuario de auditoría** | `auto-cron` |
| **Requisito** | Solo corre si Dynamics está configurado (no en demo mode) |
| **Tecnología** | `@nestjs/schedule` + decorador `@Cron()` |

### Archivo: `dynamics-cron.service.ts`

```
🕐 6:00 AM Guatemala (12:00 UTC)  → Sync arranca
🔄 6:00  → Items, Customers, Vendors, POs, SOs
🔄 6:30  → Items, Customers, Vendors, POs, SOs
🔄 7:00  → ...
   ...
🔄 19:30 → Última sync del día
🌙 20:00 → Se detiene hasta mañana
```

### Sync Manual

El cron NO reemplaza el sync manual. Los botones en **Sync Dynamics → Panel de Control** siguen funcionando para forzar una sincronización inmediata en cualquier momento.

---

## 10. Flujo de Inventario

### Ciclo completo de entrada y salida

```
📥 ENTRADA (Recepción)
─────────────────────────────────
1. Recibe mercancía contra OC de BC
2. Crea LotInventory (cantidadDisponible = qty)
3. Crea HandlingUnit (pallet/caja)
4. Asigna Location (putaway inteligente)
5. Location.ocupacion++, estado = OCUPADO
6. Crea InventoryMovement tipo ENTRADA
7. Actualiza InboundOrderLine (parcial/completo)

📦 ALMACENAMIENTO
─────────────────────────────────
• Stock visible en "Stock por Lote"
• Ubicación visible en "Ubicaciones CEDIS"
• Conteos cíclicos verifican stock vs. físico

🔄 TRANSFERENCIA
─────────────────────────────────
1. Origen: decrementa lote (o mueve completo)
2. Destino: incrementa/crea lote
3. Origen Location: si vacía → DISPONIBLE ✅
4. Destino Location: ocupacion++ ✅
5. Crea InventoryMovement tipo TRANSFERENCIA

📤 SALIDA (Despacho)
─────────────────────────────────
1. Picking FEFO selecciona lotes (menor vencimiento primero)
2. Confirmar despacho:
   a. Itera líneas del pedido
   b. Busca lotes por SKU con FEFO
   c. Decrementa cantidadDisponible ✅
   d. Si lote queda en 0:
      - Verifica si la ubicación tiene otros lotes activos
      - Si no → Location = DISPONIBLE, ocupacion = 0 ✅
      - Si sí → ocupacion-- ✅
   e. Crea InventoryMovement tipo SALIDA ✅
   f. Actualiza OutboundOrderLine.cantidadAsignada ✅
3. Tracking en ruta: SALIDA_CEDIS → EN_RUTA → ENTREGADO

📊 CONTEO CÍCLICO (Ajustes)
─────────────────────────────────
1. Carga stock del sistema como referencia
2. Operador registra conteo físico
3. Sistema calcula discrepancia
4. Al cerrar: ajusta cantidadDisponible usando FEFO ✅
5. Genera AuditLog con detalle del ajuste
```

---

## 11. Seguridad y Autenticación

### Roles del sistema

| Rol | Acceso |
|---|---|
| **SuperAdmin** | Todo + gestión de roles y permisos + config CEDIS |
| **Admin** | Todo excepto gestión de SuperAdmin |
| **Operador** | Recepción, Picking, Despacho, Conteo, Inventario |
| **Visor** | Solo lectura en todos los módulos |

### Autenticación

- **Login:** Email + contraseña (bcrypt hash)
- **SuperAdmin:** Requiere OTP adicional enviado por email (SMTP)
- **JWT:** Token firmado con expiración de 24 horas
- **RBAC:** Permisos granulares por módulo (read/write/delete)

### Datos sensibles

- Contraseñas: bcrypt con salt automático
- Client Secret de Azure: almacenado en DB, mostrado como `••••••••` en la interfaz
- JWT Secret: variable de entorno en Render
- CORS: solo permite orígenes autorizados

---

## 12. Comandos Útiles

### Desarrollo local

```bash
# Frontend
cd wms-frontend
npm install
npm run dev              # → http://localhost:5173

# Backend
cd wms-backend
npm install
npx prisma generate      # Genera Prisma Client
npx prisma db push       # Aplica schema a la BD
npm run start:dev         # → http://localhost:3001
```

### Base de datos

```bash
cd wms-backend
npx prisma db push        # Aplica cambios del schema (sin migration files)
npx prisma studio         # UI visual de la BD (http://localhost:5555)
npx tsx prisma/seed.ts    # Re-ejecuta seed de datos demo
npx prisma db push --force-reset && npm run db:seed  # Reset total
```

### Deploy a producción

```bash
git add -A
git commit -m "feat/fix: descripción"
git push origin main
# Vercel y Render se actualizan automáticamente
```

### Build commands de producción

```bash
# Render (build)
npm install --include=dev && npx prisma generate && npm run build

# Render (start)
npm run start:prod     # → node dist/src/main

# Vercel (automático)
npm run build          # → vite build
```

### Verificación rápida

```bash
# Estado del backend
curl https://wms-movida.onrender.com/api/dynamics/status

# Historial de syncs
curl https://wms-movida.onrender.com/api/dynamics/sync/history?limit=5

# Trigger sync manual (POST)
curl -X POST https://wms-movida.onrender.com/api/dynamics/sync/sales-orders
```

---

## 13. Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| Frontend no conecta al backend | `VITE_API_URL` incorrecta | Verificar en Vercel que contiene `/api` al final |
| Build de Render falla con `nest not found` | Falta `--include=dev` | Agregar flag al build command |
| Build de Render falla con TS errors | Imports no usados | Fix: remover imports o agregar tipos |
| Login falla en producción | `DATABASE_URL` o `JWT_SECRET` incorrectos | Verificar variables en Render |
| OTP no llega por correo | SMTP variables incorrectas | Verificar `SMTP_*` en Render |
| Render se duerme (free tier) | Normal en plan gratuito | Primer request tarda ~30s |
| Dynamics en modo "demo" | Credenciales no configuradas | Ir a Sync Dynamics → Configuración → Guardar credenciales |
| **Sales Order no aparece en WMS** | Sync no ejecutado o Demo mode | Verificar `mode` en `/api/dynamics/status`. Re-guardar credenciales si dice `demo` |
| Ubicación no se libera al despachar | Bug corregido en v3.0 | Actualizar a v3.0 (commit `c686aa8`) |
| PWA no muestra nav en móvil | Cache del Service Worker | Eliminar PWA → Safari → "Agregar a pantalla de inicio" de nuevo |
| iOS zoom al enfocar input | `font-size` menor a 16px | Corregido en v3.0: inputs usan `font-size: 16px` |
| Dominio custom dice "Invalid" | DNS en propagación | Esperar 15-30 min, luego Refresh en Vercel |

---

## 14. Changelog v3.0

### Novedades en esta versión

| Feature | Descripción | Commit |
|---|---|---|
| 📱 **Mobile Nav** | Bottom tab bar + slide-up menu para PWA (iOS/Android) | `6c7b360` |
| 🎨 **Mobile Polish** | Cards centradas, tabs scrollables, inputs 44px, flex-wrap | `3c909df` |
| 🔄 **Auto-Sync Cron** | Sync Dynamics cada 30min, Lun-Sáb 6am-8pm Guatemala | `c1efdbc` |
| 📦 **Inventory Decrement** | Despacho descuenta stock vía FEFO y libera ubicaciones | `c686aa8` |
| 🔀 **Transfer Fix** | Transferencias ahora actualizan ocupación origen/destino | `c686aa8` |
| 🔑 **Credenciales en DB** | Dynamics creds se guardan en PostgreSQL (no env vars) | Anteriormente |
| 🏷️ **Sin Vencimiento** | Toggle en recepción para asignar fecha 2099-12-31 | Anteriormente |
| 📊 **Conteo Cíclico** | Ajuste automático de stock al cerrar conteo | Anteriormente |

### Versiones anteriores

| Versión | Fecha | Highlights |
|---|---|---|
| **v2.0** | Abril 2026 | Integración Dynamics 365 bidireccional, multi-CEDIS, RBAC, OTP |
| **v1.0** | Marzo 2026 | Arquitectura base: 18 modelos, recepción, picking, despacho, etiquetado |

---

*Documento confidencial — Movida TCI © 2026*
*Última actualización: 8 de Abril 2026 — v3.0*
