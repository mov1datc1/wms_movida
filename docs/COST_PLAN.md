# 💰 Plan de Costos — WMS Taco Bell Guatemala

**Proyecto:** Implementación WMS para CEDIS + Integración Dynamics 365  
**Alcance:** 500 SKUs · 1 CEDIS · 5-8 usuarios · Integración ERP  
**Moneda:** USD (con referencias en GTQ donde aplique, TC: Q7.70)  
**Fecha:** Abril 2026  
**Versión:** 1.0  

---

## Índice

1. [Costos Mensuales de Plataforma (Hosting)](#1-costos-mensuales-de-plataforma)
2. [Escenarios de Hosting (Recomendados)](#2-escenarios-de-hosting)
3. [Costo de Implementación (One-Time)](#3-costo-de-implementación)
4. [Hardware — Zebra TC22](#4-hardware--zebra-tc22)
5. [Licencias del Cliente (Dynamics 365)](#5-licencias-del-cliente-dynamics-365)
6. [Mantenimiento Anual](#6-mantenimiento-anual)
7. [Resumen Ejecutivo de Inversión](#7-resumen-ejecutivo-de-inversión)
8. [Comparación vs. Competencia](#8-comparación-vs-competencia)
9. [Estrategia de Migración Paralela](#9-estrategia-de-migración-paralela)
10. [Modelo de Precios para Clientes](#10-modelo-de-precios-para-clientes)

---

## 1. Costos Mensuales de Plataforma

### Desglose por servicio

| Servicio | Plan | Costo Mensual | Qué incluye | Notas |
|---|---|---|---|---|
| **Vercel** (Frontend) | Pro | **$20 USD** | 1 deploying seat, 100GB bandwidth, unlimited previews | Viewers ilimitados gratis |
| **Render** (Backend) | Starter | **$7 USD** | 0.5 vCPU, 512MB RAM, always-on | Suficiente para 500 SKU/1 CEDIS |
| **Supabase** (BD) | Pro | **$25 USD** | 8GB storage, 250GB bandwidth, daily backups, no pausing | Incluye $10 en compute credits |
| **Azure** (Entra ID) | Free | **$0 USD** | App registration, OAuth tokens, Entra ID Free | Sin costo para app registration |
| **Dominio** (opcional) | — | **$1 USD** | wms.movidatci.com o similar | ~$12/año ÷ 12 |
| **TOTAL MENSUAL** | — | **$53 USD** | — | **≈ Q408/mes** |

### Notas importantes:
- **Azure App Registration es GRATIS** → no hay costo adicional por la integración con Dynamics
- **Dynamics 365 lo paga el cliente** → no es un costo de Movida TCI
- **Vercel** en plan Free también funciona, pero Pro evita límites en builds y bandwidth
- **Render** en free tier se duerme cada 15 min → NO recomendado para producción

---

## 2. Escenarios de Hosting

### 🟢 Escenario A: Mínimo Viable (Demo/Startups)

| Servicio | Plan | Costo |
|---|---|---|
| Vercel | **Hobby (Free)** | $0 |
| Render | **Free** | $0 |
| Supabase | **Free** | $0 |
| Azure | Free | $0 |
| **TOTAL** | — | **$0/mes** |

> ⚠️ Limitaciones: Render se duerme (30s delay), Supabase pausa tras 7 días inactivo, Vercel sin dominio custom. **Solo para demos.**

---

### 🟡 Escenario B: Producción Estándar (RECOMENDADO)

| Servicio | Plan | Costo |
|---|---|---|
| Vercel | **Pro** | $20 |
| Render | **Starter** | $7 |
| Supabase | **Pro** | $25 |
| Azure | Free | $0 |
| Dominio | — | $1 |
| **TOTAL** | — | **$53/mes (~Q408)** |

> ✅ Ideal para 500 SKUs, 1 CEDIS, 5-8 usuarios simultáneos. Always-on, backups diarios, sin sorpresas.

---

### 🔴 Escenario C: Producción Enterprise (Multi-CEDIS/Alto Tráfico)

| Servicio | Plan | Costo |
|---|---|---|
| Vercel | **Pro (2 seats)** | $40 |
| Render | **Standard (1 vCPU, 2GB)** | $25 |
| Supabase | **Pro + Compute S** | $50 |
| Azure | Free | $0 |
| Dominio + SSL | — | $3 |
| **TOTAL** | — | **$118/mes (~Q909)** |

> 💪 Para 1000+ SKUs, 2-3 CEDIS, 15+ usuarios, alta concurrencia en picking.

---

## 3. Costo de Implementación

### Desglose del proyecto (one-time)

| Concepto | Horas Est. | Tarifa/Hora | Costo | Detalle |
|---|---|---|---|---|
| **Análisis y diseño** | 16h | $75 | **$1,200** | Levantamiento de req., diseño de procesos, mapeo de flujos |
| **Desarrollo WMS Core** | 120h | $75 | **$9,000** | Ya desarrollado (Inventario, Recepción, Picking, Despacho, Etiquetado, Trazabilidad, Admin) |
| **Integración Dynamics 365** | 40h | $75 | **$3,000** | Configuración OAuth, mapeo de entidades, sync bidireccional |
| **PWA Mobile (Zebra)** | 40h | $75 | **$3,000** | Vistas móviles para Recepción, Picking, Despacho con scan |
| **Migración de datos** | 16h | $75 | **$1,200** | Carga de 500 SKUs, ubicaciones, restaurantes, usuarios |
| **Configuración Azure** | 4h | $75 | **$300** | App registration, permisos, BC setup |
| **Configuración Render/Vercel** | 4h | $75 | **$300** | Deploy, variables, dominio, SSL |
| **Testing & QA** | 20h | $75 | **$1,500** | Pruebas E2E, integración, UAT con el cliente |
| **Capacitación** | 8h | $75 | **$600** | Training a usuarios (admin + almacenistas) |
| **Documentación** | 8h | $75 | **$600** | Manuales de usuario, guía técnica, runbooks |
| | | | | |
| **SUBTOTAL** | **276h** | — | **$20,700** | |
| **Descuento primer cliente** | — | -15% | **-$3,105** | Descuento estratégico por ser implementación de referencia |
| | | | | |
| **TOTAL IMPLEMENTACIÓN** | — | — | **$17,595 USD** | **≈ Q135,482** |

### Forma de pago sugerida:

| Hito | % | Monto | Trigger |
|---|---|---|---|
| Anticipo (firma) | 30% | $5,279 | Al firmar contrato |
| Entrega módulos core | 30% | $5,279 | WMS operativo en staging |
| Integración Dynamics + PWA | 25% | $4,399 | Sync funcionando + Mobile listo |
| Go-Live + capacitación | 15% | $2,639 | Sistema en producción + training |

---

## 4. Hardware — Zebra TC22

### Costo por dispositivo

| Concepto | Cant. | Precio Unit. | Total |
|---|---|---|---|
| **Zebra TC22** (SE4710, 6GB/64GB, Android 13) | 3 | ~$650 USD | **$1,950** |
| **Funda protectora** (boot) | 3 | $45 | $135 |
| **Base de carga** (5-slot) | 1 | $350 | $350 |
| **Batería adicional** (backup) | 3 | $45 | $135 |
| | | | |
| **TOTAL HARDWARE** | — | — | **$2,570 USD** |

> 📝 Precios de referencia B2B. Solicitar cotización formal a distribuidor autorizado (Grupo CMA, MYT Guatemala).  
> 📝 La cantidad de 3 dispositivos asume: 1 para recepción, 1 para picking, 1 de respaldo.  
> 📝 Precio local en Guatemala: ~Q5,000/unidad (retail), negociable con volumen.

---

## 5. Licencias del Cliente (Dynamics 365)

> ⚠️ **Estos costos los absorbe el cliente**, no Movida TCI. Se listan como referencia.

| Licencia | Tipo | Costo/mes | Usuarios | Total/mes |
|---|---|---|---|---|
| **BC Essentials** | Full user | $80/usuario | 3 usuarios | **$240** |
| **BC Team Members** | Read-only/tareas básicas | $8/usuario | 5 usuarios | $40 |
| **TOTAL del cliente** | — | — | 8 usuarios | **$280/mes** |

### Si el cliente YA tiene Dynamics:
- No hay costo adicional de licencias
- Solo necesitan **habilitar API access** y **registrar la app** (lo hacemos nosotros)
- El cliente NO necesita comprar nada extra para la integración

### Si se crea cuenta nueva para demo/migración:
- Se puede usar el **trial de 30 días GRATIS**
- Después del trial: $80/usuario/mes (mínimo 1 usuario)

---

## 6. Mantenimiento Anual

### Opción A: Mantenimiento Básico (RECOMENDADO para 1 CEDIS)

| Concepto | Costo Mensual | Costo Anual |
|---|---|---|
| **Hosting** (Vercel + Render + Supabase) | $53 | **$636** |
| **Developer Jr-Mid** (medio tiempo, 4h/día) | $650 | **$7,800** |
| **Soporte Nivel 2** (incidentes críticos, on-call) | $200 | **$2,400** |
| **Actualizaciones** (parches, deps, security) | incl. | incl. |
| **Backup management** | incl. | incl. |
| | | |
| **TOTAL ANUAL** | **$903/mes** | **$10,836 USD** |
| | | **≈ Q83,437/año** |

### Detalle del Developer de Mantenimiento:

| Requisito | Detalle |
|---|---|
| **Nivel** | Junior-Mid (2-3 años exp.) |
| **Skills** | TypeScript, NestJS, React, PostgreSQL, Prisma |
| **Dedicación** | Medio tiempo (4h/día, L-V) |
| **Responsabilidades** | Monitoreo de logs, fix de bugs, actualizaciones menores, soporte L1/L2, backups |
| **Salario sugerido (GT)** | Q5,000 - Q7,000/mes (medio tiempo) |
| **Salario sugerido (USD)** | $650 - $910/mes |

### Opción B: Mantenimiento Premium (Multi-CEDIS / Crecimiento)

| Concepto | Costo Mensual | Costo Anual |
|---|---|---|
| **Hosting** (plan Enterprise) | $118 | **$1,416** |
| **Developer Mid-Senior** (tiempo completo) | $1,500 | **$18,000** |
| **Soporte 24/7** (on-call + SLA 4h) | $500 | **$6,000** |
| **Mejoras continuas** (nuevos features/sprint) | incl. | incl. |
| | | |
| **TOTAL ANUAL** | **$2,118/mes** | **$25,416 USD** |

---

## 7. Resumen Ejecutivo de Inversión

### Para el cliente (Taco Bell / operador CEDIS):

```
┌──────────────────────────────────────────────────────────────┐
│                    INVERSIÓN TOTAL AÑO 1                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Implementación (one-time)           $17,595                │
│   Hardware Zebra TC22 (3 uds)          $2,570                │
│   Hosting Anual (12 meses)               $636                │
│   Mantenimiento Anual                  $7,800                │
│   Soporte Nivel 2                      $2,400                │
│                                                              │
│   ─────────────────────────────────────────                  │
│   TOTAL AÑO 1                        $31,001 USD             │
│                                       ≈ Q238,708             │
│                                                              │
│   ─────────────────────────────────────────                  │
│   COSTO ANUAL RECURRENTE (Año 2+)    $10,836 USD             │
│                                       ≈ Q83,437              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Desglose visual:

```
Año 1: $31,001 USD
├── 57%  Implementación      $17,595
├──  8%  Hardware             $2,570
├──  2%  Hosting                $636
├── 25%  Dev Mantenimiento    $7,800
└──  8%  Soporte L2           $2,400

Año 2+: $10,836 USD
├──  6%  Hosting                $636
├── 72%  Dev Mantenimiento    $7,800
└── 22%  Soporte L2           $2,400
```

---

## 8. Comparación vs. Competencia

| Solución | Impl. | Mensual | Características |
|---|---|---|---|
| **WMS Movida TCI (nosotros)** | **$17,595** | **$903** | Full-custom, Dynamics 365, PWA Zebra, FEFO, labels |
| **SAP EWM** | $100K - $500K+ | $5,000+ | Enterprise, overkill para 1 CEDIS |
| **Oracle WMS Cloud** | $50K - $200K | $3,000+ | Enterprise, lento de implementar |
| **Odoo WMS** | $15K - $40K | $1,500+ | Open source pero requiere configuración heavy |
| **Fishbowl WMS** | $10K - $30K | $500-1,500 | Genérico, sin integración Dynamics nativa |
| **3PL/Generic SaaS** | $2K - $10K | $500-2,000 | Limitado, sin FEFO, sin etiquetado |

### Ventajas competitivas de nuestra solución:

| Ventaja | Detalle |
|---|---|
| ✅ **Custom para alimentos** | FEFO nativo, control de vencimiento, temperatura, lotes |
| ✅ **Integración Dynamics nativa** | Bidireccional, no requiere middleware |
| ✅ **PWA para Zebra** | Sin necesidad de app store, actualización instantánea |
| ✅ **Costo 80% menor** que SAP/Oracle | Sin licencias enterprise |
| ✅ **Deploy en semanas** | No meses como las enterprise |
| ✅ **Propiedad del código** | El cliente puede modificar a futuro |

---

## 9. Estrategia de Migración Paralela

### Fase 1: Preparación (Semana 1-2)
```
┌─────────────────────┐     ┌─────────────────────┐
│  OPERACIÓN ACTUAL    │     │  WMS NUEVO          │
│  (Manual + Dynamics) │     │  (Staging)          │
│                      │     │                     │
│  ✅ Funcional        │     │  🔧 Configuración   │
│                      │     │  📦 Carga de SKUs   │
│                      │     │  🗺️ Mapeo ubicaciones│
│                      │     │  👤 Creación usuarios│
└─────────────────────┘     └─────────────────────┘
```
- Crear cuenta nueva en Dynamics BC Trial (30 días gratis) o sandbox
- Cargar los 500 SKUs y ubicaciones
- Configurar Azure (app registration)
- Sin tocar la operación actual del cliente

### Fase 2: Operación Dual (Semana 3-4)
```
┌─────────────────────┐     ┌─────────────────────┐
│  OPERACIÓN ACTUAL    │     │  WMS NUEVO          │
│  (Manual + Dynamics) │     │  (Producción)       │
│                      │     │                     │
│  ✅ Sigue operando   │ ──► │  📝 Registro shadow │
│  📋 Es la fuente     │     │  🔍 Verificación    │
│     de verdad        │     │  📊 Comparación     │
└─────────────────────┘     └─────────────────────┘
```
- Los almacenistas usan ambos sistemas (shadow mode)
- Se comparan resultados: WMS vs operación manual
- Se identifican ajustes necesarios
- La operación actual sigue siendo la "fuente de verdad"

### Fase 3: Transición (Semana 5-6)
```
┌─────────────────────┐     ┌─────────────────────┐
│  OPERACIÓN ANTERIOR  │     │  WMS NUEVO          │
│  (Backup/referencia) │     │  (Producción)       │
│                      │     │                     │
│  📉 Reducción gradual│ ◄── │  ✅ Fuente de verdad│
│     Modo lectura     │     │  📱 Zebra activos   │
│                      │     │  🔗 Dynamics sync   │
└─────────────────────┘     └─────────────────────┘
```
- WMS se convierte en la fuente de verdad
- Operación manual solo como referencia/backup
- Dynamics sync activo y funcionando de verdad

### Fase 4: Go-Live Completo (Semana 7+)
```
                              ┌─────────────────────┐
                              │  WMS MOVIDA TCI     │
       ✅ SISTEMA ÚNICO ────► │  (Producción)       │
                              │                     │
                              │  ✅ 100% operativo  │
                              │  📱 Zebra TC22      │
                              │  🔗 Dynamics sync   │
                              │  📊 Dashboard real  │
                              └─────────────────────┘
```
- Se depreca la operación manual anterior
- Todo corre sobre el WMS
- Soporte post-go-live activo (1 mes incluido)

---

## 10. Modelo de Precios para Clientes

### Propuesta de pricing escalable

| Plan | SKUs | CEDIS | Usuarios | Impl. | Mensual |
|---|---|---|---|---|---|
| **Starter** | Hasta 500 | 1 | 8 | $17,595 | $903 |
| **Growth** | Hasta 1,500 | 2 | 20 | $28,000 | $1,500 |
| **Enterprise** | 3,000+ | 5+ | 50+ | Cotización | $3,000+ |

### Por cada CEDIS adicional (futuro):
- Setup: $3,000 (configuración, ubicaciones, training)
- Mensual adicional: +$200/CEDIS (infra + soporte)

### Por cada 500 SKUs adicionales:
- Migración: $500 (carga de datos)
- Sin costo mensual adicional (ya incluido en el plan)

---

## Notas Finales

> 💡 **Para el equipo comercial:** Este documento es una guía de referencia. Los precios pueden ajustarse ±15% según negociación y volumen.

> 💡 **El margen de Movida TCI** con los precios de referencia está entre 45-55% en implementación y 35-45% en mantenimiento, lo cual es saludable para una empresa de tecnología en LATAM.

> 💡 **El ROI del cliente** se logra típicamente en 6-9 meses, considerando: reducción de merma por vencimiento (-30%), reducción de errores de despacho (-50%), y eliminación de tiempo en procesos manuales (-70%).

---

*Documento confidencial — Movida TCI © 2026*  
*Última actualización: Abril 2026*
