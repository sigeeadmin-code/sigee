"""Verificación MANUAL de márgenes de impresión (no corre con `node`). Genera PDF de oficios de distinto largo con el CSS real de
src/styles.css + la regla de página de src/lib/impresion.js y confirma que TODAS las hojas conservan al menos 14 mm arriba y abajo.
Requisitos: pip install weasyprint pymupdf        Uso: python3 tests/manual/margenes_impresion.py"""
import os, re, sys, warnings
warnings.filterwarnings('ignore')
import weasyprint, pymupdf
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..')
CSS = open(os.path.join(RAIZ, 'src', 'styles.css'), encoding='utf8').read()
MARGEN = re.search(r"MARGEN_A4 = '([^']+)'", open(os.path.join(RAIZ, 'src', 'lib', 'impresion.js'), encoding='utf8').read()).group(1)
CSS += f'\n@page{{size:A4;margin:{MARGEN}}}'
MM = 72 / 25.4
def html(filas, parrafos):
    f = ''.join(f'<tr><td>{i}</td><td>2026-09-{(i % 28) + 1:02d}</td><td>Falta registrada por el docente número {i}</td></tr>' for i in range(1, filas + 1))
    p = ''.join(f'<p class="of-p">Párrafo {i}. Se informa al representante legal que el estudiante registra inasistencias reiteradas.</p>' for i in range(1, parrafos + 1))
    return f'<!doctype html><body class="imprimiendo-oficio"><div class="oficio-print"><div class="oficio-hoja">{p}<div class="of-subt">Detalle</div><table class="of-tabla"><thead><tr><th>N.º</th><th>Fecha</th><th>Detalle</th></tr></thead><tbody>{f}</tbody></table></div></div></body>'
malas = total = 0
for filas in range(5, 90, 3):
    for parrafos in (2, 5, 9):
        d = pymupdf.open(stream=weasyprint.HTML(string=html(filas, parrafos)).write_pdf(stylesheets=[weasyprint.CSS(string=CSS)]), filetype='pdf')
        for pg in d:
            b = [x for x in pg.get_text('blocks') if x[4].strip()]
            if not b: continue
            total += 1
            if min(x[1] for x in b) / MM < 13.5 or (pg.rect.height - max(x[3] for x in b)) / MM < 13.5: malas += 1
print(f'{total} hojas revisadas, {malas} con margen menor a 14 mm')
sys.exit(1 if malas else 0)
