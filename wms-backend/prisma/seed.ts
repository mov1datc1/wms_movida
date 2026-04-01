import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌮 Seeding Taco Bell WMS database...\n');

  // --- 1. Warehouses ---
  console.log('📦 Creating warehouses...');
  const cedisGT = await prisma.warehouse.upsert({
    where: { codigo: 'CEDIS-GT' },
    update: {},
    create: {
      codigo: 'CEDIS-GT',
      nombre: 'CEDIS Guatemala',
      direccion: 'Zona 12, Ciudad de Guatemala',
      ciudad: 'Guatemala',
      activo: true,
    },
  });

  const cedisMX = await prisma.warehouse.upsert({
    where: { codigo: 'CEDIS-MX' },
    update: {},
    create: {
      codigo: 'CEDIS-MX',
      nombre: 'CEDIS Mixco',
      direccion: 'San Cristóbal, Mixco',
      ciudad: 'Mixco',
      activo: true,
    },
  });

  console.log(`  ✅ ${cedisGT.nombre} (${cedisGT.id})`);
  console.log(`  ✅ ${cedisMX.nombre} (${cedisMX.id})`);

  // --- 2. SKUs ---
  console.log('\n🏷️ Creating SKUs...');
  const skuData = [
    { codigoDynamics: 'TB-SAL-001', descripcion: 'Salsa Taco Supreme 500g', categoria: 'Salsas', uomBase: 'UN', temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-SAL-002', descripcion: 'Salsa Chipotle 350g', categoria: 'Salsas', uomBase: 'UN', temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-TOR-001', descripcion: 'Tortilla Harina 12" x24', categoria: 'Tortillas', uomBase: 'PAQ', temperaturaRequerida: 'CONGELADO', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-TOR-002', descripcion: 'Tortilla Maíz Crujiente x36', categoria: 'Tortillas', uomBase: 'PAQ', temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-CAR-001', descripcion: 'Carne Molida Seasoned 5Kg', categoria: 'Proteínas', uomBase: 'KG', temperaturaRequerida: 'CONGELADO', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-CAR-002', descripcion: 'Pollo Grilled Strips 3Kg', categoria: 'Proteínas', uomBase: 'KG', temperaturaRequerida: 'CONGELADO', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-QUE-001', descripcion: 'Queso Cheddar Rallado 2Kg', categoria: 'Lácteos', uomBase: 'KG', temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-QUE-002', descripcion: 'Crema Agria 1.5Kg', categoria: 'Lácteos', uomBase: 'KG', temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-FRI-001', descripcion: 'Frijoles Refritos 2Kg', categoria: 'Insumos Base', uomBase: 'KG', temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-VEG-001', descripcion: 'Lechuga Iceberg Picada 1Kg', categoria: 'Vegetales', uomBase: 'KG', temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-VEG-002', descripcion: 'Tomate Cubos 1Kg', categoria: 'Vegetales', uomBase: 'KG', temperaturaRequerida: 'REFRIGERADO', familiaCalidad: 'ALIMENTO' },
    { codigoDynamics: 'TB-EMP-001', descripcion: 'Bolsa Kraft Delivery x500', categoria: 'Empaques', uomBase: 'PAQ', requiereLote: false, requiereVencimiento: false, temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'EMPAQUE' },
    { codigoDynamics: 'TB-EMP-002', descripcion: 'Caja Combo Meal x200', categoria: 'Empaques', uomBase: 'PAQ', requiereLote: false, requiereVencimiento: false, temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'EMPAQUE' },
    { codigoDynamics: 'TB-LIM-001', descripcion: 'Desinfectante Industrial 5L', categoria: 'Químicos', uomBase: 'UN', temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'QUIMICO' },
    { codigoDynamics: 'TB-LIM-002', descripcion: 'Sanitizante Manos 500ml x12', categoria: 'Químicos', uomBase: 'PAQ', temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'QUIMICO' },
    { codigoDynamics: 'TB-UNI-001', descripcion: 'Camisa Polo Crew M', categoria: 'Uniformes', uomBase: 'UN', requiereLote: false, requiereVencimiento: false, temperaturaRequerida: 'AMBIENTE', familiaCalidad: 'TEXTIL' },
  ];

  const skus: Record<string, any> = {};
  for (const sku of skuData) {
    const created = await prisma.skuMaster.upsert({
      where: { codigoDynamics: sku.codigoDynamics },
      update: {},
      create: {
        codigoDynamics: sku.codigoDynamics,
        descripcion: sku.descripcion,
        categoria: sku.categoria,
        uomBase: sku.uomBase,
        requiereLote: sku.requiereLote ?? true,
        requiereVencimiento: sku.requiereVencimiento ?? true,
        temperaturaRequerida: sku.temperaturaRequerida,
        familiaCalidad: sku.familiaCalidad,
      },
    });
    skus[sku.codigoDynamics] = created;
    console.log(`  ✅ ${sku.codigoDynamics} — ${sku.descripcion}`);
  }

  // --- 3. Restaurantes ---
  console.log('\n🏪 Creating restaurants...');
  const restData = [
    { nombre: 'Taco Bell Zona 10 Unicentro', zona: 'Zona 10', direccion: 'C.C. Unicentro, Zona 10' },
    { nombre: 'Taco Bell Zona 14 Avia', zona: 'Zona 14', direccion: 'C.C. Avia, Blvd Vista Hermosa' },
    { nombre: 'Taco Bell Miraflores', zona: 'Zona 11', direccion: 'C.C. Miraflores, Calzada Roosevelt' },
    { nombre: 'Taco Bell Pradera Concepción', zona: 'Zona 17', direccion: 'C.C. Pradera Concepción, Km 12' },
    { nombre: 'Taco Bell Oakland Mall', zona: 'Zona 10', direccion: 'C.C. Oakland Mall, Diagonal 6' },
    { nombre: 'Taco Bell Majadas', zona: 'Zona 11', direccion: 'C.C. Majadas, Calzada San Juan' },
    { nombre: 'Taco Bell Portales', zona: 'Zona 17', direccion: 'C.C. Portales, 15 Avenida' },
    { nombre: 'Taco Bell Cayalá', zona: 'Zona 16', direccion: 'Paseo Cayalá, Zona 16' },
    { nombre: 'Taco Bell Mixco', zona: 'Mixco', direccion: 'Blvd El Naranjo, Mixco' },
    { nombre: 'Taco Bell Antigua', zona: 'Sacatepéquez', direccion: 'Portal del Comercio, Antigua' },
  ];

  for (const rest of restData) {
    await prisma.restaurante.create({ data: rest });
    console.log(`  ✅ ${rest.nombre}`);
  }

  // --- 4. Locations ---
  console.log('\n📍 Creating locations...');
  const locData = [
    { codigo: 'REF-A01-R01-N1', zona: 'Refrigerado', pasillo: 'A01', rack: 'R01', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 78, estado: 'OCUPADO' },
    { codigo: 'REF-A03-R01-N2', zona: 'Refrigerado', pasillo: 'A03', rack: 'R01', nivel: 'N2', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 60, estado: 'OCUPADO' },
    { codigo: 'REF-A03-R02-N1', zona: 'Refrigerado', pasillo: 'A03', rack: 'R02', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 95, estado: 'OCUPADO' },
    { codigo: 'REF-A04-R01-N2', zona: 'Refrigerado', pasillo: 'A04', rack: 'R01', nivel: 'N2', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 45, estado: 'OCUPADO' },
    { codigo: 'REF-A05-R01-N2', zona: 'Refrigerado', pasillo: 'A05', rack: 'R01', nivel: 'N2', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 68, estado: 'OCUPADO' },
    { codigo: 'REF-A06-R02-N1', zona: 'Refrigerado', pasillo: 'A06', rack: 'R02', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'REFRIGERADO', capacidad: 100, ocupacion: 0, estado: 'LIBRE' },
    { codigo: 'CONG-B07-R03-N1', zona: 'Congelado', pasillo: 'B07', rack: 'R03', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'CONGELADO', capacidad: 80, ocupacion: 55, estado: 'OCUPADO' },
    { codigo: 'CONG-B08-R01-N2', zona: 'Congelado', pasillo: 'B08', rack: 'R01', nivel: 'N2', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'CONGELADO', capacidad: 80, ocupacion: 0, estado: 'BLOQUEADO' },
    { codigo: 'CONG-B10-R01-N3', zona: 'Congelado', pasillo: 'B10', rack: 'R01', nivel: 'N3', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'CONGELADO', capacidad: 80, ocupacion: 72, estado: 'OCUPADO' },
    { codigo: 'CONG-B10-R02-N1', zona: 'Congelado', pasillo: 'B10', rack: 'R02', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'CUARENTENA', temperatura: 'CONGELADO', capacidad: 80, ocupacion: 80, estado: 'OCUPADO' },
    { codigo: 'AMB-C12-R01-N3', zona: 'Ambiente', pasillo: 'C12', rack: 'R01', nivel: 'N3', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'AMBIENTE', capacidad: 120, ocupacion: 50, estado: 'OCUPADO' },
    { codigo: 'AMB-C15-R02-N1', zona: 'Ambiente', pasillo: 'C15', rack: 'R02', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'PICKING', temperatura: 'AMBIENTE', capacidad: 120, ocupacion: 88, estado: 'OCUPADO' },
    { codigo: 'AMB-C18-R03-N2', zona: 'Ambiente', pasillo: 'C18', rack: 'R03', nivel: 'N2', posicion: 'P1', tipoUbicacion: 'RESERVA', temperatura: 'AMBIENTE', capacidad: 120, ocupacion: 0, estado: 'LIBRE' },
    { codigo: 'AMB-D20-R01-N1', zona: 'Ambiente', pasillo: 'D20', rack: 'R01', nivel: 'N1', posicion: 'P1', tipoUbicacion: 'QUIMICOS', temperatura: 'AMBIENTE', capacidad: 60, ocupacion: 30, estado: 'OCUPADO' },
    { codigo: 'RECIBO-01', zona: 'Recibo', pasillo: '-', rack: '-', nivel: '-', posicion: '-', tipoUbicacion: 'RECIBO', temperatura: 'AMBIENTE', capacidad: 200, ocupacion: 0, estado: 'LIBRE' },
    { codigo: 'STAGING-01', zona: 'Despacho', pasillo: '-', rack: '-', nivel: '-', posicion: '-', tipoUbicacion: 'STAGING', temperatura: 'AMBIENTE', capacidad: 150, ocupacion: 35, estado: 'OCUPADO' },
  ];

  for (const loc of locData) {
    await prisma.location.upsert({
      where: { codigo: loc.codigo },
      update: {},
      create: { ...loc, almacenId: cedisGT.id },
    });
    console.log(`  ✅ ${loc.codigo} (${loc.zona} · ${loc.tipoUbicacion})`);
  }

  // --- 5. Quality Rules ---
  console.log('\n🛡️ Creating quality rules...');
  const rules = [
    { categoriaProducto: 'ALIMENTO', incompatibilidades: 'QUIMICO', zonaPermitida: 'AMBIENTE,REFRIGERADO,CONGELADO', restriccionesAlergeno: 'RACK_DEDICADO' },
    { categoriaProducto: 'QUIMICO', incompatibilidades: 'ALIMENTO,TEXTIL', zonaPermitida: 'AMBIENTE', restriccionesQuimico: 'SECCION_AISLADA' },
    { categoriaProducto: 'EMPAQUE', incompatibilidades: null, zonaPermitida: 'AMBIENTE' },
    { categoriaProducto: 'TEXTIL', incompatibilidades: 'QUIMICO', zonaPermitida: 'AMBIENTE' },
  ];

  for (const rule of rules) {
    await prisma.qualityRule.upsert({
      where: { categoriaProducto: rule.categoriaProducto },
      update: {},
      create: rule,
    });
    console.log(`  ✅ ${rule.categoriaProducto}`);
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log(`   📦 ${Object.keys(skus).length} SKUs`);
  console.log(`   🏪 ${restData.length} Restaurantes`);
  console.log(`   📍 ${locData.length} Ubicaciones`);
  console.log(`   🛡️ ${rules.length} Reglas de Calidad`);
  console.log(`   🏗️ 2 Almacenes\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
