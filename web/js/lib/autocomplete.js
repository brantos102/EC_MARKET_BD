// Autocompletado reutilizable para campos de producto.
//
// Resuelve dos problemas a la vez:
//   - Un <select> con 97 productos es imposible de usar en caja.
//   - Un campo de texto libre se presta a digitar mal el código.
// Este componente es las dos cosas: al enfocarlo despliega la lista
// completa como un menú, y al escribir la filtra por código, EAN,
// nombre o marca. El valor solo queda fijado cuando se elige una
// opción real, así que nunca se guarda un texto inventado.
//
// Funciona con lector de código de barras: el lector escribe y manda
// Enter, y si lo escrito coincide exactamente con un EAN o código, se
// selecciona esa opción sin tocar el mouse.

/**
 * @param {HTMLInputElement} input
 * @param {{
 *   items: () => any[],
 *   texto: (item) => string,
 *   secundario?: (item) => string,
 *   valor: (item) => string,
 *   coincideExacto?: (item, texto: string) => boolean,
 *   alElegir: (item, textoEscrito: string) => void,
 *   alLimpiar?: () => void,
 *   maximo?: number,
 *   abrirAlEnfocar?: boolean,
 * }} opciones
 */
export function autocompletar(input, opciones) {
  const {
    items, texto, secundario = () => '', valor,
    coincideExacto = () => false,
    alElegir, alLimpiar = () => {},
    maximo = 50, abrirAlEnfocar = true,
  } = opciones;

  let elegido = null;
  let indiceActivo = -1;
  let visibles = [];

  const contenedor = document.createElement('div');
  contenedor.className = 'ac-contenedor';
  input.parentNode.insertBefore(contenedor, input);
  contenedor.appendChild(input);
  input.classList.add('ac-input');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');

  const lista = document.createElement('ul');
  lista.className = 'ac-lista hidden';
  lista.setAttribute('role', 'listbox');
  contenedor.appendChild(lista);

  function filtrar(consulta) {
    const q = consulta.trim().toLowerCase();
    const todos = items() ?? [];
    if (!q) return todos.slice(0, maximo);

    // Se ordena por qué tan "al principio" aparece la coincidencia, para
    // que escribir "arr" ponga primero "Arroz" y no "Fideo con arroz".
    return todos
      .map((item) => {
        const t = texto(item).toLowerCase();
        const s = secundario(item).toLowerCase();
        const pos = t.indexOf(q);
        const posSec = s.indexOf(q);
        if (pos === -1 && posSec === -1) return null;
        return { item, peso: pos === -1 ? 1000 + posSec : pos };
      })
      .filter(Boolean)
      .sort((a, b) => a.peso - b.peso)
      .slice(0, maximo)
      .map((x) => x.item);
  }

  function pintar(consulta) {
    visibles = filtrar(consulta);
    indiceActivo = visibles.length ? 0 : -1;

    if (!visibles.length) {
      lista.innerHTML = `<li class="ac-vacio">Sin coincidencias para "${escapar(consulta)}"</li>`;
      abrir();
      return;
    }

    lista.innerHTML = visibles
      .map((item, i) => `
        <li class="ac-opcion ${i === 0 ? 'activa' : ''}" role="option" data-i="${i}">
          <span class="ac-texto">${resaltar(texto(item), consulta)}</span>
          ${secundario(item) ? `<span class="ac-sec">${escapar(secundario(item))}</span>` : ''}
        </li>`)
      .join('');

    lista.querySelectorAll('.ac-opcion').forEach((li) => {
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();           // evita que el input pierda el foco antes del click
        elegir(visibles[Number(li.dataset.i)]);
      });
      li.addEventListener('mouseenter', () => marcarActivo(Number(li.dataset.i)));
    });

    abrir();
  }

  function marcarActivo(i) {
    indiceActivo = i;
    lista.querySelectorAll('.ac-opcion').forEach((li, j) => {
      li.classList.toggle('activa', j === i);
      if (j === i) li.scrollIntoView({ block: 'nearest' });
    });
  }

  function abrir() {
    lista.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
  }

  function cerrar() {
    lista.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
  }

  function elegir(item) {
    if (!item) return;
    // Lo que estaba escrito ANTES de reemplazarlo por el nombre del
    // producto. Quien escucha necesita saberlo: si lo que se escaneó
    // fue el código de una caja de 12, el carrito tiene que sumar 12 y
    // no 1, y esa información se perdía al pisar el campo.
    const crudo = input.value.trim();

    elegido = item;
    input.value = texto(item);
    input.dataset.valor = valor(item);
    input.classList.add('ac-elegido');
    cerrar();
    alElegir(item, crudo);
  }

  function limpiarSeleccion() {
    elegido = null;
    delete input.dataset.valor;
    input.classList.remove('ac-elegido');
    alLimpiar();
  }

  input.addEventListener('input', () => {
    if (elegido && input.value !== texto(elegido)) limpiarSeleccion();
    pintar(input.value);
  });

  if (abrirAlEnfocar) {
    input.addEventListener('focus', () => pintar(input.value));
  }

  input.addEventListener('blur', () => setTimeout(cerrar, 120));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (lista.classList.contains('hidden')) pintar(input.value);
      else marcarActivo(Math.min(indiceActivo + 1, visibles.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      marcarActivo(Math.max(indiceActivo - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Prioridad al lector de barras: coincidencia exacta gana
      const crudo = input.value.trim();
      const exacto = (items() ?? []).find((it) => coincideExacto(it, crudo));
      if (exacto) elegir(exacto);
      else if (indiceActivo >= 0 && visibles[indiceActivo]) elegir(visibles[indiceActivo]);
    } else if (e.key === 'Escape') {
      cerrar();
    }
  });

  return {
    get elegido() { return elegido; },
    limpiar() {
      input.value = '';
      limpiarSeleccion();
      cerrar();
    },
    fijar(item) { elegir(item); },
    refrescar() { if (!lista.classList.contains('hidden')) pintar(input.value); },
  };
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function resaltar(textoCompleto, consulta) {
  const seguro = escapar(textoCompleto);
  const q = (consulta ?? '').trim();
  if (!q) return seguro;
  const i = seguro.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return seguro;
  return seguro.slice(0, i) + '<mark>' + seguro.slice(i, i + q.length) + '</mark>' + seguro.slice(i + q.length);
}
