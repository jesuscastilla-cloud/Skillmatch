/* ==========================================================================
   SkillMatch — Libro de Excel (.xlsx) armado en el navegador
   Un .xlsx es un .zip con archivos XML: aqui se escriben esos XML y se
   empaquetan sin comprimir, sin librerias. Excel lo abre en columnas en
   cualquier computador, sin importar si su Windows separa con coma o con
   punto y coma (el CSV dependia de eso).

   Uso:
     const archivo = SkillMatchExcel.libro({
         hoja: 'Postulaciones',
         columnas: [{ titulo: 'Nombre', ancho: 26 }, { titulo: 'Fecha', ancho: 14 }],
         filas: [['Ana Ruiz', new Date(2026, 4, 13)]]
     });   // devuelve un Blob

   Cada valor: texto (string), numero, fecha (Date) o vacio (null/undefined).
   Los textos van siempre como texto, nunca como formula: un nombre que empiece
   con = + - @ se ve tal cual y Excel no lo ejecuta.
   ========================================================================== */
(function () {
    'use strict';

    const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const MAX_CELDA = 32767; // lo maximo que Excel guarda en una celda

    // ---- XML ----

    // Escapa para XML y quita caracteres de control que no se permiten en XML
    function xml(texto) {
        return String(texto)
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // A, B, ... Z, AA, AB ...
    function letraColumna(n) {
        let letras = '';
        for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) letras = String.fromCharCode(65 + ((n - 1) % 26)) + letras;
        return letras;
    }

    // Excel cuenta los dias desde el 30 de diciembre de 1899 (se usa el dia local, sin hora)
    function diaDeExcel(fecha) {
        return (Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) - Date.UTC(1899, 11, 30)) / 86400000;
    }

    // Estilos (styles.xml): 0 normal, 1 encabezado (negrita con fondo), 2 fecha
    function celda(ref, valor, encabezado) {
        if (valor === null || valor === undefined || valor === '') return '';
        if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? '' : '<c r="' + ref + '" s="2"><v>' + diaDeExcel(valor) + '</v></c>';
        if (typeof valor === 'number' && Number.isFinite(valor)) return '<c r="' + ref + '"><v>' + valor + '</v></c>';
        const texto = String(valor).slice(0, MAX_CELDA);
        return '<c r="' + ref + '" t="inlineStr"' + (encabezado ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xml(texto) + '</t></is></c>';
    }

    function hojaXml(columnas, filas) {
        const todas = [columnas.map(function (c) { return c.titulo; })].concat(filas);
        const ultima = letraColumna(columnas.length - 1) + todas.length;
        const filasXml = todas.map(function (fila, i) {
            const celdas = fila.map(function (v, j) { return celda(letraColumna(j) + (i + 1), v, i === 0); }).join('');
            return '<row r="' + (i + 1) + '">' + celdas + '</row>';
        }).join('');
        const anchos = columnas.map(function (c, j) {
            return '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + (c.ancho || 14) + '" customWidth="1"/>';
        }).join('');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<dimension ref="A1:' + ultima + '"/>' +
            // La fila de los titulos queda fija al bajar
            '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
            '<sheetFormatPr defaultRowHeight="15"/>' +
            '<cols>' + anchos + '</cols>' +
            '<sheetData>' + filasXml + '</sheetData>' +
            '<autoFilter ref="A1:' + ultima + '"/>' +
            '</worksheet>';
    }

    function libroXml(hoja, ultima) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<sheets><sheet name="' + xml(hoja) + '" sheetId="1" r:id="rId1"/></sheets>' +
            // Excel guarda asi el rango de los filtros
            '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'' +
            xml(hoja.replace(/'/g, "''")) + '\'!$A$1:$' + ultima.replace(/(\d+)$/, '$$$1') + '</definedName></definedNames>' +
            '</workbook>';
    }

    const ESTILOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
        '<font><b/><sz val="11"/><color rgb="FF0B1B2C"/><name val="Calibri"/><family val="2"/></font></fonts>' +
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFD7F1F4"/><bgColor indexed="64"/></patternFill></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
        // 14: fecha corta en el formato del computador que lo abre
        '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>';

    const TIPOS_DE_CONTENIDO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>';

    const RELACIONES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>';

    const RELACIONES_DEL_LIBRO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>';

    // ---- ZIP sin comprimir ----

    const TABLA_CRC = (function () {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    // Fecha y hora en el formato del zip (el de MS-DOS)
    function fechaZip(d) {
        return {
            hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
            dia: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
        };
    }

    function zip(archivos) {
        const utf8 = new TextEncoder();
        const { hora, dia } = fechaZip(new Date());
        const partes = [];
        const indice = [];
        let posicion = 0;
        archivos.forEach(function (a) {
            const nombre = utf8.encode(a.nombre);
            const datos = utf8.encode(a.texto);
            const crc = crc32(datos);
            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034B50, true);
            local.setUint16(4, 20, true);       // version necesaria
            local.setUint16(6, 0x0800, true);   // nombres en UTF-8
            local.setUint16(8, 0, true);        // sin comprimir
            local.setUint16(10, hora, true);
            local.setUint16(12, dia, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, datos.length, true);
            local.setUint32(22, datos.length, true);
            local.setUint16(26, nombre.length, true);
            local.setUint16(28, 0, true);
            partes.push(local.buffer, nombre, datos);

            const central = new DataView(new ArrayBuffer(46));
            central.setUint32(0, 0x02014B50, true);
            central.setUint16(4, 20, true);
            central.setUint16(6, 20, true);
            central.setUint16(8, 0x0800, true);
            central.setUint16(10, 0, true);
            central.setUint16(12, hora, true);
            central.setUint16(14, dia, true);
            central.setUint32(16, crc, true);
            central.setUint32(20, datos.length, true);
            central.setUint32(24, datos.length, true);
            central.setUint16(28, nombre.length, true);
            central.setUint32(42, posicion, true); // donde empieza su cabecera local
            indice.push(central.buffer, nombre);
            posicion += 30 + nombre.length + datos.length;
        });
        const tamIndice = indice.reduce(function (s, p) { return s + p.byteLength; }, 0);
        const fin = new DataView(new ArrayBuffer(22));
        fin.setUint32(0, 0x06054B50, true);
        fin.setUint16(8, archivos.length, true);
        fin.setUint16(10, archivos.length, true);
        fin.setUint32(12, tamIndice, true);
        fin.setUint32(16, posicion, true);
        return new Blob(partes.concat(indice, [fin.buffer]), { type: TIPO_XLSX });
    }

    function libro(opciones) {
        const hoja = (opciones.hoja || 'Hoja1').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
        const columnas = opciones.columnas;
        const filas = opciones.filas || [];
        const ultima = letraColumna(columnas.length - 1) + (filas.length + 1);
        return zip([
            { nombre: '[Content_Types].xml', texto: TIPOS_DE_CONTENIDO },
            { nombre: '_rels/.rels', texto: RELACIONES },
            { nombre: 'xl/workbook.xml', texto: libroXml(hoja, ultima) },
            { nombre: 'xl/_rels/workbook.xml.rels', texto: RELACIONES_DEL_LIBRO },
            { nombre: 'xl/styles.xml', texto: ESTILOS },
            { nombre: 'xl/worksheets/sheet1.xml', texto: hojaXml(columnas, filas) }
        ]);
    }

    window.SkillMatchExcel = { libro: libro, TIPO: TIPO_XLSX };
})();
