# Documentación del WMS — Taco Bell Guatemala
## Warehouse Management System · Centro de Distribución (CEDIS)

---

## 1. Visión General

### 1.1 ¿Qué es el WMS?
El **WMS (Warehouse Management System)** es un sistema de gestión operativa de almacén diseñado específicamente para el CEDIS de Taco Bell Guatemala. Su función principal es controlar el **flujo físico de materias primas** — desde la recepción del proveedor hasta el despacho al restaurante — con **trazabilidad completa por lote** y gestión **FEFO (First Expired, First Out)**.

### 1.2 Problema que resuelve
| Problema Actual | Solución WMS |
|---|---|
| Sin visibilidad de trazabilidad de materias primas | Trazabilidad bidireccional por lote (forward/backward) |
| Descuadres por extracción manual de inventario | Control digital con escaneo y confirmación por operador |
| Sin regla FEFO para productos perecederos | Motor FEFO automático que sugiere lote óptimo en picking |
| Envíos a restaurantes sin control documental | Manifiestos de despacho con detalle por lote y documento |
| Sin preparación para certificaciones de trazabilidad | Registro completo para auditorías de seguridad alimentaria |

### 1.3 Arquitectura de Sistema

```
┌──────────────────┐    API REST     ┌──────────────────┐     PostgreSQL    ┌──────────────┐
│   Frontend SPA   │◄──────────────►│   Backend API    │◄────────────────►│   Base Datos │
│   React + Vite   │                │   NestJS + TS    │                  │   PostgreSQL │
└──────────────────┘                └──────────────────┘                  └──────────────┘
         ▲                                   ▲
         │ HTTPS                             │ API Integration
         ▼                                   ▼
  ┌──────────────┐                 ┌────────────────────┐
  │  Dispositivos │                │  Microsoft Dynamics │
  │  Handhelds    │                │  365 F&O / BC       │
  │  Zebra TC21   │                └────────────────────┘
  └──────────────┘
```

---

## 2. Integración con Microsoft Dynamics 365

### 2.1 Modelo de Integración

El WMS opera como **capa operativa** del almacén, mientras que Dynamics 365 mantiene el rol de **ERP administrativo**. Esto significa:

- **Dynamics 365 es el maestro de datos**: SKUs, proveedores, clientes (restaurantes), precios, órdenes de compra
- **WMS es el maestro operativo**: ubicaciones físicas, stock por lote, HU/LPN, movimientos en tiempo real
- **Sincronización bidireccional** en intervalos programados + eventos en tiempo real

### 2.2 Flujos de Datos Dynamics → WMS (Inbound)

| Entidad | Frecuencia | Trigger | Descripción |
|---|---|---|---|
| **Catálogo SKU** | Cada 4 horas | Scheduled | Sincroniza código, descripción, UoM, categoría, temperatura |
| **Proveedores** | Diaria | Scheduled | Lista actualizada de proveedores activos |
| **Restaurantes** | Diaria | Scheduled | Clientes internos (destinos de despacho) |
| **Órdenes de Compra** | Cada hora | Event + Scheduled | OC aprobadas en Dynamics para recepción |
| **Órdenes de Transferencia** | Cada hora | Event + Scheduled | Pedidos de restaurante para picking/despacho |
| **Unidades de Medida** | Diaria | Scheduled | Tabla de conversión de UoM |

### 2.3 Flujos de Datos WMS → Dynamics (Outbound)

| Entidad | Frecuencia | Trigger | Descripción |
|---|---|---|---|
| **Recepción Confirmada** | Evento | On Confirmation | Cantidad recibida, lote, fecha vencimiento |
| **Diferencias de Recibo** | Evento | On Discrepancy | Faltantes o sobrantes vs OC |
| **Ajustes de Inventario** | Evento | On Approval | Mermas, pérdidas, ajustes positivos |
| **Despacho Confirmado** | Evento | On Dispatch | Detalle por lote, cantidades, documento |
| **Inventario Consolidado** | Diaria | Scheduled | Snapshot de posiciones por SKU/Lote |
| **Trazabilidad por Documento** | Bajo demanda | Query | Cadena de custodia para auditoría |

### 2.4 Método de Conexión API

```
┌─────────────────┐                      ┌─────────────────────────┐
│    WMS Backend   │                      │  Dynamics 365 F&O / BC  │
│    (NestJS)      │                      │                         │
│                  │   ── OAuth 2.0 ──►   │  Azure AD Token         │
│  Integration     │                      │                         │
│  Module          │   ── REST API ───►   │  OData / Custom APIs    │
│                  │                      │  /data/v9.2/            │
│  sync-scheduler  │   ◄── Webhooks ──    │  Event Grid / Hooks     │
│  retry-queue     │                      │                         │
└─────────────────┘                      └─────────────────────────┘
```

**Autenticación:**
- **Protocolo**: OAuth 2.0 Client Credentials Flow
- **Proveedor**: Azure Active Directory (Entra ID)
- **Scopes**: `https://<tenant>.dynamics.com/.default`
- **Almacenamiento de secretos**: Azure Key Vault o variables de entorno cifradas

**Endpoints principales de Dynamics 365 utilizados:**

```
# Maestros
GET  /data/Items?$filter=dataAreaId eq 'TBGT'
GET  /data/Vendors
GET  /data/Customers

# Órdenes de Compra
GET  /data/PurchaseOrders?$filter=OrderStatus eq 'Approved'
POST /data/PurchaseOrderConfirmations

# Órdenes de Transferencia
GET  /data/TransferOrders?$filter=TransferStatus eq 'Pending'
POST /data/TransferOrderShipments

# Inventario
POST /data/InventoryAdjustments
GET  /data/InventoryOnHandEntities
```

### 2.5 Cola de Reintentos y Error Handling

El módulo de integración implementa:

1. **Cola de mensajes**: Cada sincronización se encola como un job
2. **Reintentos automáticos**: 3 intentos con backoff exponencial (1s, 5s, 30s)
3. **Dead Letter Queue**: Mensajes fallidos después de 3 intentos se mueven a DLQ
4. **Dashboard de monitoreo**: Panel de "Sync Dynamics" muestra estado de cada sync
5. **Alertas**: Notificación al supervisor si un sync crítico falla

### 2.6 Configuración Requerida en Dynamics 365

1. **Registrar aplicación** en Azure AD (Entra ID)
2. **Asignar permisos** de API a Dynamics 365
3. **Configurar webhooks** para eventos de OC/OT aprobadas
4. **Habilitar OData** para las entidades necesarias
5. **Crear usuario de integración** con permisos mínimos necesarios

---

## 3. Escaneo y Etiquetado

### 3.1 Hardware Recomendado

| Dispositivo | Modelo Sugerido | Uso | Cantidad |
|---|---|---|---|
| **Handheld** | Zebra TC21/TC26 | Escaneo en recepción, picking, despacho | 3-5 unidades |
| **Impresora térmica** | Zebra ZD421 / ZT411 | Etiquetas de lote, HU/LPN, ubicaciones | 2 unidades |
| **Scanner fijo** | Zebra DS2208 / Honeywell Voyager | Escritorio de verificación | 1 unidad |
| **Tablet rugged** | Samsung Tab Active4 Pro | Supervisión y consultas | 1-2 unidades |

### 3.2 Tipos de Etiquetas

#### Etiqueta de Lote (Recepción)
Se imprime al confirmar la recepción de una materia prima. Contiene:

```
┌────────────────────────────────────────────┐
│  TACO BELL WMS — CEDIS GUATEMALA           │
│                                            │
│  SKU: Salsa Taco Supreme 500g              │
│  Código: TB-SAL-001                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  LOTE: L260315A                            │
│  Producción: 2026-03-15                    │
│  Vencimiento: 2026-04-04                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Cantidad: 240 UN                          │
│  Proveedor: US Foods Guatemala             │
│  OC: PO-2026-0341                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  [Código de Barras — Code 128]             │
│        TB-SAL-001|L260315A|240             │
│                                            │
│  [QR Code]                                 │
│  → Enlace a trazabilidad WMS              │
│                                            │
│  Zona: REFRIGERADO                         │
│  Recibido: 2026-03-30 09:15 — Ana P.       │
└────────────────────────────────────────────┘
```

#### Etiqueta HU/LPN (Handling Unit)
Se adhiere a cada pallet o caja como unidad logística:

```
┌────────────────────────────────────────────┐
│  ■ HU / LPN                               │
│                                            │
│  HU-0026-0341-001                          │
│                                            │
│  Tipo: PALLET                              │
│  SKU: TB-SAL-001 — Salsa Taco Supreme      │
│  Lote: L260315A                            │
│  Cantidad: 120 UN                          │
│                                            │
│  [Código de Barras — GS1-128]              │
│        (00) 3 7612345 000001 8             │
│                                            │
│  Destino: REF-A03-R01-N2                   │
│  Fecha: 2026-03-30                         │
└────────────────────────────────────────────┘
```

#### Etiqueta de Ubicación (Rack)
Se coloca en la posición física del almacén:

```
┌──────────────────────┐
│  REF-A03-R01-N2      │
│  ━━━━━━━━━━━━━━━━━━  │
│  Zona: REFRIGERADO   │
│  Pasillo: A03        │
│  Rack: 01 · Nivel: 2 │
│                      │
│  [Código de Barras]  │
│   REF-A03-R01-N2     │
│                      │
│  Tipo: PICKING       │
│  Capacidad: 6 pallets│
└──────────────────────┘
```

### 3.3 Flujo de Escaneo por Operación

#### Recepción (Inbound)
```
1. Operador abre app WMS en handheld (Zebra TC21)
2. Selecciona "Recepción" → elige OC de Dynamics
3. Escanea código de barras del producto proveedor
   → WMS identifica SKU y pre-carga datos
4. Operador ingresa:
   - Número de lote (o escanea si viene impreso)
   - Fecha de vencimiento
   - Cantidad recibida
   - Condición (temperatura OK/NOK)
5. WMS genera:
   - Etiqueta de Lote (imprime automáticamente)
   - HU/LPN para el pallet
   - Ubicación putaway sugerida (según zona de temperatura y FEFO)
6. Operador lleva producto a ubicación, escanea ubicación para confirmar
7. WMS registra movimiento, actualiza stock, notifica Dynamics
```

#### Picking (Outbound)
```
1. Supervisor libera pedido en WMS → genera pick list FEFO
2. Operador abre pick list en handheld
3. Para cada línea:
   a. Ve ubicación sugerida → navega al pasillo
   b. Escanea código de ubicación (confirma posición)
   c. Escanea etiqueta de lote del producto
      → WMS valida que es el lote con menor vencimiento
   d. Ingresa cantidad pickeada
   e. WMS marca línea como completa
4. Si lote escaneado NO es FEFO → alerta:
   "⚠️ Lote con menor vencimiento disponible: L260315A (5d)"
   Opciones: [Cambiar lote] [Override con autorización]
5. Al completar todas las líneas → envía a zona de staging
6. Escanea ubicación de staging → confirma consolidación
```

#### Despacho (Shipping)
```
1. Consolidador verifica pedido completo en staging
2. Escanea cada HU/LPN que va en el camión
   → WMS valida vs pick list y marca como cargado
3. Al completar carga → genera documento de despacho:
   - Manifiesto con detalle por lote
   - Referencia de OT de Dynamics
   - Firma digital del consolidador
4. Confirma despacho → WMS:
   - Reduce inventario
   - Registra movimiento de salida
   - Envía confirmación a Dynamics
   - Genera trazabilidad (lote → restaurante)
```

### 3.4 Configuración del Software de Impresión

**ZPL (Zebra Programming Language):**
El WMS genera comandos ZPL directamente y los envía a la impresora por red:

```zpl
^XA
^FO50,30^A0N,30,30^FDTaco Bell WMS — CEDIS Guatemala^FS
^FO50,80^A0N,25,25^FDSKU: Salsa Taco Supreme 500g^FS
^FO50,110^A0N,25,25^FDCódigo: TB-SAL-001^FS
^FO50,160^GB700,2,2^FS
^FO50,180^A0N,35,35^FDLOTE: L260315A^FS
^FO50,230^A0N,25,25^FDVence: 2026-04-04^FS
^FO50,280^GB700,2,2^FS
^FO50,310^BY3^BCN,100,Y,N,N^FDTB-SAL-001|L260315A|240^FS
^XZ
```

**Requisitos de red:**
- Impresoras Zebra conectadas por WiFi o Ethernet al mismo VLAN del WMS
- Puerto TCP 9100 para comunicación directa
- Alternativamente: Zebra Browser Print para impresión desde web app

### 3.5 Configuración de Handhelds Zebra

| Parámetro | Valor |
|---|---|
| **Aplicación** | Progressive Web App (PWA) del WMS |
| **Navegador** | Zebra Enterprise Browser o Chrome |
| **Modo** | Kiosk Mode (una sola app) |
| **Conectividad** | WiFi 802.11ac en CEDIS |
| **Scanning** | DataWedge configurado para enviar scan a campo activo |
| **MX Profile** | Bloqueo de barra de estado, restricción de apps |

**DataWedge Configuration:**
```json
{
  "PROFILE_NAME": "WMS_TacoBell",
  "PLUGIN_CONFIG": {
    "PLUGIN_NAME": "BARCODE",
    "PARAM_LIST": {
      "scanner_input_enabled": "true",
      "decoder_code128": "true",
      "decoder_qrcode": "true",
      "decoder_ean13": "true",
      "decoder_gs1_databar": "true"
    }
  },
  "INTENT_CONFIG": {
    "intent_action": "com.wms.SCAN_RESULT",
    "intent_category": "android.intent.category.DEFAULT"
  },
  "KEYSTROKE_OUTPUT": {
    "keystroke_output_enabled": "true",
    "keystroke_output_type": "REPLACE"
  }
}
```

---

## 4. Módulos del Sistema

### 4.1 Dashboard Operativo
- KPIs en tiempo real: SKUs activos, lotes en stock, fill rate, pedidos del día
- Gráficos de movimientos, distribución por zona, despachos
- Alertas activas (vencimientos, stock bajo, bloqueos)
- Timeline de actividad del CEDIS

### 4.2 Inventario por Lote (Stock por Lote)
- Vista completa de todos los lotes con estado de calidad
- Indicadores visuales FEFO: 🔴 <7 días, 🟡 <30 días, 🟢 >30 días
- Filtros por zona (ambiente/refrigerado/congelado) y estado (liberado/cuarentena/bloqueado)
- Sorting por vencimiento, cantidad, SKU
- Bloqueo automático a 2 días de vencer

### 4.3 Recepción de Materias Primas
- Formulario de ingreso con selección de SKU, lote, vencimiento
- Validación de temperatura requerida
- Generación automática de HU/LPN
- Ubicación putaway sugerida por reglas de zona y compatibilidad
- Registro de proveedor y OC de Dynamics

### 4.4 Picking FEFO
- Cola de pedidos pendientes priorizados
- Pick list generado automáticamente con lote FEFO
- Confirmación línea por línea con progreso visual
- Override FEFO requiere autorización de supervisor
- Validación por escaneo de ubicación y lote

### 4.5 Despacho a Restaurantes
- Consolidación de pedidos completos
- Manifiesto de despacho con detalle por lote
- Verificación de completitud antes de confirmar
- Confirmación de despacho con envío a Dynamics
- Historial de despachos con trazabilidad

### 4.6 Trazabilidad de Lotes
- **Forward Trace**: Desde lote → a cuáles restaurantes fue despachado
- **Backward Trace**: Desde restaurante → qué lotes ha recibido
- Timeline visual de la cadena de custodia
- Información de proveedor, producción, almacenamiento y despacho
- Preparado para auditorías de seguridad alimentaria

### 4.7 Ubicaciones del CEDIS
- Mapa visual de ocupación del almacén
- Código de ubicación: `{ZONA}-{PASILLO}-{RACK}-{NIVEL}`
- Estados: Libre, Ocupado, Bloqueado
- Porcentaje de ocupación por ubicación
- Filtros por zona de temperatura y tipo de ubicación

### 4.8 Datos Maestros
- Catálogo de SKUs sincronizado con Dynamics
- Catálogo de ubicaciones del CEDIS
- Directorio de restaurantes Taco Bell Guatemala
- Reglas de calidad y compatibilidad de almacenaje

### 4.9 Reglas de Calidad
- FEFO obligatorio para todos los alimentos
- Incompatibilidad QUIMICO-ALIMENTO en misma ubicación
- Alérgenos en rack dedicado
- Validación de temperatura compatible en putaway
- Bloqueo automático de lotes próximos a vencer

### 4.10 Sincronización con Dynamics
- Dashboard de estado de conexión
- Flujos inbound (Dynamics → WMS) y outbound (WMS → Dynamics)
- Historial de sincronización con estados
- Botón de sincronización manual
- Control de errores y reintentos

---

## 5. Reglas de Negocio Críticas

### 5.1 FEFO (First Expired, First Out)
- En **picking**, el WMS siempre sugiere el lote con **menor fecha de vencimiento**
- Si el operador escanea un lote diferente, recibe alerta
- Override FEFO requiere autorización del supervisor con registro de motivo
- Los lotes a **2 días de vencer** se bloquean automáticamente del picking

### 5.2 Zonas de Temperatura
| Zona | Rango | Productos |
|---|---|---|
| **AMBIENTE** | 20-25°C | Tortillas, frijoles, salsas secas, empaques |
| **REFRIGERADO** | 2-8°C | Salsas frescas, quesos, vegetales |
| **CONGELADO** | -18°C a -25°C | Carnes, tortillas congeladas, pollo |

### 5.3 Incompatibilidades de Almacenaje
- ❌ QUIMICO + ALIMENTO en misma ubicación
- ❌ QUIMICO + TEXTIL
- ⚠️ ALERGENO separado por rack
- ✅ EMPAQUE + ALIMENTO compatible
- ✅ EMPAQUE + TEXTIL compatible

### 5.4 Unidades Logísticas (HU/LPN)
- Cada ingreso genera un **HU (Handling Unit)** único
- El HU agrupa: SKU, lote, cantidad, ubicación
- El HU se mueve como unidad atómica en trasiegos
- Tipos: PALLET, CAJA, BANDEJA

---

## 6. Stack Tecnológico

| Capa | Tecnología | Detalle |
|---|---|---|
| **Frontend** | React 18 + TypeScript | Single Page Application (SPA) |
| **Bundler** | Vite 5 | Hot Module Replacement |
| **Estilos** | Vanilla CSS + Variables | Design System enterprise |
| **Gráficos** | Recharts | Visualización de datos |
| **Iconos** | Lucide React | Iconografía consistente |
| **Backend** | NestJS + TypeScript | API REST modular |
| **ORM** | Prisma | Type-safe database access |
| **Base de Datos** | PostgreSQL | ACID, relacional, escalable |
| **Documentación API** | Swagger / OpenAPI | /api/docs |
| **Autenticación** | JWT + RBAC | Roles y permisos |
| **Integración** | REST + OAuth 2.0 | Dynamics 365 |

---

## 7. Estructura de URLs / Rutas

| Ruta | Página | Sección |
|---|---|---|
| `/` | Dashboard Operativo | General |
| `/inventario` | Stock por Lote | Inventario |
| `/ubicaciones` | Ubicaciones CEDIS | Inventario |
| `/recepcion` | Recepción de Materias Primas | Operaciones |
| `/picking` | Picking FEFO | Operaciones |
| `/despacho` | Despacho a Restaurantes | Operaciones |
| `/trazabilidad` | Rastreo de Lotes | Trazabilidad |
| `/maestros` | Datos Maestros | Administración |
| `/calidad` | Reglas de Calidad | Administración |
| `/dynamics` | Sincronización Dynamics | Administración |

---

## 8. Roles y Permisos

| Rol | Acceso | Operaciones |
|---|---|---|
| **Operador Recepción** | Recepción, Inventario (lectura) | Registrar ingresos, escanear, imprimir etiquetas |
| **Operador Picking** | Picking, Inventario (lectura) | Surtir pedidos, confirmar picking |
| **Consolidador** | Despacho, Inventario (lectura) | Verificar y confirmar despachos |
| **Supervisor CEDIS** | Todas las páginas | Override FEFO, ajustes, reportes, trazabilidad |
| **Administrador** | Todo + Configuración | Datos maestros, reglas, integración Dynamics |
| **Auditor** | Trazabilidad, Inventario (lectura) | Consulta de cadena de custodia |

---

## 9. Plan de Implementación

### Fase 1: MVP (8-10 semanas)
- [x] Frontend completo (10 páginas funcionales)
- [ ] Backend API con NestJS (módulos clave)
- [ ] Conexión a PostgreSQL con Prisma
- [ ] Integración con Dynamics 365 (maestros inbound)
- [ ] Flujo completo: Recepción → Putaway → Picking → Despacho

### Fase 2: Escaneo y Etiquetado (4-6 semanas)
- [ ] Configuración de handhelds Zebra TC21
- [ ] Integración con impresoras Zebra (ZPL por red)
- [ ] PWA optimizada para dispositivos móviles
- [ ] Validación por escaneo en cada operación

### Fase 3: Trazabilidad y Certificaciones (4 semanas)
- [ ] Trazabilidad bidireccional completa
- [ ] Reportes para auditoría FDA/INVIMA
- [ ] Dashboard de cumplimiento
- [ ] Exportación de datos para certificadoras

### Fase 4: Migración a Nuevo CEDIS (2027)
- [ ] Adaptación del layout de ubicaciones
- [ ] Reconfiguración de zonas y pasillos
- [ ] Capacitación de personal en nuevo espacio
- [ ] Go-live en nuevo Centro de Distribución

---

## 10. Contacto y Soporte

| Concepto | Detalle |
|---|---|
| **Cliente** | Taco Bell Guatemala |
| **CEDIS** | Centro de Distribución único |
| **ERP** | Microsoft Dynamics 365 |
| **SKUs** | ~300 materias primas + ~600 uniformes |
| **Nuevo CEDIS** | Previsto para 2027 |
| **Prioridad** | Trazabilidad alimentaria y certificaciones |

---

*Documento generado el 31 de marzo de 2026 — WMS v1.0.0*
