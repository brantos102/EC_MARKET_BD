// Tabla dinámica reutilizable: ordenable por columna (click en encabezado)
// y filtrable con una caja de búsqueda. Sin dependencias externas.

/**
 * @param {HTMLElement} container
 * @param {{
 *   columns: {key: string, label: string, sortable?: boolean, format?: (v:any,row:any)=>string, numeric?: boolean}[],
 *   rows: any[],
 *   searchable?: boolean,
 *   emptyMessage?: string,
 *   rowClass?: (row:any) => string,
 * }} opts
 */
export function renderTable(container, opts) {
  const {
    columns,
    rows,
    searchable = true,
    emptyMessage = 'Sin datos para mostrar.',
    rowClass = () => '',
  } = opts;

  let sortKey = null;
  let sortDir = 1; // 1 asc, -1 desc
  let filterText = '';

  const wrap = document.createElement('div');
  wrap.className = 'dyn-table-wrap';

  if (searchable) {
    const searchBar = document.createElement('div');
    searchBar.className = 'dyn-table-search';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Filtrar...';
    input.addEventListener('input', () => {
      filterText = input.value.trim().toLowerCase();
      draw();
    });
    searchBar.appendChild(input);
    wrap.appendChild(searchBar);
  }

  const tableEl = document.createElement('table');
  tableEl.className = 'dyn-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.sortable !== false) {
      th.classList.add('sortable');
      th.addEventListener('click', () => {
        if (sortKey === col.key) {
          sortDir *= -1;
        } else {
          sortKey = col.key;
          sortDir = 1;
        }
        draw();
      });
    }
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  const tbody = document.createElement('tbody');
  tableEl.appendChild(thead);
  tableEl.appendChild(tbody);
  wrap.appendChild(tableEl);
  container.innerHTML = '';
  container.appendChild(wrap);

  function draw() {
    // Encabezados: marcar orden activo
    Array.from(headRow.children).forEach((th, i) => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (columns[i].key === sortKey) {
        th.classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
      }
    });

    let data = rows;
    if (filterText) {
      data = data.filter((row) =>
        columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(filterText))
      );
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      data = [...data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (col?.numeric) {
          return (Number(av) - Number(bv)) * sortDir;
        }
        return String(av ?? '').localeCompare(String(bv ?? '')) * sortDir;
      });
    }

    tbody.innerHTML = '';
    if (data.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = columns.length;
      td.className = 'dyn-table-empty';
      td.textContent = emptyMessage;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    data.forEach((row) => {
      const tr = document.createElement('tr');
      const extraClass = rowClass(row);
      if (extraClass) tr.className = extraClass;
      columns.forEach((col) => {
        const td = document.createElement('td');
        const raw = row[col.key];
        td.textContent = col.format ? col.format(raw, row) : raw ?? '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  draw();
  return { redraw: draw };
}
