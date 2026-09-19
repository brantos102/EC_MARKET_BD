// Selección del cliente y del tipo de comprobante en la caja.
//
// El caso normal en un minimarket es consumidor final, y debe costar
// cero clics: por eso es la opción por defecto y ya está lista al abrir
// la caja. Cuando el cliente pide factura, el cajero digita la cédula
// y el sistema busca; si el cliente ya existe, sale con sus datos y se
// sigue vendiendo, y si es nuevo aparece el formulario mínimo para
// registrarlo sin salir de la venta.

import { supabase } from '../supabaseClient.js';
import { abrirModal, cerrarModal } from './modal.js';

/**
 * @param {{clienteId: string, tipoComprobante: string}} actual
 * @param {(sel: {clienteId: string, nombre: string, identificacion: string, tipoComprobante: string}) => void} alElegir
 */
export function abrirSelectorCliente(actual, alElegir) {
  abrirModal({
    ancho: '520px',
    titulo: 'Datos del comprobante',
    contenido: `
      <div class="sel-comprobante">
        <button class="opcion-comprobante ${actual.tipoComprobante !== 'FACTURA' ? 'activa' : ''}"
                data-tipo="NOTA_VENTA">
          <b>Consumidor final</b>
          <span>Nota de venta. No pide datos del cliente.</span>
        </button>
        <button class="opcion-comprobante ${actual.tipoComprobante === 'FACTURA' ? 'activa' : ''}"
                data-tipo="FACTURA">
          <b>Con factura</b>
          <span>Requiere cédula o RUC del cliente.</span>
        </button>
      </div>

      <div id="bloque-factura" class="${actual.tipoComprobante === 'FACTURA' ? '' : 'hidden'}">
        <label class="etq">Cédula, RUC o pasaporte</label>
        <div class="fila-busqueda">
          <input type="text" id="cli-identificacion" inputmode="numeric"
                 placeholder="1710034065" autocomplete="off" maxlength="20" />
          <button type="button" id="btn-buscar-cliente" class="btn-primary">Buscar</button>
        </div>
        <div id="cli-msg" class="form-msg"></div>

        <div id="cli-encontrado" class="hidden panel-cliente"></div>

        <form id="cli-nuevo" class="hidden form-cliente">
          <p class="nota">No está registrado. Complete los datos para crearlo:</p>
          <label>Nombre o razón social
            <input name="nombre" required placeholder="JUAN PEREZ" />
          </label>
          <label>Correo (para enviar la factura)
            <input name="email" type="email" placeholder="cliente@correo.com" />
          </label>
          <label>Teléfono<input name="telefono" placeholder="0999999999" /></label>
          <label>Dirección<input name="direccion" placeholder="Av. Principal y calle" /></label>
          <button type="submit" class="btn-primary">Registrar y usar</button>
        </form>
      </div>
    `,
    botones: [
      { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
      { texto: 'Usar consumidor final', clase: 'btn-primary', accion: usarConsumidorFinal, id: 'btn-usar-cf' },
    ],
    alAbrir: (modal) => {
      let tipo = actual.tipoComprobante === 'FACTURA' ? 'FACTURA' : 'NOTA_VENTA';
      const bloque = modal.querySelector('#bloque-factura');
      const msg = modal.querySelector('#cli-msg');
      const encontrado = modal.querySelector('#cli-encontrado');
      const formNuevo = modal.querySelector('#cli-nuevo');
      const entrada = modal.querySelector('#cli-identificacion');
      const btnCF = modal.querySelector('#btn-usar-cf');

      modal.querySelectorAll('.opcion-comprobante').forEach((btn) => {
        btn.addEventListener('click', () => {
          modal.querySelectorAll('.opcion-comprobante').forEach((b) => b.classList.remove('activa'));
          btn.classList.add('activa');
          tipo = btn.dataset.tipo;
          bloque.classList.toggle('hidden', tipo !== 'FACTURA');
          btnCF.classList.toggle('hidden', tipo === 'FACTURA');
          if (tipo === 'FACTURA') entrada.focus();
        });
      });
      btnCF.classList.toggle('hidden', tipo === 'FACTURA');

      async function buscar() {
        const id = entrada.value.trim();
        encontrado.classList.add('hidden');
        formNuevo.classList.add('hidden');

        if (id.length < 5) {
          msg.textContent = 'Ingrese la identificación completa.';
          msg.className = 'form-msg error';
          return;
        }

        msg.textContent = 'Buscando...';
        msg.className = 'form-msg';

        const { data, error } = await supabase.rpc('fn_buscar_cliente', { p_identificacion: id });
        if (error) {
          msg.textContent = error.message;
          msg.className = 'form-msg error';
          return;
        }

        const cli = Array.isArray(data) ? data[0] : data;
        if (cli) {
          msg.textContent = 'Cliente encontrado.';
          msg.className = 'form-msg ok';
          encontrado.classList.remove('hidden');
          encontrado.innerHTML = `
            <div class="comp-linea"><span>Nombre</span><b>${esc(cli.nombre)}</b></div>
            <div class="comp-linea"><span>${cli.tipo_identificacion}</span><b>${esc(cli.identificacion)}</b></div>
            ${cli.email ? `<div class="comp-linea"><span>Correo</span><b>${esc(cli.email)}</b></div>` : ''}
            ${cli.telefono ? `<div class="comp-linea"><span>Teléfono</span><b>${esc(cli.telefono)}</b></div>` : ''}
            <button type="button" class="btn-primary ancho" id="btn-usar-cliente">Usar este cliente</button>`;
          encontrado.querySelector('#btn-usar-cliente').addEventListener('click', () => {
            alElegir({
              clienteId: cli.id, nombre: cli.nombre,
              identificacion: cli.identificacion, tipoComprobante: 'FACTURA',
            });
            cerrarModal();
          });
        } else {
          msg.textContent = 'No está registrado todavía.';
          msg.className = 'form-msg';
          formNuevo.classList.remove('hidden');
          formNuevo.querySelector('[name=nombre]').focus();
        }
      }

      modal.querySelector('#btn-buscar-cliente').addEventListener('click', buscar);
      entrada.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); buscar(); }
      });

      formNuevo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(formNuevo);
        msg.textContent = 'Registrando...';
        msg.className = 'form-msg';

        const { data, error } = await supabase.rpc('fn_registrar_cliente', {
          p_identificacion: entrada.value.trim(),
          p_nombre: fd.get('nombre'),
          p_email: fd.get('email') || null,
          p_telefono: fd.get('telefono') || null,
          p_direccion: fd.get('direccion') || null,
        });

        if (error) {
          msg.textContent = error.message;
          msg.className = 'form-msg error';
          return;
        }
        alElegir({
          clienteId: data, nombre: String(fd.get('nombre')).toUpperCase(),
          identificacion: entrada.value.trim(), tipoComprobante: 'FACTURA',
        });
        cerrarModal();
      });

      if (tipo === 'FACTURA') entrada.focus();
    },
  });

  async function usarConsumidorFinal() {
    const { data } = await supabase
      .from('clientes').select('id, nombre, identificacion')
      .eq('identificacion', '9999999999999').maybeSingle();

    alElegir({
      clienteId: data?.id ?? null,
      nombre: data?.nombre ?? 'CONSUMIDOR FINAL',
      identificacion: '9999999999999',
      tipoComprobante: 'NOTA_VENTA',
    });
    cerrarModal();
  }
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
