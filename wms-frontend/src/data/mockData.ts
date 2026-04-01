// =========================================================
// Taco Bell Guatemala WMS — Mock Data
// Realistic data for demo purposes
// =========================================================

export interface Sku {
  id: string;
  codigoDynamics: string;
  descripcion: string;
  categoria: string;
  uomBase: string;
  requiereLote: boolean;
  requiereVencimiento: boolean;
  temperaturaRequerida: 'AMBIENTE' | 'REFRIGERADO' | 'CONGELADO';
  familiaCalidad: string;
  activo: boolean;
}

export interface LotInventory {
  id: string;
  skuId: string;
  skuCodigo: string;
  skuDescripcion: string;
  lote: string;
  fechaVencimiento: string;
  fechaProduccion: string;
  proveedorId: string;
  proveedorNombre: string;
  estadoCalidad: 'LIBERADO' | 'CUARENTENA' | 'BLOQUEADO';
  cantidadDisponible: number;
  cantidadReservada: number;
  cantidadBloqueada: number;
  ubicacion: string;
  zona: 'AMBIENTE' | 'REFRIGERADO' | 'CONGELADO';
}

export interface HandlingUnit {
  id: string;
  tipoHu: 'PALLET' | 'CAJA' | 'BANDEJA';
  lotId: string;
  lote: string;
  skuDescripcion: string;
  cantidad: number;
  uom: string;
  ubicacionActual: string;
  estadoHu: string;
}

export interface Location {
  id: string;
  codigo: string;
  almacen: string;
  zona: string;
  pasillo: string;
  rack: string;
  nivel: string;
  posicion: string;
  tipoUbicacion: string;
  temperatura: 'AMBIENTE' | 'REFRIGERADO' | 'CONGELADO';
  capacidad: number;
  ocupacion: number;
  estado: 'LIBRE' | 'OCUPADO' | 'BLOQUEADO';
}

export interface OutboundOrder {
  id: string;
  restauranteId: string;
  restauranteNombre: string;
  prioridad: number;
  fechaCompromiso: string;
  estado: 'PENDIENTE' | 'EN_PICKING' | 'CONSOLIDADO' | 'DESPACHADO';
  totalLineas: number;
  lineasCompletadas: number;
  origenDynamics: string;
}

export interface Movement {
  id: string;
  fechaHora: string;
  tipoMovimiento: 'ENTRADA' | 'SALIDA' | 'TRASIEGO' | 'AJUSTE';
  skuDescripcion: string;
  lote: string;
  fromLocation: string;
  toLocation: string;
  cantidad: number;
  usuario: string;
  motivo: string;
}

export interface Restaurante {
  id: string;
  nombre: string;
  zona: string;
  direccion: string;
  activo: boolean;
}

export interface Alert {
  id: string;
  tipo: 'danger' | 'warning' | 'info';
  mensaje: string;
  hora: string;
}

// --- RESTAURANTES ---
export const restaurantes: Restaurante[] = [
  { id: 'R001', nombre: 'Taco Bell Zona 10 Unicentro', zona: 'Zona 10', direccion: 'C.C. Unicentro, Zona 10', activo: true },
  { id: 'R002', nombre: 'Taco Bell Zona 14 Avia', zona: 'Zona 14', direccion: 'C.C. Avia, Blvd Vista Hermosa', activo: true },
  { id: 'R003', nombre: 'Taco Bell Miraflores', zona: 'Zona 11', direccion: 'C.C. Miraflores, Calzada Roosevelt', activo: true },
  { id: 'R004', nombre: 'Taco Bell Pradera Concepción', zona: 'Zona 17', direccion: 'C.C. Pradera Concepción, Km 12', activo: true },
  { id: 'R005', nombre: 'Taco Bell Oakland Mall', zona: 'Zona 10', direccion: 'C.C. Oakland Mall, Diagonal 6', activo: true },
  { id: 'R006', nombre: 'Taco Bell Majadas', zona: 'Zona 11', direccion: 'C.C. Majadas, Calzada San Juan', activo: true },
  { id: 'R007', nombre: 'Taco Bell Portales', zona: 'Zona 17', direccion: 'C.C. Portales, 15 Avenida', activo: true },
  { id: 'R008', nombre: 'Taco Bell Cayalá', zona: 'Zona 16', direccion: 'Paseo Cayalá, Zona 16', activo: true },
  { id: 'R009', nombre: 'Taco Bell Mixco', zona: 'Mixco', direccion: 'Blvd El Naranjo, Mixco', activo: true },
  { id: 'R010', nombre: 'Taco Bell Antigua', zona: 'Sacatepéquez', direccion: 'Portal del Comercio, Antigua', activo: true },
];

// --- SKUs ---
export const skus: Sku[] = [
  { id: 'S001', codigoDynamics: 'TB-SAL-001', descripcion: 'Salsa Taco Supreme 500g', categoria: 'Salsas', uomBase: 'UN', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S002', codigoDynamics: 'TB-SAL-002', descripcion: 'Salsa Chipotle 350g', categoria: 'Salsas', uomBase: 'UN', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S003', codigoDynamics: 'TB-TOR-001', descripcion: 'Tortilla Harina 12" x24', categoria: 'Tortillas', uomBase: 'PAQ', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'CONGELADO', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S004', codigoDynamics: 'TB-TOR-002', descripcion: 'Tortilla Maíz Crujiente x36', categoria: 'Tortillas', uomBase: 'PAQ', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S005', codigoDynamics: 'TB-CAR-001', descripcion: 'Carne Molida Seasoned 5Kg', categoria: 'Proteínas', uomBase: 'KG', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'CONGELADO', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S006', codigoDynamics: 'TB-CAR-002', descripcion: 'Pollo Grilled Strips 3Kg', categoria: 'Proteínas', uomBase: 'KG', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'CONGELADO', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S007', codigoDynamics: 'TB-QUE-001', descripcion: 'Queso Cheddar Rallado 2Kg', categoria: 'Lácteos', uomBase: 'KG', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S008', codigoDynamics: 'TB-QUE-002', descripcion: 'Crema Agria 1.5Kg', categoria: 'Lácteos', uomBase: 'KG', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S009', codigoDynamics: 'TB-FRI-001', descripcion: 'Frijoles Refritos 2Kg', categoria: 'Insumos Base', uomBase: 'KG', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S010', codigoDynamics: 'TB-VEG-001', descripcion: 'Lechuga Iceberg Picada 1Kg', categoria: 'Vegetales', uomBase: 'KG', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S011', codigoDynamics: 'TB-VEG-002', descripcion: 'Tomate Cubos 1Kg', categoria: 'Vegetales', uomBase: 'KG', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO', activo: true },
  { id: 'S012', codigoDynamics: 'TB-EMP-001', descripcion: 'Bolsa Kraft Delivery x500', categoria: 'Empaques', uomBase: 'PAQ', requiereLote: false, requiereVencimiento: false, temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'EMPAQUE', activo: true },
  { id: 'S013', codigoDynamics: 'TB-EMP-002', descripcion: 'Caja Combo Meal x200', categoria: 'Empaques', uomBase: 'PAQ', requiereLote: false, requiereVencimiento: false, temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'EMPAQUE', activo: true },
  { id: 'S014', codigoDynamics: 'TB-LIM-001', descripcion: 'Desinfectante Industrial 5L', categoria: 'Químicos', uomBase: 'UN', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'QUIMICO', activo: true },
  { id: 'S015', codigoDynamics: 'TB-LIM-002', descripcion: 'Sanitizante Manos 500ml x12', categoria: 'Químicos', uomBase: 'PAQ', requiereLote: true, requiereVencimiento: true, temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'QUIMICO', activo: true },
  { id: 'S016', codigoDynamics: 'TB-UNI-001', descripcion: 'Camisa Polo Crew M', categoria: 'Uniformes', uomBase: 'UN', requiereLote: false, requiereVencimiento: false, temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'TEXTIL', activo: true },
];

// --- LOTES ---
const today = new Date();
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r.toISOString().split('T')[0];
};
const subDays = (d: Date, n: number) => addDays(d, -n);

export const lots: LotInventory[] = [
  { id: 'L001', skuId: 'S001', skuCodigo: 'TB-SAL-001', skuDescripcion: 'Salsa Taco Supreme 500g', lote: 'L260315A', fechaVencimiento: addDays(today, 5), fechaProduccion: subDays(today, 30), proveedorId: 'P001', proveedorNombre: 'US Foods Guatemala', estadoCalidad: 'LIBERADO', cantidadDisponible: 240, cantidadReservada: 60, cantidadBloqueada: 0, ubicacion: 'REF-A03-R01-N2', zona: 'REFRIGERADO' },
  { id: 'L002', skuId: 'S001', skuCodigo: 'TB-SAL-001', skuDescripcion: 'Salsa Taco Supreme 500g', lote: 'L260320B', fechaVencimiento: addDays(today, 45), fechaProduccion: subDays(today, 15), proveedorId: 'P001', proveedorNombre: 'US Foods Guatemala', estadoCalidad: 'LIBERADO', cantidadDisponible: 480, cantidadReservada: 0, cantidadBloqueada: 0, ubicacion: 'REF-A03-R02-N1', zona: 'REFRIGERADO' },
  { id: 'L003', skuId: 'S003', skuCodigo: 'TB-TOR-001', skuDescripcion: 'Tortilla Harina 12" x24', lote: 'L260301C', fechaVencimiento: addDays(today, 3), fechaProduccion: subDays(today, 57), proveedorId: 'P002', proveedorNombre: 'Mission Foods GT', estadoCalidad: 'LIBERADO', cantidadDisponible: 48, cantidadReservada: 24, cantidadBloqueada: 0, ubicacion: 'CONG-B07-R03-N1', zona: 'CONGELADO' },
  { id: 'L004', skuId: 'S005', skuCodigo: 'TB-CAR-001', skuDescripcion: 'Carne Molida Seasoned 5Kg', lote: 'L260318D', fechaVencimiento: addDays(today, 21), fechaProduccion: subDays(today, 14), proveedorId: 'P003', proveedorNombre: 'Tyson Foods Import', estadoCalidad: 'LIBERADO', cantidadDisponible: 150, cantidadReservada: 30, cantidadBloqueada: 0, ubicacion: 'CONG-B10-R01-N3', zona: 'CONGELADO' },
  { id: 'L005', skuId: 'S005', skuCodigo: 'TB-CAR-001', skuDescripcion: 'Carne Molida Seasoned 5Kg', lote: 'L260325E', fechaVencimiento: addDays(today, 60), fechaProduccion: subDays(today, 5), proveedorId: 'P003', proveedorNombre: 'Tyson Foods Import', estadoCalidad: 'CUARENTENA', cantidadDisponible: 0, cantidadReservada: 0, cantidadBloqueada: 200, ubicacion: 'CONG-B10-R02-N1', zona: 'CONGELADO' },
  { id: 'L006', skuId: 'S007', skuCodigo: 'TB-QUE-001', skuDescripcion: 'Queso Cheddar Rallado 2Kg', lote: 'L260310F', fechaVencimiento: addDays(today, 12), fechaProduccion: subDays(today, 18), proveedorId: 'P004', proveedorNombre: 'Dos Pinos GT', estadoCalidad: 'LIBERADO', cantidadDisponible: 96, cantidadReservada: 48, cantidadBloqueada: 0, ubicacion: 'REF-A05-R01-N2', zona: 'REFRIGERADO' },
  { id: 'L007', skuId: 'S009', skuCodigo: 'TB-FRI-001', skuDescripcion: 'Frijoles Refritos 2Kg', lote: 'L260228G', fechaVencimiento: addDays(today, 90), fechaProduccion: subDays(today, 60), proveedorId: 'P005', proveedorNombre: 'Del Monte Guatemala', estadoCalidad: 'LIBERADO', cantidadDisponible: 320, cantidadReservada: 80, cantidadBloqueada: 0, ubicacion: 'AMB-C15-R02-N1', zona: 'AMBIENTE' },
  { id: 'L008', skuId: 'S010', skuCodigo: 'TB-VEG-001', skuDescripcion: 'Lechuga Iceberg Picada 1Kg', lote: 'L260330H', fechaVencimiento: addDays(today, 2), fechaProduccion: subDays(today, 3), proveedorId: 'P006', proveedorNombre: 'Fresh Produce GT', estadoCalidad: 'LIBERADO', cantidadDisponible: 30, cantidadReservada: 20, cantidadBloqueada: 0, ubicacion: 'REF-A01-R01-N1', zona: 'REFRIGERADO' },
  { id: 'L009', skuId: 'S014', skuCodigo: 'TB-LIM-001', skuDescripcion: 'Desinfectante Industrial 5L', lote: 'L260201I', fechaVencimiento: addDays(today, 180), fechaProduccion: subDays(today, 90), proveedorId: 'P007', proveedorNombre: 'Henkel Guatemala', estadoCalidad: 'LIBERADO', cantidadDisponible: 45, cantidadReservada: 10, cantidadBloqueada: 0, ubicacion: 'AMB-D20-R01-N1', zona: 'AMBIENTE' },
  { id: 'L010', skuId: 'S002', skuCodigo: 'TB-SAL-002', skuDescripcion: 'Salsa Chipotle 350g', lote: 'L260324J', fechaVencimiento: addDays(today, 28), fechaProduccion: subDays(today, 7), proveedorId: 'P001', proveedorNombre: 'US Foods Guatemala', estadoCalidad: 'LIBERADO', cantidadDisponible: 360, cantidadReservada: 40, cantidadBloqueada: 0, ubicacion: 'REF-A04-R01-N2', zona: 'REFRIGERADO' },
  { id: 'L011', skuId: 'S006', skuCodigo: 'TB-CAR-002', skuDescripcion: 'Pollo Grilled Strips 3Kg', lote: 'L260312K', fechaVencimiento: addDays(today, 8), fechaProduccion: subDays(today, 22), proveedorId: 'P008', proveedorNombre: 'Pilgrims GT', estadoCalidad: 'BLOQUEADO', cantidadDisponible: 0, cantidadReservada: 0, cantidadBloqueada: 75, ubicacion: 'CONG-B08-R01-N2', zona: 'CONGELADO' },
  { id: 'L012', skuId: 'S004', skuCodigo: 'TB-TOR-002', skuDescripcion: 'Tortilla Maíz Crujiente x36', lote: 'L260310L', fechaVencimiento: addDays(today, 120), fechaProduccion: subDays(today, 20), proveedorId: 'P002', proveedorNombre: 'Mission Foods GT', estadoCalidad: 'LIBERADO', cantidadDisponible: 500, cantidadReservada: 100, cantidadBloqueada: 0, ubicacion: 'AMB-C12-R01-N3', zona: 'AMBIENTE' },
];

// --- LOCATIONS ---
export const locations: Location[] = [
  { id: 'LOC001', codigo: 'REF-A01-R01-N1', almacen: 'CEDIS-GT', zona: 'Refrigerado', pasillo: 'A01', rack: 'R01', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 78, estado: 'OCUPADO' },
  { id: 'LOC002', codigo: 'REF-A03-R01-N2', almacen: 'CEDIS-GT', zona: 'Refrigerado', pasillo: 'A03', rack: 'R01', nivel: 'N2', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 60, estado: 'OCUPADO' },
  { id: 'LOC003', codigo: 'REF-A03-R02-N1', almacen: 'CEDIS-GT', zona: 'Refrigerado', pasillo: 'A03', rack: 'R02', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 95, estado: 'OCUPADO' },
  { id: 'LOC004', codigo: 'REF-A04-R01-N2', almacen: 'CEDIS-GT', zona: 'Refrigerado', pasillo: 'A04', rack: 'R01', nivel: 'N2', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 45, estado: 'OCUPADO' },
  { id: 'LOC005', codigo: 'REF-A05-R01-N2', almacen: 'CEDIS-GT', zona: 'Refrigerado', pasillo: 'A05', rack: 'R01', nivel: 'N2', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 68, estado: 'OCUPADO' },
  { id: 'LOC006', codigo: 'CONG-B07-R03-N1', almacen: 'CEDIS-GT', zona: 'Congelado', pasillo: 'B07', rack: 'R03', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'CONGELADO', capacidad: 80, ocupacion: 55, estado: 'OCUPADO' },
  { id: 'LOC007', codigo: 'CONG-B08-R01-N2', almacen: 'CEDIS-GT', zona: 'Congelado', pasillo: 'B08', rack: 'R01', nivel: 'N2', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'CONGELADO', capacidad: 80, ocupacion: 0, estado: 'BLOQUEADO' },
  { id: 'LOC008', codigo: 'CONG-B10-R01-N3', almacen: 'CEDIS-GT', zona: 'Congelado', pasillo: 'B10', rack: 'R01', nivel: 'N3', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'CONGELADO', capacidad: 80, ocupacion: 72, estado: 'OCUPADO' },
  { id: 'LOC009', codigo: 'CONG-B10-R02-N1', almacen: 'CEDIS-GT', zona: 'Congelado', pasillo: 'B10', rack: 'R02', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'CUARENTENA', temperatura: 'CONGELADO', capacidad: 80, ocupacion: 80, estado: 'OCUPADO' },
  { id: 'LOC010', codigo: 'AMB-C12-R01-N3', almacen: 'CEDIS-GT', zona: 'Ambiente', pasillo: 'C12', rack: 'R01', nivel: 'N3', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'AMBIENTE', capacidad: 120, ocupacion: 50, estado: 'OCUPADO' },
  { id: 'LOC011', codigo: 'AMB-C15-R02-N1', almacen: 'CEDIS-GT', zona: 'Ambiente', pasillo: 'C15', rack: 'R02', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'AMBIENTE', capacidad: 120, ocupacion: 88, estado: 'OCUPADO' },
  { id: 'LOC012', codigo: 'AMB-D20-R01-N1', almacen: 'CEDIS-GT', zona: 'Ambiente', pasillo: 'D20', rack: 'R01', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'QUIMICOS', temperatura: 'AMBIENTE', capacidad: 60, ocupacion: 30, estado: 'OCUPADO' },
  { id: 'LOC013', codigo: 'RECIBO-01', almacen: 'CEDIS-GT', zona: 'Recibo', pasillo: '-', rack: '-', nivel: '-', posicion: '-', tipoUbicacion: 'RECIBO', temperatura: 'AMBIENTE', capacidad: 200, ocupacion: 0, estado: 'LIBRE' },
  { id: 'LOC014', codigo: 'STAGING-01', almacen: 'CEDIS-GT', zona: 'Despacho', pasillo: '-', rack: '-', nivel: '-', posicion: '-', tipoUbicacion: 'STAGING', temperatura: 'AMBIENTE', capacidad: 150, ocupacion: 35, estado: 'OCUPADO' },
  { id: 'LOC015', codigo: 'AMB-C18-R03-N2', almacen: 'CEDIS-GT', zona: 'Ambiente', pasillo: 'C18', rack: 'R03', nivel: 'N2', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'AMBIENTE', capacidad: 120, ocupacion: 0, estado: 'LIBRE' },
  { id: 'LOC016', codigo: 'REF-A06-R02-N1', almacen: 'CEDIS-GT', zona: 'Refrigerado', pasillo: 'A06', rack: 'R02', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 0, estado: 'LIBRE' },
];

// --- OUTBOUND ORDERS ---
export const orders: OutboundOrder[] = [
  { id: 'ORD-001', restauranteId: 'R001', restauranteNombre: 'TB Zona 10 Unicentro', prioridad: 1, fechaCompromiso: addDays(today, 0), estado: 'EN_PICKING', totalLineas: 8, lineasCompletadas: 5, origenDynamics: 'DYN-TF-2026-0482' },
  { id: 'ORD-002', restauranteId: 'R003', restauranteNombre: 'TB Miraflores', prioridad: 2, fechaCompromiso: addDays(today, 0), estado: 'PENDIENTE', totalLineas: 12, lineasCompletadas: 0, origenDynamics: 'DYN-TF-2026-0483' },
  { id: 'ORD-003', restauranteId: 'R008', restauranteNombre: 'TB Cayalá', prioridad: 1, fechaCompromiso: addDays(today, 0), estado: 'CONSOLIDADO', totalLineas: 6, lineasCompletadas: 6, origenDynamics: 'DYN-TF-2026-0479' },
  { id: 'ORD-004', restauranteId: 'R005', restauranteNombre: 'TB Oakland Mall', prioridad: 3, fechaCompromiso: addDays(today, 1), estado: 'PENDIENTE', totalLineas: 10, lineasCompletadas: 0, origenDynamics: 'DYN-TF-2026-0485' },
  { id: 'ORD-005', restauranteId: 'R002', restauranteNombre: 'TB Zona 14 Avia', prioridad: 2, fechaCompromiso: addDays(today, 1), estado: 'PENDIENTE', totalLineas: 9, lineasCompletadas: 0, origenDynamics: 'DYN-TF-2026-0486' },
  { id: 'ORD-006', restauranteId: 'R006', restauranteNombre: 'TB Majadas', prioridad: 3, fechaCompromiso: addDays(today, 1), estado: 'DESPACHADO', totalLineas: 7, lineasCompletadas: 7, origenDynamics: 'DYN-TF-2026-0475' },
  { id: 'ORD-007', restauranteId: 'R004', restauranteNombre: 'TB Pradera Concepción', prioridad: 1, fechaCompromiso: addDays(today, 0), estado: 'PENDIENTE', totalLineas: 11, lineasCompletadas: 0, origenDynamics: 'DYN-TF-2026-0488' },
  { id: 'ORD-008', restauranteId: 'R010', restauranteNombre: 'TB Antigua', prioridad: 2, fechaCompromiso: addDays(today, 2), estado: 'DESPACHADO', totalLineas: 5, lineasCompletadas: 5, origenDynamics: 'DYN-TF-2026-0470' },
];

// --- MOVEMENTS ---
export const movements: Movement[] = [
  { id: 'M001', fechaHora: subDays(today, 0) + 'T08:15:00', tipoMovimiento: 'ENTRADA', skuDescripcion: 'Salsa Chipotle 350g', lote: 'L260324J', fromLocation: 'RECIBO-01', toLocation: 'REF-A04-R01-N2', cantidad: 360, usuario: 'Carlos M.', motivo: 'Recepción OC DYN-OC-2026-0120' },
  { id: 'M002', fechaHora: subDays(today, 0) + 'T09:30:00', tipoMovimiento: 'TRASIEGO', skuDescripcion: 'Queso Cheddar Rallado 2Kg', lote: 'L260310F', fromLocation: 'REF-A05-R01-N3', toLocation: 'REF-A05-R01-N2', cantidad: 48, usuario: 'Luis G.', motivo: 'Reabasto picking' },
  { id: 'M003', fechaHora: subDays(today, 0) + 'T10:00:00', tipoMovimiento: 'SALIDA', skuDescripcion: 'Frijoles Refritos 2Kg', lote: 'L260228G', fromLocation: 'AMB-C15-R02-N1', toLocation: 'STAGING-01', cantidad: 40, usuario: 'Ana P.', motivo: 'Picking ORD-006 TB Majadas' },
  { id: 'M004', fechaHora: subDays(today, 0) + 'T10:45:00', tipoMovimiento: 'SALIDA', skuDescripcion: 'Salsa Taco Supreme 500g', lote: 'L260315A', fromLocation: 'REF-A03-R01-N2', toLocation: 'STAGING-01', cantidad: 30, usuario: 'Ana P.', motivo: 'Picking ORD-006 TB Majadas' },
  { id: 'M005', fechaHora: subDays(today, 0) + 'T11:20:00', tipoMovimiento: 'AJUSTE', skuDescripcion: 'Pollo Grilled Strips 3Kg', lote: 'L260312K', fromLocation: 'CONG-B08-R01-N2', toLocation: 'CONG-B08-R01-N2', cantidad: -5, usuario: 'Supervisor JR', motivo: 'Bloqueo calidad - temp fuera de rango' },
  { id: 'M006', fechaHora: subDays(today, 0) + 'T12:00:00', tipoMovimiento: 'ENTRADA', skuDescripcion: 'Carne Molida Seasoned 5Kg', lote: 'L260325E', fromLocation: 'RECIBO-01', toLocation: 'CONG-B10-R02-N1', cantidad: 200, usuario: 'Carlos M.', motivo: 'Recepción — pendiente liberación calidad' },
  { id: 'M007', fechaHora: subDays(today, 0) + 'T13:15:00', tipoMovimiento: 'SALIDA', skuDescripcion: 'Tortilla Maíz Crujiente x36', lote: 'L260310L', fromLocation: 'AMB-C12-R01-N3', toLocation: 'STAGING-01', cantidad: 36, usuario: 'Pedro H.', motivo: 'Picking ORD-001 TB Zona 10' },
];

// --- ALERTS ---
export const alerts: Alert[] = [
  { id: 'AL001', tipo: 'danger', mensaje: 'Lote L260301C (Tortilla Harina 12") vence en 3 días — 48 UN disponibles', hora: 'Hace 2h' },
  { id: 'AL002', tipo: 'danger', mensaje: 'Lote L260330H (Lechuga Iceberg) vence en 2 días — 30 KG disponibles', hora: 'Hace 1h' },
  { id: 'AL003', tipo: 'warning', mensaje: 'Lote L260315A (Salsa Taco Supreme) vence en 5 días — priorizar despacho', hora: 'Hace 3h' },
  { id: 'AL004', tipo: 'warning', mensaje: 'Lote L260312K (Pollo Grilled) BLOQUEADO por calidad — revisar temperatura', hora: 'Hace 45min' },
  { id: 'AL005', tipo: 'info', mensaje: 'Pedido ORD-007 TB Pradera Concepción requiere picking prioritario (hoy)', hora: 'Hace 30min' },
  { id: 'AL006', tipo: 'warning', mensaje: 'Lote L260325E (Carne Molida) en CUARENTENA — pendiente resultado laboratorio', hora: 'Hace 20min' },
  { id: 'AL007', tipo: 'info', mensaje: 'Ubicación REF-A03-R02-N1 al 95% capacidad — considerar reubicación', hora: 'Hace 15min' },
];

// --- CHART DATA ---
export const dispatchByRestaurant = [
  { name: 'Unicentro Z10', despachos: 12, fill: '#3B6CF5' },
  { name: 'Miraflores', despachos: 9, fill: '#2563EB' },
  { name: 'Cayalá', despachos: 11, fill: '#6B8AFF' },
  { name: 'Oakland', despachos: 7, fill: '#06B6D4' },
  { name: 'Zona 14', despachos: 8, fill: '#22D3EE' },
  { name: 'Majadas', despachos: 6, fill: '#67E8F9' },
  { name: 'Pradera', despachos: 10, fill: '#3B82F6' },
  { name: 'Antigua', despachos: 4, fill: '#818CF8' },
];

export const dailyMovements = [
  { dia: 'Lun', entradas: 45, salidas: 38, trasiegos: 12 },
  { dia: 'Mar', entradas: 52, salidas: 44, trasiegos: 8 },
  { dia: 'Mié', entradas: 38, salidas: 51, trasiegos: 15 },
  { dia: 'Jue', entradas: 60, salidas: 42, trasiegos: 10 },
  { dia: 'Vie', entradas: 48, salidas: 55, trasiegos: 18 },
  { dia: 'Sáb', entradas: 22, salidas: 30, trasiegos: 5 },
  { dia: 'Hoy', entradas: 35, salidas: 28, trasiegos: 7 },
];

export const zoneDistribution = [
  { name: 'Ambiente', value: 35, fill: '#10B981' },
  { name: 'Refrigerado', value: 42, fill: '#3B82F6' },
  { name: 'Congelado', value: 23, fill: '#6366F1' },
];

// --- HELPER ---
export function getDaysUntilExpiry(dateStr: string): number {
  const expiry = new Date(dateStr);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getExpiryClass(days: number): string {
  if (days <= 7) return 'expiry-critical';
  if (days <= 30) return 'expiry-warning';
  return 'expiry-ok';
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
