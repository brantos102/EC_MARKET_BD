#!/usr/bin/env node
// Genera db/006_seed_ecuador.sql con un catálogo realista de consumo
// en Quito. Los EAN-13 se calculan con dígito verificador válido
// (prefijo 786 = Ecuador en GS1), no se inventan a mano.
//
// Uso:  node db/generar_seed.mjs

import { writeFileSync } from 'node:fs';
import { calcularDigitoEAN13 } from '../web/js/lib/ean13.js';

let contador = 10000;
function ean(empresa) {
  contador += 1;
  const base = `786${String(empresa).padStart(4, '0')}${String(contador).padStart(5, '0')}`;
  return base + calcularDigitoEAN13(base);
}

const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

// ---------------------------------------------------------
// Zonas del market
// ---------------------------------------------------------
const zonas = [
  { codigo: 'PER', nombre: 'Perecibles - Frutas y Verduras', cons: 'AMBIENTE',    orden: 1, color: '#22c55e', pasillos: ['A', 'B'], estantes: 4, niveles: 3 },
  { codigo: 'CAR', nombre: 'Carnes y Embutidos',             cons: 'REFRIGERADO', orden: 2, color: '#ef4444', pasillos: ['C'],      estantes: 3, niveles: 2 },
  { codigo: 'LAC', nombre: 'Lácteos y Huevos',               cons: 'REFRIGERADO', orden: 3, color: '#60a5fa', pasillos: ['D'],      estantes: 3, niveles: 3 },
  { codigo: 'ABA', nombre: 'Abarrotes y Granos',             cons: 'AMBIENTE',    orden: 4, color: '#f59e0b', pasillos: ['E', 'F'], estantes: 5, niveles: 4 },
  { codigo: 'BEB', nombre: 'Bebidas',                        cons: 'AMBIENTE',    orden: 5, color: '#06b6d4', pasillos: ['G'],      estantes: 4, niveles: 3 },
  { codigo: 'LIC', nombre: 'Licores',                        cons: 'AMBIENTE',    orden: 6, color: '#a855f7', pasillos: ['H'],      estantes: 3, niveles: 3 },
  { codigo: 'SNK', nombre: 'Snacks y Confitería',            cons: 'AMBIENTE',    orden: 7, color: '#ec4899', pasillos: ['I'],      estantes: 4, niveles: 4 },
  { codigo: 'LIM', nombre: 'Limpieza y Hogar',               cons: 'AMBIENTE',    orden: 8, color: '#64748b', pasillos: ['J'],      estantes: 4, niveles: 3 },
];

const categorias = [
  ['Frutas', 'Fruta fresca nacional e importada'],
  ['Verduras y Hortalizas', 'Producto agrícola en estado natural'],
  ['Carnes', 'Res, cerdo, pollo y pescado'],
  ['Embutidos', 'Productos cárnicos procesados'],
  ['Lácteos y Huevos', 'Leche, queso, yogurt y huevos'],
  ['Granos y Cereales', 'Granos secos, arroz y harinas'],
  ['Abarrotes', 'Despensa básica no perecible'],
  ['Bebidas', 'Gaseosas, aguas y jugos'],
  ['Licores', 'Cervezas, destilados y vinos'],
  ['Snacks y Confitería', 'Pasabocas, galletas y dulces'],
  ['Limpieza', 'Aseo del hogar'],
  ['Cuidado Personal', 'Higiene personal'],
];

const proveedores = [
  ['1790016919001', 'CORPORACION FAVORITA C.A.',        'Supermaxi Mayorista'],
  ['1791251237001', 'DISTRIBUIDORA JUAN ELJURI CIA LTDA','Eljuri Distribución'],
  ['1790368718001', 'PRONACA C.A.',                      'Pronaca'],
  ['0190123456001', 'MERCADO MAYORISTA DE QUITO S.A.',   'Mayorista Quito'],
  ['1792345678001', 'DISTRIBUIDORA ANDINA DE ALIMENTOS', 'Andina Alimentos'],
];

// tipo: [codigo, nombre, marca, categoria, zona, unidad, precioMenor, precioMayor,
//        minMayor, impuesto, manejaLote, diasAlerta, stockMin, costo, diasCaducidad]
const IVA0 = 'IVA_CERO';
const IVA = 'IVA_GENERAL';

const productos = [
  // ---- FRUTAS ----
  ['FRU-001', 'Guineo de seda',        null,          'Frutas', 'PER', 'LB',    0.35, 0.28, 25, IVA0, true, 5,  30, 0.22, 12],
  ['FRU-002', 'Manzana Royal Gala',    null,          'Frutas', 'PER', 'LB',    0.90, 0.75, 25, IVA0, true, 10, 20, 0.58, 25],
  ['FRU-003', 'Naranja Valencia',      null,          'Frutas', 'PER', 'UND',   0.15, 0.10, 50, IVA0, true, 10, 100,0.07, 20],
  ['FRU-004', 'Naranjilla',            null,          'Frutas', 'PER', 'LB',    1.25, 1.00, 20, IVA0, true, 5,  15, 0.78, 10],
  ['FRU-005', 'Tomate de árbol',       null,          'Frutas', 'PER', 'LB',    0.90, 0.70, 20, IVA0, true, 7,  20, 0.55, 14],
  ['FRU-006', 'Babaco',                null,          'Frutas', 'PER', 'UND',   2.50, 2.00, 10, IVA0, true, 7,  10, 1.60, 15],
  ['FRU-007', 'Granadilla',            null,          'Frutas', 'PER', 'UND',   0.40, 0.30, 30, IVA0, true, 7,  40, 0.22, 14],
  ['FRU-008', 'Mora de Castilla',      null,          'Frutas', 'PER', 'LB',    1.75, 1.40, 15, IVA0, true, 3,  12, 1.10, 6],
  ['FRU-009', 'Uvilla',                null,          'Frutas', 'PER', 'LB',    1.50, 1.20, 15, IVA0, true, 5,  12, 0.95, 12],
  ['FRU-010', 'Papaya Hawaiana',       null,          'Frutas', 'PER', 'UND',   2.00, 1.60, 10, IVA0, true, 5,  10, 1.25, 10],
  ['FRU-011', 'Piña',                  null,          'Frutas', 'PER', 'UND',   1.50, 1.20, 12, IVA0, true, 7,  15, 0.92, 14],
  ['FRU-012', 'Maracuyá',              null,          'Frutas', 'PER', 'LB',    1.00, 0.80, 20, IVA0, true, 7,  15, 0.62, 15],
  ['FRU-013', 'Limón sutil',           null,          'Frutas', 'PER', 'LB',    0.80, 0.60, 25, IVA0, true, 10, 25, 0.45, 20],
  ['FRU-014', 'Aguacate Fuerte',       null,          'Frutas', 'PER', 'UND',   0.75, 0.60, 24, IVA0, true, 5,  30, 0.45, 10],

  // ---- VERDURAS ----
  ['VER-001', 'Papa Chola',            null,          'Verduras y Hortalizas', 'PER', 'LB',   0.45, 0.35, 50, IVA0, true, 15, 100, 0.27, 30],
  ['VER-002', 'Papa Súper Chola',      null,          'Verduras y Hortalizas', 'PER', 'LB',   0.50, 0.40, 50, IVA0, true, 15, 80,  0.31, 30],
  ['VER-003', 'Cebolla Paiteña',       null,          'Verduras y Hortalizas', 'PER', 'LB',   0.60, 0.45, 30, IVA0, true, 15, 50,  0.35, 30],
  ['VER-004', 'Cebolla Blanca',        null,          'Verduras y Hortalizas', 'PER', 'ATADO',0.75, 0.60, 20, IVA0, true, 5,  25,  0.45, 8],
  ['VER-005', 'Tomate Riñón',          null,          'Verduras y Hortalizas', 'PER', 'LB',   0.70, 0.55, 30, IVA0, true, 5,  40,  0.42, 10],
  ['VER-006', 'Zanahoria Amarilla',    null,          'Verduras y Hortalizas', 'PER', 'LB',   0.50, 0.40, 30, IVA0, true, 12, 40,  0.30, 25],
  ['VER-007', 'Brócoli',               null,          'Verduras y Hortalizas', 'PER', 'UND',  0.90, 0.70, 20, IVA0, true, 5,  20,  0.55, 8],
  ['VER-008', 'Col',                   null,          'Verduras y Hortalizas', 'PER', 'UND',  0.80, 0.65, 20, IVA0, true, 8,  20,  0.48, 14],
  ['VER-009', 'Lechuga Criolla',       null,          'Verduras y Hortalizas', 'PER', 'UND',  0.60, 0.45, 24, IVA0, true, 4,  25,  0.35, 7],
  ['VER-010', 'Choclo',                null,          'Verduras y Hortalizas', 'PER', 'UND',  0.50, 0.40, 30, IVA0, true, 5,  40,  0.30, 8],
  ['VER-011', 'Fréjol Tierno',         null,          'Verduras y Hortalizas', 'PER', 'LB',   1.20, 0.95, 20, IVA0, true, 5,  15,  0.75, 8],
  ['VER-012', 'Arveja Tierna',         null,          'Verduras y Hortalizas', 'PER', 'LB',   1.30, 1.05, 20, IVA0, true, 5,  15,  0.82, 8],
  ['VER-013', 'Haba Tierna',           null,          'Verduras y Hortalizas', 'PER', 'LB',   1.00, 0.80, 20, IVA0, true, 5,  15,  0.62, 8],
  ['VER-014', 'Yuca',                  null,          'Verduras y Hortalizas', 'PER', 'LB',   0.45, 0.35, 30, IVA0, true, 10, 30,  0.27, 18],
  ['VER-015', 'Zapallo',               null,          'Verduras y Hortalizas', 'PER', 'LB',   0.60, 0.45, 25, IVA0, true, 15, 20,  0.36, 30],
  ['VER-016', 'Pimiento Verde',        null,          'Verduras y Hortalizas', 'PER', 'LB',   0.90, 0.70, 20, IVA0, true, 7,  18,  0.55, 12],
  ['VER-017', 'Ají',                   null,          'Verduras y Hortalizas', 'PER', 'LB',   1.50, 1.20, 10, IVA0, true, 7,  8,   0.95, 12],
  ['VER-018', 'Culantro',              null,          'Verduras y Hortalizas', 'PER', 'ATADO',0.30, 0.20, 30, IVA0, true, 3,  30,  0.16, 5],
  ['VER-019', 'Perejil',               null,          'Verduras y Hortalizas', 'PER', 'ATADO',0.30, 0.20, 30, IVA0, true, 3,  30,  0.16, 5],

  // ---- CARNES ----
  ['CAR-001', 'Carne Molida de Res',   null,          'Carnes', 'CAR', 'LB', 2.75, 2.40, 20, IVA0, true, 3, 25, 1.95, 5],
  ['CAR-002', 'Lomo Fino de Res',      null,          'Carnes', 'CAR', 'LB', 4.50, 4.00, 15, IVA0, true, 3, 15, 3.35, 5],
  ['CAR-003', 'Costilla de Res',       null,          'Carnes', 'CAR', 'LB', 2.50, 2.15, 20, IVA0, true, 3, 20, 1.78, 5],
  ['CAR-004', 'Pechuga de Pollo',      'Mr. Pollo',   'Carnes', 'CAR', 'LB', 2.25, 1.95, 25, IVA0, true, 3, 40, 1.62, 6],
  ['CAR-005', 'Pollo Entero',          'Mr. Pollo',   'Carnes', 'CAR', 'LB', 1.85, 1.60, 25, IVA0, true, 3, 35, 1.32, 6],
  ['CAR-006', 'Presa de Pollo',        'Mr. Pollo',   'Carnes', 'CAR', 'LB', 1.95, 1.70, 25, IVA0, true, 3, 30, 1.40, 6],
  ['CAR-007', 'Chuleta de Cerdo',      null,          'Carnes', 'CAR', 'LB', 2.60, 2.25, 20, IVA0, true, 3, 20, 1.86, 5],
  ['CAR-008', 'Costilla de Cerdo',     null,          'Carnes', 'CAR', 'LB', 2.40, 2.10, 20, IVA0, true, 3, 18, 1.72, 5],
  ['CAR-009', 'Tilapia Entera',        null,          'Carnes', 'CAR', 'LB', 2.80, 2.40, 15, IVA0, true, 2, 15, 2.00, 4],
  ['CAR-010', 'Corvina en Filete',     null,          'Carnes', 'CAR', 'LB', 4.25, 3.80, 12, IVA0, true, 2, 10, 3.15, 4],

  // ---- EMBUTIDOS ----
  ['EMB-001', 'Salchicha Vienesa 500g','Juris',       'Embutidos', 'CAR', 'UND', 2.50, 2.20, 12, IVA, true, 10, 20, 1.78, 45],
  ['EMB-002', 'Mortadela Especial',    'Plumrose',    'Embutidos', 'CAR', 'LB',  2.25, 1.95, 15, IVA, true, 7,  15, 1.60, 30],
  ['EMB-003', 'Jamón de Pierna',       'Don Diego',   'Embutidos', 'CAR', 'LB',  3.50, 3.10, 12, IVA, true, 7,  12, 2.52, 30],
  ['EMB-004', 'Chorizo Ambateño',      null,          'Embutidos', 'CAR', 'LB',  3.25, 2.90, 12, IVA, true, 5,  12, 2.35, 20],

  // ---- LÁCTEOS ----
  ['LAC-001', 'Leche Entera 1L',       'Vita',        'Lácteos y Huevos', 'LAC', 'UND', 1.10, 0.95, 24, IVA0, true, 7,  60, 0.82, 21],
  ['LAC-002', 'Leche Entera 1L',       'Toni',        'Lácteos y Huevos', 'LAC', 'UND', 1.15, 1.00, 24, IVA0, true, 7,  50, 0.86, 21],
  ['LAC-003', 'Queso Fresco 500g',     'La Holandesa','Lácteos y Huevos', 'LAC', 'UND', 3.25, 2.90, 12, IVA0, true, 5,  25, 2.38, 15],
  ['LAC-004', 'Yogurt Natural 1L',     'Toni',        'Lácteos y Huevos', 'LAC', 'UND', 2.75, 2.40, 12, IVA,  true, 7,  25, 1.98, 25],
  ['LAC-005', 'Mantequilla 250g',      'Bonella',     'Lácteos y Huevos', 'LAC', 'UND', 2.20, 1.90, 12, IVA0, true, 15, 20, 1.58, 60],
  ['LAC-006', 'Huevos Cubeta x30',     'Indaves',     'Lácteos y Huevos', 'LAC', 'UND', 4.50, 4.00, 10, IVA0, true, 7,  30, 3.30, 21],

  // ---- GRANOS Y ABARROTES ----
  ['ABA-001', 'Arroz Flor 2kg',        'Flor',        'Granos y Cereales', 'ABA', 'UND',  2.85, 2.50, 12, IVA0, true, 60, 60, 2.05, 365],
  ['ABA-002', 'Arroz Gustadina 2kg',   'Gustadina',   'Granos y Cereales', 'ABA', 'UND',  2.75, 2.40, 12, IVA0, true, 60, 50, 1.98, 365],
  ['ABA-003', 'Azúcar Blanca 2kg',     'San Carlos',  'Granos y Cereales', 'ABA', 'UND',  2.40, 2.10, 12, IVA0, true, 60, 50, 1.72, 540],
  ['ABA-004', 'Aceite Girasol 1L',     'La Favorita', 'Abarrotes',         'ABA', 'UND',  2.95, 2.60, 12, IVA0, true, 45, 40, 2.15, 365],
  ['ABA-005', 'Fideo Tallarín 400g',   'Oriental',    'Granos y Cereales', 'ABA', 'UND',  1.15, 0.95, 24, IVA0, true, 60, 60, 0.82, 540],
  ['ABA-006', 'Atún en Aceite 180g',   'Real',        'Abarrotes',         'ABA', 'UND',  1.85, 1.60, 24, IVA0, true, 90, 70, 1.32, 730],
  ['ABA-007', 'Sal Yodada 2kg',        'Cris-Sal',    'Abarrotes',         'ABA', 'UND',  1.10, 0.90, 24, IVA0, true, 90, 40, 0.78, 900],
  ['ABA-008', 'Lenteja',               null,          'Granos y Cereales', 'ABA', 'LB',   1.20, 0.95, 25, IVA0, true, 60, 40, 0.85, 365],
  ['ABA-009', 'Fréjol Canario Seco',   null,          'Granos y Cereales', 'ABA', 'LB',   1.60, 1.35, 25, IVA0, true, 60, 30, 1.15, 365],
  ['ABA-010', 'Quinua',                null,          'Granos y Cereales', 'ABA', 'LB',   2.50, 2.10, 20, IVA0, true, 60, 20, 1.80, 365],
  ['ABA-011', 'Morocho Partido',       null,          'Granos y Cereales', 'ABA', 'LB',   1.10, 0.90, 25, IVA0, true, 60, 25, 0.78, 365],
  ['ABA-012', 'Machica',               null,          'Granos y Cereales', 'ABA', 'LB',   1.30, 1.05, 20, IVA0, true, 45, 20, 0.92, 180],
  ['ABA-013', 'Panela Granulada',      null,          'Abarrotes',         'ABA', 'LB',   1.25, 1.00, 25, IVA0, true, 60, 25, 0.88, 365],
  ['ABA-014', 'Café Instantáneo 170g', 'Nescafé',     'Abarrotes',         'ABA', 'UND',  6.50, 5.90, 12, IVA,  true, 90, 25, 4.85, 730],
  ['ABA-015', 'Avena en Hojuelas 400g','Quaker',      'Granos y Cereales', 'ABA', 'UND',  1.95, 1.65, 18, IVA0, true, 60, 30, 1.38, 365],

  // ---- BEBIDAS ----
  ['BEB-001', 'Coca-Cola 1.35L',       'Coca-Cola',   'Bebidas', 'BEB', 'UND', 1.45, 1.25, 24, IVA, true, 60, 60, 1.05, 270],
  ['BEB-002', 'Fioravanti Fresa 1.35L','Fioravanti',  'Bebidas', 'BEB', 'UND', 1.35, 1.15, 24, IVA, true, 60, 40, 0.98, 270],
  ['BEB-003', 'Agua Mineral 1L',       'Güitig',      'Bebidas', 'BEB', 'UND', 0.85, 0.70, 24, IVA, true, 90, 60, 0.60, 365],
  ['BEB-004', 'Agua sin Gas 500ml',    'Tesalia',     'Bebidas', 'BEB', 'UND', 0.60, 0.45, 36, IVA, true, 90, 80, 0.40, 365],
  ['BEB-005', 'Jugo Durazno 1L',       'Del Valle',   'Bebidas', 'BEB', 'UND', 1.50, 1.25, 24, IVA, true, 45, 35, 1.08, 180],
  ['BEB-006', 'Pony Malta 330ml',      'Pony Malta',  'Bebidas', 'BEB', 'UND', 0.85, 0.70, 24, IVA, true, 60, 40, 0.60, 240],
  ['BEB-007', 'Gatorade 500ml',        'Gatorade',    'Bebidas', 'BEB', 'UND', 1.25, 1.05, 24, IVA, true, 60, 30, 0.90, 270],

  // ---- LICORES ----
  ['LIC-001', 'Cerveza Pilsener 600ml','Pilsener',    'Licores', 'LIC', 'UND', 1.75, 1.50, 24, IVA, false, 90, 60, 1.28, null],
  ['LIC-002', 'Cerveza Club Verde 330ml','Club',      'Licores', 'LIC', 'UND', 1.35, 1.15, 24, IVA, false, 90, 48, 0.98, null],
  ['LIC-003', 'Zhumir Durazno 750ml',  'Zhumir',      'Licores', 'LIC', 'UND', 8.50, 7.60, 12, IVA, false, 90, 20, 6.30, null],
  ['LIC-004', 'Ron San Miguel 750ml',  'San Miguel',  'Licores', 'LIC', 'UND',12.50,11.00, 12, IVA, false, 90, 15, 9.40, null],
  ['LIC-005', 'Vino Tinto 750ml',      'Clos',        'Licores', 'LIC', 'UND', 7.90, 7.00, 12, IVA, false, 90, 18, 5.85, null],

  // ---- SNACKS ----
  ['SNK-001', 'Papas Ruffles 140g',    'Ruffles',     'Snacks y Confitería', 'SNK', 'UND', 2.35, 2.00, 24, IVA, true, 30, 40, 1.68, 120],
  ['SNK-002', 'Tortolines 150g',       'Tortolines',  'Snacks y Confitería', 'SNK', 'UND', 2.10, 1.80, 24, IVA, true, 30, 35, 1.50, 120],
  ['SNK-003', 'Chifles 120g',          'Banchis',     'Snacks y Confitería', 'SNK', 'UND', 1.75, 1.50, 24, IVA, true, 30, 35, 1.25, 90],
  ['SNK-004', 'Nachos Doritos 145g',   'Doritos',     'Snacks y Confitería', 'SNK', 'UND', 2.25, 1.95, 24, IVA, true, 30, 30, 1.60, 120],
  ['SNK-005', 'K-Chitos 140g',         'K-Chitos',    'Snacks y Confitería', 'SNK', 'UND', 1.95, 1.65, 24, IVA, true, 30, 30, 1.38, 120],
  ['SNK-006', 'Galletas Amor 96g',     'Amor',        'Snacks y Confitería', 'SNK', 'UND', 0.85, 0.70, 36, IVA, true, 60, 60, 0.58, 240],
  ['SNK-007', 'Galletas Oreo 108g',    'Oreo',        'Snacks y Confitería', 'SNK', 'UND', 1.15, 0.95, 36, IVA, true, 60, 50, 0.80, 270],
  ['SNK-008', 'Chocolate Manicho',     'Manicho',     'Snacks y Confitería', 'SNK', 'UND', 0.45, 0.35, 48, IVA, true, 60, 100,0.30, 180],
  ['SNK-009', 'Bon Bon Bum',           'Bon Bon Bum', 'Snacks y Confitería', 'SNK', 'UND', 0.30, 0.22, 50, IVA, true, 90, 120,0.18, 365],

  // ---- LIMPIEZA ----
  ['LIM-001', 'Detergente en Polvo 2kg','Deja',       'Limpieza', 'LIM', 'UND', 5.50, 4.90, 12, IVA, false, 90, 25, 4.10, null],
  ['LIM-002', 'Detergente en Polvo 1kg','Fab',        'Limpieza', 'LIM', 'UND', 3.25, 2.85, 12, IVA, false, 90, 25, 2.38, null],
  ['LIM-003', 'Cloro 1L',              'Tips',        'Limpieza', 'LIM', 'UND', 1.25, 1.05, 24, IVA, false, 90, 40, 0.88, null],
  ['LIM-004', 'Lavavajilla 1kg',       'Lava',        'Limpieza', 'LIM', 'UND', 2.75, 2.40, 12, IVA, false, 90, 30, 2.00, null],
  ['LIM-005', 'Papel Higiénico x4',    'Familia',     'Limpieza', 'LIM', 'UND', 2.95, 2.55, 12, IVA, false, 90, 40, 2.15, null],
  ['LIM-006', 'Desinfectante 1L',      'Sapolio',     'Limpieza', 'LIM', 'UND', 2.45, 2.10, 12, IVA, false, 90, 25, 1.78, null],
  ['LIM-007', 'Fundas de Basura x10',  null,          'Limpieza', 'LIM', 'UND', 1.50, 1.25, 24, IVA, false, 90, 35, 1.05, null],
  ['LIM-008', 'Jabón de Tocador 110g', 'Protex',      'Cuidado Personal', 'LIM', 'UND', 1.15, 0.95, 24, IVA, false, 90, 40, 0.80, null],
];

// ---------------------------------------------------------
// Promociones de temporada
// ---------------------------------------------------------
const promociones = [
  {
    codigo: 'PROMO-LIMON-3X1', nombre: '3 limones por $1', temporada: 'Permanente',
    tipo: 'N_POR_DOLAR', cantidad: 3, valor: 1.00,
    desde: '2026-01-01', hasta: '2026-12-31', aplica: 'MENOR', prioridad: 10,
    productos: ['FRU-013'],
  },
  {
    codigo: 'PROMO-NARANJA-4X1', nombre: '4 naranjas por $1', temporada: 'Cosecha',
    tipo: 'N_POR_DOLAR', cantidad: 4, valor: 1.00,
    desde: '2026-01-01', hasta: '2026-12-31', aplica: 'MENOR', prioridad: 10,
    productos: ['FRU-003'],
  },
  {
    codigo: 'PROMO-SNACK-2X1', nombre: '2x1 en snacks seleccionados', temporada: 'Fin de semana',
    tipo: 'N_POR_M', cantidad: 2, valor: 1,
    desde: '2026-01-01', hasta: '2026-12-31', aplica: 'MENOR', prioridad: 5,
    productos: ['SNK-006', 'SNK-008'],
  },
  {
    codigo: 'PROMO-LICOR-NAVIDAD', nombre: '20% en licores por Navidad', temporada: 'Navidad',
    tipo: 'PORCENTAJE', cantidad: null, valor: 20,
    desde: '2026-12-01', hasta: '2026-12-31', aplica: 'AMBAS', prioridad: 8,
    categorias: ['Licores'],
  },
  {
    codigo: 'PROMO-PAPA-FIJO', nombre: 'Papa chola a $0.40 la libra', temporada: 'Cosecha',
    tipo: 'PRECIO_FIJO', cantidad: null, valor: 0.40,
    desde: '2026-01-01', hasta: '2026-12-31', aplica: 'AMBAS', prioridad: 6,
    productos: ['VER-001'],
  },
];

// ---------------------------------------------------------
// Generación del SQL
// ---------------------------------------------------------
const L = [];
L.push(`-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Migración 006: catálogo de ejemplo para un market en Quito.
--
-- ARCHIVO GENERADO por db/generar_seed.mjs — no editar a mano.
-- Los EAN-13 llevan prefijo 786 (Ecuador, GS1) y dígito verificador
-- calculado según ISO/IEC 15420.
--
-- La clasificación de IVA (0% para productos de primera necesidad vs
-- tarifa general) sigue el criterio del Art. 55 de la LRTI, pero debe
-- ser validada por el contador antes de facturar en producción.
--
-- Requiere: 005_auditoria_vistas.sql
-- =========================================================
`);

L.push(`-- Bodega principal (creada en seed_ejemplo.sql o aquí si no existe)
insert into bodegas (nombre, ubicacion) values ('Bodega Principal', 'Quito, Pichincha')
on conflict (nombre) do nothing;
`);

L.push('\n-- ---------- Zonas ----------');
for (const z of zonas) {
  L.push(`insert into zonas (codigo, nombre, tipo_conservacion, orden, color_hex, bodega_id)
select ${q(z.codigo)}, ${q(z.nombre)}, ${q(z.cons)}, ${z.orden}, ${q(z.color)}, b.id
from bodegas b where b.nombre = 'Bodega Principal'
on conflict (codigo) do nothing;`);
}

L.push('\n-- ---------- Ubicaciones (layout físico) ----------');
for (const z of zonas) {
  for (const p of z.pasillos) {
    for (let e = 1; e <= z.estantes; e++) {
      for (let n = 1; n <= z.niveles; n++) {
        L.push(`insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, ${q(p)}, ${e}, ${n}, 200 from zonas z where z.codigo = ${q(z.codigo)}
on conflict (zona_id, pasillo, estante, nivel) do nothing;`);
      }
    }
  }
}

L.push('\n-- ---------- Categorías ----------');
for (const [nombre, desc] of categorias) {
  L.push(`insert into categorias (nombre, descripcion) values (${q(nombre)}, ${q(desc)}) on conflict (nombre) do nothing;`);
}

L.push('\n-- ---------- Proveedores ----------');
for (const [ruc, razon, comercial] of proveedores) {
  L.push(`insert into proveedores (ruc, razon_social, nombre_comercial) values (${q(ruc)}, ${q(razon)}, ${q(comercial)}) on conflict (ruc) do nothing;`);
}

L.push('\n-- ---------- Productos ----------');
const eansPorCodigo = {};
productos.forEach((p, idx) => {
  const [codigo, nombre, marca, categoria, zona, unidad, pMenor, pMayor, minMayor,
         impuesto, lote, diasAlerta, stockMin] = p;
  const empresa = 1000 + (idx % 5);
  const codigoEan = ean(empresa);
  eansPorCodigo[codigo] = codigoEan;

  L.push(`insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select ${q(codigo)}, ${q(nombre)}, ${q(marca)}, ${q(codigoEan)}, c.id, ${q(unidad)}, u.id,
  ${pMenor}, ${pMayor}, ${minMayor}, ${q(impuesto)}, ${lote}, ${diasAlerta}, ${stockMin}, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = ${q(categoria)} and u.codigo = ${q(unidad)}
on conflict (codigo) do nothing;`);
});

L.push('\n-- ---------- Ubicación de cada producto ----------');
const contadorPorZona = {};
productos.forEach((p) => {
  const [codigo, , , , zonaCod] = p;
  const z = zonas.find((x) => x.codigo === zonaCod);
  const key = zonaCod;
  contadorPorZona[key] = (contadorPorZona[key] ?? 0);
  const slots = [];
  for (const pas of z.pasillos) {
    for (let e = 1; e <= z.estantes; e++) {
      for (let n = 1; n <= z.niveles; n++) slots.push([pas, e, n]);
    }
  }
  const [pas, est, niv] = slots[contadorPorZona[key] % slots.length];
  contadorPorZona[key] += 1;

  L.push(`insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = ${q(codigo)} and u.zona_id = z.id and z.codigo = ${q(zonaCod)}
  and u.pasillo = ${q(pas)} and u.estante = ${est} and u.nivel = ${niv}
on conflict (producto_id, ubicacion_id) do nothing;`);
});

L.push('\n-- ---------- Promociones de temporada ----------');
for (const pr of promociones) {
  L.push(`insert into promociones (codigo, nombre, temporada, tipo, cantidad, valor, vigencia_desde, vigencia_hasta, aplica_tipo_venta, prioridad)
values (${q(pr.codigo)}, ${q(pr.nombre)}, ${q(pr.temporada)}, ${q(pr.tipo)}, ${pr.cantidad ?? 'null'}, ${pr.valor}, ${q(pr.desde)}, ${q(pr.hasta)}, ${q(pr.aplica)}, ${pr.prioridad})
on conflict (codigo) do nothing;`);

  for (const cod of pr.productos ?? []) {
    L.push(`insert into promocion_alcance (promocion_id, producto_id)
select pr.id, p.id from promociones pr, productos p
where pr.codigo = ${q(pr.codigo)} and p.codigo = ${q(cod)}
and not exists (select 1 from promocion_alcance pa where pa.promocion_id = pr.id and pa.producto_id = p.id);`);
  }
  for (const cat of pr.categorias ?? []) {
    L.push(`insert into promocion_alcance (promocion_id, categoria_id)
select pr.id, c.id from promociones pr, categorias c
where pr.codigo = ${q(pr.codigo)} and c.nombre = ${q(cat)}
and not exists (select 1 from promocion_alcance pa where pa.promocion_id = pr.id and pa.categoria_id = c.id);`);
  }
}

// ---------------------------------------------------------
// Ingreso inicial de mercadería: un documento por proveedor.
// Al confirmarlo se generan lotes y movimientos de kardex.
// ---------------------------------------------------------
L.push(`
-- ---------- Ingreso inicial de mercadería ----------
-- Se crea un documento de ingreso por proveedor y se confirma, lo que
-- genera automáticamente los lotes y los movimientos de kardex.
-- Solo se ejecuta si aún no existe un ingreso con esta referencia.
do $$
declare
  v_bodega uuid;
  v_doc uuid;
  v_prov uuid;
begin
  select id into v_bodega from bodegas where nombre = 'Bodega Principal';
  if exists (select 1 from documentos_ingreso where numero_documento = '001-001-000000001') then
    raise notice 'El ingreso inicial ya fue cargado; se omite.';
    return;
  end if;
`);

const proveedorPorIndice = proveedores.map((p) => p[0]);
productos.forEach((p, idx) => {
  const [codigo, , , , , , , , , , lote, , stockMin, costo, diasCad] = p;
  const provRuc = proveedorPorIndice[idx % proveedores.length];
  const cantidad = Math.max(stockMin * 3, 30);
  const caducidad = diasCad ? `current_date + ${diasCad}` : 'null';
  const codLote = lote ? `'L-' || to_char(current_date, 'YYYYMMDD') || '-${codigo}'` : 'null';

  if (idx % proveedores.length === 0) {
    const docNum = String(Math.floor(idx / proveedores.length) + 1).padStart(9, '0');
    L.push(`
  select id into v_prov from proveedores where ruc = ${q(provRuc)};
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-${docNum}', current_date, 'Carga inicial de inventario')
  returning id into v_doc;`);
  }

  L.push(`  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, ${cantidad}, ${costo}, ${codLote}, ${caducidad} from productos where codigo = ${q(codigo)};`);
});

L.push(`
  -- Confirmar todos los ingresos creados en este bloque
  update documentos_ingreso set estado = 'CONFIRMADO'
  where estado = 'BORRADOR' and observacion = 'Carga inicial de inventario';
end $$;

-- ---------- Verificación ----------
select 'Productos cargados' as concepto, count(*)::text as valor from productos
union all select 'Con EAN-13 válido', count(*)::text from productos where fn_validar_ean13(ean13) and ean13 is not null
union all select 'Ubicaciones creadas', count(*)::text from ubicaciones
union all select 'Lotes generados', count(*)::text from lotes
union all select 'Valor del inventario', '$' || round(sum(stock * costo_promedio), 2)::text from inventario_saldos;
`);

writeFileSync(new URL('./006_seed_ecuador.sql', import.meta.url), L.join('\n') + '\n');
console.log(`Generado 006_seed_ecuador.sql con ${productos.length} productos, ${zonas.length} zonas y ${promociones.length} promociones.`);
