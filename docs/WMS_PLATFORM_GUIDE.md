# 📘 WMS Taco Bell Guatemala — Guía de Arquitectura y Mantenimiento

**Versión:** 2.0  
**Fecha:** Abril 2026  
**Equipo:** Movida TCI  

---

## 1. Infraestructura de Producción

| Servicio | Plataforma | URL | Tecnología |
|---|---|---|---|
| **Frontend** | Vercel | `https://wms-movida.vercel.app` | React 18 + Vite + TypeScript |
| **Backend** | Render | `https://wms-movida.onrender.com` | NestJS 11 + TypeScript |
| **Base de Datos** | Supabase | PostgreSQL (AWS us-west-2) | Prisma ORM v7.6 |
| **Repositorio** | GitHub | `https://github.com/mov1datc1/wms_movida` | Git main branch |
| **Email** | SMTP propio | mail.movidatci.com:465 | Nodemailer |

### CI/CD (Despliegue Automático)

```
git push origin main
       │
       ├──► Vercel detecta push → build frontend → deploy automático (~30s)
       │
       └──► Render detecta push → npm install --include=dev
                                → npx prisma generate
                                → npx nest build
                                → node dist/src/main → deploy (~2min)
```

---

## 2. Variables de Entorno

### Backend (Render)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres.xxx:pass@supabase.com:5432/postgres` |
| `JWT_SECRET` | Clave para firmar tokens JWT | `wms-tb-gt-secret-2026` |
| `SMTP_HOST` | Servidor de correo saliente | `mail.movidatci.com` |
| `SMTP_PORT` | Puerto SMTP (SSL) | `465` |
| `SMTP_USER` | Email de envío | `wms@movidatci.com` |
| `SMTP_PASS` | Contraseña SMTP | `(ver configuración interna)` |
| `NODE_ENV` | Entorno | `production` |
| `DYNAMICS_TENANT_ID` | Azure AD Tenant | `(ver doc Dynamics)` |
| `DYNAMICS_CLIENT_ID` | Azure App Client ID | `(ver doc Dynamics)` |
| `DYNAMICS_CLIENT_SECRET` | Azure App Secret | `(ver doc Dynamics)` |
| `DYNAMICS_ENVIRONMENT` | Entorno BC | `Production` |
| `DYNAMICS_COMPANY_ID` | ID de compañía en BC | `(ver doc Dynamics)` |

### Frontend (Vercel)

| Variable | Descripción | Valor |
|---|---|---|
| `VITE_API_URL` | URL del backend | `https://wms-movida.onrender.com/api` |

---

## 3. Estructura del Proyecto

```
wms_movida/
├── wms-frontend/                    # React + Vite
│   ├── src/
│   │   ├── config/api.ts            # URL centralizada del backend
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx       # Autenticación JWT + roles
│   │   │   └── WarehouseContext.tsx  # CEDIS activo
│   │   ├── components/
│   │   │   └── Layout/
│   │   │       ├── Sidebar.tsx       # Navegación principal
│   │   │       ├── TopBar.tsx        # Barra superior
│   │   │       └── AppLayout.tsx     # Layout wrapper
│   │   └── pages/
│   │       ├── Login.tsx             # Login + OTP
│   │       ├── Dashboard.tsx         # Panel principal
│   │       ├── Inventory.tsx         # Stock por lote
│   │       ├── Locations.tsx         # Ubicaciones CEDIS
│   │       ├── Receiving.tsx         # Recepción de mercancía
│   │       ├── Picking.tsx           # Picking FEFO
│   │       ├── Dispatch.tsx          # Despacho + firma
│   │       ├── Traceability.tsx      # Rastreo de lotes
│   │       ├── LabelPreview.tsx      # Etiquetado QR/Barcode
│   │       ├── MasterData.tsx        # SKUs y datos maestros
│   │       ├── QualityRules.tsx      # Reglas de calidad
│   │       ├── DynamicsSync.tsx      # Sync con Dynamics 365
│   │       └── AdminPanel.tsx        # Roles, usuarios, CEDIS
│   ├── index.html
│   └── package.json
│
├── wms-backend/                     # NestJS
│   ├── src/
│   │   ├── main.ts                  # Bootstrap + CORS
│   │   ├── app.module.ts            # Módulo raíz
│   │   ├── prisma.service.ts        # Prisma client singleton
│   │   └── modules/
│   │       ├── auth/                # JWT + OTP + RBAC
│   │       ├── warehouses/          # CRUD de CEDIS
│   │       ├── inventory/           # Stock, lotes, movimientos
│   │       ├── locations/           # Ubicaciones
│   │       ├── operations/          # Recepción, picking, despacho
│   │       ├── masters/             # SKUs maestros
│   │       ├── traceability/        # Rastreo
│   │       └── integrations/        # Dynamics 365
│   │           ├── dynamics.service.ts
│   │           ├── dynamics-sync.service.ts
│   │           └── dynamics.controller.ts
│   ├── prisma/
│   │   ├── schema.prisma            # 18 modelos
│   │   └── prisma.config.ts
│   └── package.json
│
├── docs/
│   └── DYNAMICS_365_INTEGRATION.md  # Documentación completa
│
└── render.yaml                      # Config de Render
```

---

## 4. Módulos del Sistema

### 4.1 Autenticación (RBAC)
- Login con email + contraseña
- SuperAdmin OTP por correo
- Roles configurables con permisos por módulo
- JWT tokens con expiración de 24h

### 4.2 Gestión Multi-CEDIS
- Múltiples almacenes (CEDIS, Bodegas, Devoluciones)
- Datos aislados por almacén
- Selector en el TopBar

### 4.3 Inventario
- Stock por lote con vencimiento (FEFO)
- Ubicaciones con zonas (RECIBO, PICKING, RESERVA, STAGING, CUARENTENA, QUIMICOS)
- Control de temperatura (AMBIENTE, REFRIGERADO, CONGELADO)
- Handling Units (pallet, caja, bandeja)

### 4.4 Operaciones
- **Recepción:** Scan de OC → confirmar cantidades → asignar ubicación
- **Picking FEFO:** Selección automática de lotes más próximos a vencer
- **Despacho:** Consolidación → firma del despachador → tracking GPS

### 4.5 Etiquetado
- QR Code + Barcode (Code128) por lote
- Optimizado para impresoras térmicas 4"×2"
- Vista previa e impresión directa

### 4.6 Integración Dynamics 365
- Ver documento separado: `docs/DYNAMICS_365_INTEGRATION.md`

---

## 5. Comandos Útiles

### Desarrollo local

```bash
# Frontend
cd wms-frontend
npm install
npm run dev              # http://localhost:5173

# Backend
cd wms-backend
npm install
npx prisma generate      # Genera Prisma Client
npx prisma db push       # Aplica schema a la BD
npm run start:dev         # http://localhost:3001
```

### Migraciones de BD

```bash
cd wms-backend
npx prisma db push        # Aplica cambios del schema (sin migration files)
npx prisma studio         # UI visual de la BD (http://localhost:5555)
```

### Deploy manual

```bash
git add -A
git commit -m "feat/fix: descripción"
git push origin main
# Vercel y Render se actualizan automáticamente
```

### Build command de Render

```
npm install --include=dev && npx prisma generate && npm run build
```

### Start command de Render

```
npm run start:prod     # → node dist/src/main
```

---

## 6. Troubleshooting General

| Problema | Solución |
|---|---|
| Frontend no conecta al backend | Verificar `VITE_API_URL` en Vercel contiene `/api` al final |
| Build de Render falla con `nest not found` | Asegurar que build command tiene `--include=dev` |
| Build de Render falla con TS errors | Fix: imports no usados o tipos faltantes |
| Login falla en producción | Verificar que el backend tiene `DATABASE_URL` correcta |
| OTP no llega por correo | Verificar `SMTP_*` variables y que el servidor SMTP esté accesible |
| Render se duerme (free tier) | Normal — el primer request tarda ~30s mientras despierta |

---

*Documento confidencial — Movida TCI © 2026*
