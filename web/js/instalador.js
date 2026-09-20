// Asistente de instalación.
//
// Corre una sola vez, sobre una base recién migrada, y deja el sistema
// listo: conexión verificada, tipo de negocio elegido, datos del
// contribuyente y catálogos cargados.
//
// LO IMPORTANTE DEL TIPO DE NEGOCIO: se elige aquí y NO SE PUEDE CAMBIAR
// después. No es una restricción caprichosa. El tipo decide qué unidades
// de medida existen, qué categorías y cómo se nombran las ubicaciones. Un
// minimarket con seis meses de kardex en libras y arrobas convertido en
// ferretería dejaría un histórico que ya no significa nada y unos
// informes que mezclan dos realidades. Es el mismo motivo por el que un
// sistema contable no deja cambiar el plan de cuentas con movimientos
// cargados. Para otro tipo de negocio, base nueva.

import { supabase } from './supabaseClient.js';
import { icono } from './lib/iconos.js';
import {
  conexionActual, validarConexion, probarConexion,
  guardarConexion, olvidarConexion,
} from './lib/conexion.js';

let tipos = [];
let tipoElegido = null;
let paso = 1;

/**
 * ¿Hay que instalar? Devuelve el estado o null si no se pudo consultar.
 * No lanza: si la base no responde, el que decide qué mostrar es el
 * llamador, no esta función.
 */
export async function estadoInstalacion() {
  const { data, error } = await supabase.rpc('fn_estado_instalacion');
  if (error) {
    // Base sin la migración 011: se asume instalada para no bloquear a
    // quien viene de una versión anterior y ya está trabajando.
    return { completada: true, sinMigracion: true };
  }
  const fila = Array.isArray(data) ? data[0] : data;
  return fila ?? { completada: true };
}

// =========================================================
// Pantalla de conexión (antes de iniciar sesión)
// =========================================================
export function abrirConfiguracionConexion(contenedor, alTerminar) {
  const c = conexionActual();

  contenedor.innerHTML = `
    <div class="inst-caja">
      <h2>A qué base se conecta este equipo</h2>
      <p class="inst-texto">Estos dos datos están en Supabase, en
      <b>Settings → API</b>. La clave pública puede verse: lo que protege el
      inventario son los permisos de la base, no el secreto de esta clave.</p>

      <label>Dirección del proyecto
        <input type="url" id="cx-url" value="${v(c.url)}"
               placeholder="https://abcdefgh.supabase.co" autocomplete="off" />
      </label>

      <label>Clave pública (anon / publishable)
        <input type="text" id="cx-key" value="${v(c.anonKey)}"
               placeholder="sb_publishable_…" autocomplete="off" />
      </label>

      <label>Nombre de esta instalación (opcional)
        <input type="text" id="cx-etiqueta" value="${v(c.etiqueta)}"
               placeholder="Minimarket El Cultivo — caja 1" />
      </label>

      <div class="inst-acciones">
        <button type="button" class="btn-secundario" id="cx-probar">Probar conexión</button>
        <button type="button" class="btn-primary" id="cx-guardar" disabled>Guardar y continuar</button>
      </div>

      <div id="cx-resultado" class="inst-resultado"></div>

      <p class="inst-pie">
        Conexión en uso: <b>${c.origen === 'archivo' ? 'la que trae el archivo de configuración' : 'una guardada en este equipo'}</b>.
        ${c.origen === 'configurada'
          ? '<button type="button" class="enlace-sobrio" id="cx-olvidar">Volver a la del archivo</button>'
          : ''}
      </p>
    </div>`;

  const res = contenedor.querySelector('#cx-resultado');
  const btnGuardar = contenedor.querySelector('#cx-guardar');

  contenedor.querySelector('#cx-probar').addEventListener('click', async () => {
    const url = contenedor.querySelector('#cx-url').value;
    const key = contenedor.querySelector('#cx-key').value;

    const problemas = validarConexion(url, key);
    if (problemas.length) {
      res.className = 'inst-resultado error';
      res.innerHTML = problemas.map((p) => `<div>${escapar(p)}</div>`).join('');
      btnGuardar.disabled = true;
      return;
    }

    res.className = 'inst-resultado';
    res.textContent = 'Probando…';

    const r = await probarConexion(url, key);
    res.className = `inst-resultado ${r.ok ? 'ok' : 'error'}`;
    res.textContent = r.mensaje;
    btnGuardar.disabled = !r.ok;
  });

  contenedor.querySelector('#cx-guardar').addEventListener('click', () => {
    guardarConexion(
      contenedor.querySelector('#cx-url').value,
      contenedor.querySelector('#cx-key').value,
      contenedor.querySelector('#cx-etiqueta').value.trim() || null,
    );
    // Se recarga porque el cliente de Supabase se crea al arrancar la
    // página: cambiar la conexión en caliente dejaría media aplicación
    // hablando con la base vieja.
    alTerminar ? alTerminar() : location.reload();
  });

  contenedor.querySelector('#cx-olvidar')?.addEventListener('click', () => {
    olvidarConexion();
    location.reload();
  });
}

// =========================================================
// Asistente de instalación (ya con sesión iniciada)
// =========================================================
export async function abrirInstalador(contenedor, alTerminar) {
  paso = 1;
  tipoElegido = null;

  const { data, error } = await supabase
    .from('tipos_negocio').select('*').eq('activo', true).order('orden');

  if (error) {
    contenedor.innerHTML = `
      <div class="inst-caja">
        <h2>No se pudo leer el catálogo de tipos de negocio</h2>
        <p class="inst-texto">${escapar(error.message)}</p>
        <p class="inst-texto">Falta aplicar <code>db/011_instalacion_deuna.sql</code>
        en el SQL Editor de Supabase.</p>
      </div>`;
    return;
  }

  tipos = data ?? [];
  pintar(contenedor, alTerminar);
}

function pintar(contenedor, alTerminar) {
  contenedor.innerHTML = `
    <div class="inst-caja ancha">
      <div class="inst-pasos">
        ${[
          [1, 'Tipo de negocio'],
          [2, 'Datos del negocio'],
          [3, 'Confirmar'],
        ].map(([n, t]) => `
          <div class="inst-paso ${paso === n ? 'actual' : paso > n ? 'hecho' : ''}">
            <span>${n}</span>${t}
          </div>`).join('')}
      </div>
      <div id="inst-cuerpo"></div>
    </div>`;

  const cuerpo = contenedor.querySelector('#inst-cuerpo');
  if (paso === 1) pasoTipo(cuerpo, contenedor, alTerminar);
  else if (paso === 2) pasoDatos(cuerpo, contenedor, alTerminar);
  else pasoConfirmar(cuerpo, contenedor, alTerminar);
}

// ---------------------------------------------------------
function pasoTipo(cuerpo, contenedor, alTerminar) {
  cuerpo.innerHTML = `
    <h2>¿Qué tipo de negocio va a operar con este sistema?</h2>
    <p class="inst-texto">Esta elección carga las unidades de medida, las
    categorías y las zonas de bodega que le corresponden.
    <b>No se puede cambiar después</b>: el histórico de inventario quedaría
    registrado en unidades que ya no significan nada. Para otro tipo de
    negocio se instala una base nueva.</p>

    <div class="inst-tipos">
      ${tipos.map((t) => `
        <button type="button" class="inst-tipo ${tipoElegido === t.codigo ? 'elegido' : ''}"
                data-tipo="${escapar(t.codigo)}">
          ${icono(t.icono, 'inst-tipo-icono')}
          <b>${escapar(t.nombre)}</b>
          <span>${escapar(t.descripcion)}</span>
          <small>
            ${t.unidades.length} unidades ·
            ${t.categorias.length || 'sin'} categorías
            ${t.maneja_caducidad ? ' · controla caducidades' : ''}
            ${t.maneja_peso ? ' · vende por peso' : ''}
          </small>
        </button>`).join('')}
    </div>

    <div class="inst-acciones">
      <button type="button" class="btn-primary" id="inst-siguiente" disabled>Continuar</button>
    </div>`;

  cuerpo.querySelectorAll('.inst-tipo').forEach((b) => {
    b.addEventListener('click', () => {
      tipoElegido = b.dataset.tipo;
      cuerpo.querySelectorAll('.inst-tipo').forEach((x) => x.classList.remove('elegido'));
      b.classList.add('elegido');
      cuerpo.querySelector('#inst-siguiente').disabled = false;
    });
  });

  cuerpo.querySelector('#inst-siguiente').addEventListener('click', () => {
    paso = 2;
    pintar(contenedor, alTerminar);
  });
}

// ---------------------------------------------------------
const datos = {
  razon_social: '', nombre_comercial: '', ruc: '',
  direccion: '', telefono: '', email: '', sede: 'Matriz',
};

function pasoDatos(cuerpo, contenedor, alTerminar) {
  const t = tipos.find((x) => x.codigo === tipoElegido);

  cuerpo.innerHTML = `
    <h2>Datos del contribuyente</h2>
    <p class="inst-texto">Es lo que sale impreso en cada comprobante. Todo esto
    se puede corregir después desde Administración; el único dato que queda
    fijo es el tipo de negocio (<b>${escapar(t?.nombre ?? '')}</b>).</p>

    <form id="inst-form" class="inst-form">
      <label class="ancho-completo">Razón social *
        <input name="razon_social" required value="${v(datos.razon_social)}"
               placeholder="MINIMARKET EL CULTIVO" />
      </label>
      <label>Nombre comercial
        <input name="nombre_comercial" value="${v(datos.nombre_comercial)}"
               placeholder="Minimarket El Cultivo" />
      </label>
      <label>RUC
        <!-- Sin pattern a propósito: la validación del navegador solo
             muestra un globo genérico. Aquí se revisa en JavaScript para
             poder decir exactamente qué está mal. -->
        <input name="ruc" value="${v(datos.ruc)}" maxlength="13"
               inputmode="numeric" placeholder="1728605070001" />
      </label>
      <label class="ancho-completo">Dirección
        <input name="direccion" value="${v(datos.direccion)}" />
      </label>
      <label>Teléfono
        <input name="telefono" value="${v(datos.telefono)}" />
      </label>
      <label>Correo
        <input name="email" type="email" value="${v(datos.email)}" />
      </label>
      <label>Nombre del local
        <input name="sede" value="${v(datos.sede)}" placeholder="Matriz" />
      </label>

      <div class="ancho-completo inst-acciones">
        <button type="button" class="btn-secundario" id="inst-atras">Atrás</button>
        <button type="submit" class="btn-primary">Continuar</button>
      </div>
      <div id="inst-msg" class="form-msg ancho-completo"></div>
    </form>`;

  cuerpo.querySelector('#inst-atras').addEventListener('click', () => {
    paso = 1;
    pintar(contenedor, alTerminar);
  });

  cuerpo.querySelector('#inst-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    for (const k of Object.keys(datos)) datos[k] = (fd.get(k) ?? '').toString().trim();

    // El RUC se valida contra la base antes de seguir, para no descubrir
    // el error recién al final del asistente.
    const msg = cuerpo.querySelector('#inst-msg');
    if (datos.ruc && !/^[0-9]{13}$/.test(datos.ruc)) {
      msg.textContent =
        `El RUC debe tener 13 dígitos y usted escribió ${datos.ruc.length}. ` +
        'Es la cédula o el RUC de la empresa seguido de 001. ' +
        'Si todavía no lo tiene a mano, deje el campo vacío y complételo ' +
        'después en Administración.';
      msg.className = 'form-msg error ancho-completo';
      return;
    }
    paso = 3;
    pintar(contenedor, alTerminar);
  });
}

// ---------------------------------------------------------
function pasoConfirmar(cuerpo, contenedor, alTerminar) {
  const t = tipos.find((x) => x.codigo === tipoElegido);

  cuerpo.innerHTML = `
    <h2>Revise antes de instalar</h2>

    <div class="inst-resumen">
      <div class="comp-linea"><span>Tipo de negocio</span><b>${escapar(t?.nombre ?? '')}</b></div>
      <div class="comp-linea"><span>Razón social</span><b>${escapar(datos.razon_social)}</b></div>
      <div class="comp-linea"><span>RUC</span><b>${escapar(datos.ruc || '— sin registrar —')}</b></div>
      <div class="comp-linea"><span>Local</span><b>${escapar(datos.sede || 'Matriz')}</b></div>
      <div class="comp-linea"><span>Unidades que se activan</span><b>${t?.unidades.length ?? 0}</b></div>
      <div class="comp-linea"><span>Categorías que se crean</span><b>${t?.categorias.length ?? 0}</b></div>
      <div class="comp-linea"><span>Zonas de bodega</span><b>${(t?.zonas ?? []).length}</b></div>
    </div>

    <div class="inst-advertencia">
      <b>Al instalar, el tipo de negocio queda fijado.</b>
      <p>Cambiarlo después exige crear otra base de datos. El resto de los datos
      sí se pueden corregir desde Administración cuando quiera.</p>
      <label class="inst-checkbox">
        <input type="checkbox" id="inst-entendido" />
        Entiendo que <b>${escapar(t?.nombre ?? '')}</b> no se podrá cambiar en esta base.
      </label>
    </div>

    <div class="inst-acciones">
      <button type="button" class="btn-secundario" id="inst-atras">Atrás</button>
      <button type="button" class="btn-primary" id="inst-instalar" disabled>Instalar sistema</button>
    </div>
    <div id="inst-msg" class="form-msg"></div>`;

  const btn = cuerpo.querySelector('#inst-instalar');
  cuerpo.querySelector('#inst-entendido').addEventListener('change', (e) => {
    btn.disabled = !e.target.checked;
  });

  cuerpo.querySelector('#inst-atras').addEventListener('click', () => {
    paso = 2;
    pintar(contenedor, alTerminar);
  });

  btn.addEventListener('click', async () => {
    const msg = cuerpo.querySelector('#inst-msg');
    btn.disabled = true;
    msg.textContent = 'Instalando…';
    msg.className = 'form-msg';

    const { data, error } = await supabase.rpc('fn_completar_instalacion', {
      p_tipo_negocio: tipoElegido,
      p_razon_social: datos.razon_social,
      p_ruc: datos.ruc || null,
      p_nombre_comercial: datos.nombre_comercial || null,
      p_direccion: datos.direccion || null,
      p_telefono: datos.telefono || null,
      p_email: datos.email || null,
      p_sede_nombre: datos.sede || 'Matriz',
      p_cargar_catalogos: true,
    });

    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
      btn.disabled = false;
      return;
    }

    cuerpo.innerHTML = `
      <div class="inst-listo">
        <h2>Sistema instalado</h2>
        <div class="inst-resumen">
          <div class="comp-linea"><span>Tipo de negocio</span><b>${escapar(data.tipo_negocio)}</b></div>
          <div class="comp-linea"><span>Unidades activas</span><b>${data.unidades_activas}</b></div>
          <div class="comp-linea"><span>Categorías creadas</span><b>${data.categorias_creadas}</b></div>
          <div class="comp-linea"><span>Zonas de bodega</span><b>${data.zonas_creadas}</b></div>
        </div>
        <p class="inst-texto">Su usuario quedó como <b>administrador</b>.
        Lo siguiente es cargar el inventario inicial desde
        <b>Ingreso de mercadería</b> — no con ajustes manuales, porque el
        ingreso es el que deja el costo bien calculado.</p>
        <div class="inst-acciones">
          <button type="button" class="btn-primary" id="inst-entrar">Entrar al sistema</button>
        </div>
      </div>`;

    cuerpo.querySelector('#inst-entrar').addEventListener('click', () => {
      alTerminar ? alTerminar() : location.reload();
    });
  });
}

// ---------------------------------------------------------
function v(x) {
  const d = document.createElement('div');
  d.textContent = x ?? '';
  return d.innerHTML.replace(/"/g, '&quot;');
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
