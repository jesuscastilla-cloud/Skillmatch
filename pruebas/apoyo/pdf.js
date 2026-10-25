// PDFs pequeños para las pruebas, armados a mano: texto con Helvetica (sin
// fuentes incrustadas). Las tildes y la ñ van en WinAnsi, que para el español
// es igual a Latin-1. Así no se guardan archivos binarios en el repositorio.

// Lo que no está en Latin-1 pero sí en WinAnsi: viñetas, rayas y comillas
const WINANSI = { '•': '\x95', '–': '\x96', '—': '\x97', '“': '\x93', '”': '\x94', '‘': '\x91', '’': '\x92', '€': '\x80', '…': '\x85' };
const escapar = t => String(t).replace(/[•–—“”‘’€…]/g, c => WINANSI[c]).replace(/[\\()]/g, m => '\\' + m);

/** renglones: [{ texto, x, y, tam, negrita }] en puntos (la hoja mide 612 x 792). */
function hacerPdf(renglones) {
    const contenido = renglones.map(r =>
        `BT /${r.negrita ? 'F2' : 'F1'} ${r.tam || 11} Tf 1 0 0 1 ${r.x || 50} ${r.y} Tm (${escapar(r.texto)}) Tj ET`).join('\n');
    const objetos = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
        `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    ];
    let pdf = '%PDF-1.4\n';
    const posiciones = [];
    objetos.forEach((o, i) => {
        posiciones.push(Buffer.byteLength(pdf, 'latin1'));
        pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` + posiciones.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
    pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
}

/** Una columna de renglones de arriba hacia abajo. Cada uno: texto o { texto, tam, negrita, x }. */
function columna(renglones, { x = 50, y = 740 } = {}) {
    let actual = y;
    return renglones.map(r => {
        const o = typeof r === 'string' ? { texto: r } : r;
        const tam = o.tam || 11;
        const salida = { x, ...o, y: actual, tam };
        actual -= tam + 7;
        return salida;
    });
}

const titulo = texto => ({ texto, negrita: true, tam: 13 });

module.exports = { hacerPdf, columna, titulo };
