import { supabase } from './supabaseClient.js';
import { procesarMovimiento } from './lib/costing.js';

export async function renderMovimientos(container) {
  container.innerHTML = `
    <form id="form-mov" class="inline-form form-mov">
      <select id="mov-producto" required><option value="">Producto...</option></select>
      <select id="mov-bodega" required><option value="">Bodega...</option></select>
      <select id="mov-tipo">
        <option value="ENTRADA">Entrada</option>
        <option value="SALIDA">Salida</option>
        <option value="AJUSTE_POSITIVO">Ajuste (+)</option>
        <option value="AJUSTE_NEGATIVO">Ajuste (-)</option>
      </select>
      <input type="number" id="mov-cantidad" placeholder="Cantidad" min="0.0001" step="0.0001" required />
      <input type="number" id="mov-costo" placeholder="Costo unitario (solo Entrada)" min="0" step="0.0001" />
      <input type="text" id="mov-referencia" placeholder="Referencia (factura/guía)" />
      <button type="submit">Registrar movimiento</button>
      <span id="mov-msg" class="form-msg"></span>
    </form>
    <div id="mov-preview" class="preview-box hidden"></div>
  `;

  const productoSelect = container.querySelector('#mov-producto');
  const bodegaSelect = container.querySelector('#mov-bodega');
  const tipoSelect = container.querySelector('#mov-tipo');
  const cantidadInput = container.querySelector('#mov-cantidad');
  const costoInput = container.querySelector('#mov-costo');
  const preview = container.querySelector('#mov-preview');
  const msg = container.querySelector('#mov-msg');

  const [{ data: productos }, { data: bodegas }] = await Promise.all([
    supabase.from('productos').select('id, codigo, nombre').eq('activo', true).order('nombre'),
    supabase.from('bodegas').select('id, nombre').eq('activa', true).order('nombre'),
  ]);

  (productos ?? []).forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.codigo} — ${p.nombre}`;
    productoSelect.appendChild(opt);
  });
  (bodegas ?? []).forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.nombre;
    bodegaSelect.appendChild(opt);
  });

  async function getSaldoActual(productoId, bodegaId) {
    const { data } = await supabase
      .from('inventario_saldos')
      .select('stock, costo_promedio')
      .eq('producto_id', productoId)
      .eq('bodega_id', bodegaId)
      .maybeSingle();
    return { stock: Number(data?.stock ?? 0), costoPromedio: Number(data?.costo_promedio ?? 0) };
  }

  async function updatePreview() {
    const productoId = productoSelect.value;
    const bodegaId = bodegaSelect.value;
    const cantidad = Number(cantidadInput.value);
    const costoUnitario = Number(costoInput.value || 0);
    const tipo = tipoSelect.value;

    if (!productoId || !bodegaId || !cantidad) {
      preview.classList.add('hidden');
      return;
    }

    try {
      const saldoActual = await getSaldoActual(productoId, bodegaId);
      const resultado = procesarMovimiento(saldoActual, { tipo, cantidad, costoUnitario });
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <strong>Vista previa (calculada en el navegador; la base de datos recalcula al guardar):</strong>
        <div>Saldo actual: ${saldoActual.stock.toFixed(2)} u. @ $${saldoActual.costoPromedio.toFixed(4)}</div>
        <div>Saldo tras el movimiento: <b>${resultado.stock.toFixed(2)} u.</b> @ <b>$${resultado.costoPromedio.toFixed(4)}</b></div>
        <div>Valor total resultante: $${resultado.valorTotal.toFixed(2)}</div>
      `;
    } catch (err) {
      preview.classList.remove('hidden');
      preview.innerHTML = `<span class="error">${err.message}</span>`;
    }
  }

  [productoSelect, bodegaSelect, tipoSelect, cantidadInput, costoInput].forEach((el) =>
    el.addEventListener('input', updatePreview)
  );
  tipoSelect.addEventListener('change', () => {
    costoInput.disabled = tipoSelect.value !== 'ENTRADA';
    if (costoInput.disabled) costoInput.value = '';
    updatePreview();
  });

  container.querySelector('#form-mov').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      producto_id: productoSelect.value,
      bodega_id: bodegaSelect.value,
      tipo: tipoSelect.value,
      cantidad: Number(cantidadInput.value),
      costo_unitario: tipoSelect.value === 'ENTRADA' ? Number(costoInput.value || 0) : null,
      referencia: container.querySelector('#mov-referencia').value.trim() || null,
      usuario_id: user?.id ?? null,
    };

    const { error } = await supabase.from('movimientos_inventario').insert(payload);
    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
    } else {
      msg.textContent = 'Movimiento registrado.';
      msg.className = 'form-msg ok';
      e.target.reset();
      preview.classList.add('hidden');
    }
  });
}
