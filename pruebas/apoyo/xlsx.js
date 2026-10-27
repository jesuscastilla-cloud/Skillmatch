// Lee un .xlsx (un .zip con XML) sin librerías: sus archivos y las celdas de
// la primera hoja. Revisa la huella (CRC) de cada archivo del zip, para notar
// si se armó mal.
const zlib = require('node:zlib');

function archivosDelZip(buf) {
    const archivos = {};
    let fin = buf.length - 22;
    while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054B50) fin--;
    if (fin < 0) throw new Error('no es un zip: falta el final del índice');
    const total = buf.readUInt16LE(fin + 10);
    let p = buf.readUInt32LE(fin + 16);
    for (let i = 0; i < total; i++) {
        if (buf.readUInt32LE(p) !== 0x02014B50) throw new Error('índice del zip dañado');
        const metodo = buf.readUInt16LE(p + 10);
        const crc = buf.readUInt32LE(p + 16);
        const tamano = buf.readUInt32LE(p + 20);
        const largoNombre = buf.readUInt16LE(p + 28);
        const largoExtra = buf.readUInt16LE(p + 30);
        const largoComentario = buf.readUInt16LE(p + 32);
        const local = buf.readUInt32LE(p + 42);
        const nombre = buf.toString('utf8', p + 46, p + 46 + largoNombre);
        if (buf.readUInt32LE(local) !== 0x04034B50) throw new Error('cabecera dañada: ' + nombre);
        const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const datos = buf.subarray(inicio, inicio + tamano);
        const contenido = metodo === 8 ? zlib.inflateRawSync(datos) : datos;
        if (zlib.crc32 && zlib.crc32(contenido) !== crc) throw new Error('huella (CRC) distinta en ' + nombre);
        archivos[nombre] = contenido.toString('utf8');
        p += 46 + largoNombre + largoExtra + largoComentario;
    }
    return archivos;
}

const desescapar = t => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Columna "AB" -> 27 (desde 0)
const indiceColumna = letras => letras.split('').reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1;

function leerXlsx(buf) {
    const archivos = archivosDelZip(buf);
    const hoja = archivos['xl/worksheets/sheet1.xml'];
    const filas = [];
    for (const [, fila] of hoja.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        const celdas = [];
        for (const [, atributos, interior = ''] of fila.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const texto = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(interior);
            const numero = /<v>([\s\S]*?)<\/v>/.exec(interior);
            celdas[indiceColumna(/r="([A-Z]+)\d+"/.exec(atributos)[1])] = {
                tipo: (/t="(\w+)"/.exec(atributos) || [])[1],
                estilo: Number((/s="(\d+)"/.exec(atributos) || [0, 0])[1]),
                valor: texto ? desescapar(texto[1]) : numero ? Number(numero[1]) : '',
                formula: /<f\b/.test(interior)
            };
        }
        filas.push(celdas);
    }
    // Solo los valores, con '' en las celdas vacías
    const valores = filas.map(f => Array.from(f, c => (c ? c.valor : '')));
    return { archivos, hoja, filas, valores };
}

module.exports = { leerXlsx };
