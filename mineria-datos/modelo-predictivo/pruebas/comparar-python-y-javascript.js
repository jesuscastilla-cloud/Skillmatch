// Comprueba que el arbol que recorre el navegador (modelo-predictivo.js) da EXACTAMENTE
// lo mismo que scikit-learn para cada postulacion de la tabla (2-modelo/resultados/predicciones.csv).
// Uso (desde la raiz del proyecto): node mineria-datos/modelo-predictivo/pruebas/comparar-python-y-javascript.js
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const proyecto = path.join(raiz, '..', '..');
global.window = {};
require(path.join(proyecto, 'SkillMatch/src/assets/js/modelo-predictivo.js'));
const modelo = JSON.parse(fs.readFileSync(path.join(proyecto, 'SkillMatch/src/assets/data/modelo-predictivo.json'), 'utf8'));
const [cabecera, ...filas] = fs.readFileSync(path.join(raiz, '2-modelo/resultados/predicciones.csv'), 'utf8').trim().split(/\r?\n/);
const cols = cabecera.split(',');
let iguales = 0;
filas.forEach((linea, i) => {
    const v = linea.split(','); const x = {};
    cols.forEach((c, j) => { x[c] = Number(v[j]); });
    const { hoja } = window.SkillMatchModelo.recorrer(modelo, x);
    if (Math.abs(hoja.prob - x.prob_arbol) < 1e-3) iguales++;
    else console.log(`Fila ${i + 2}: navegador ${hoja.prob} / Python ${x.prob_arbol}`);
});
console.log(`${iguales} de ${filas.length} postulaciones dan lo mismo en Python y en el navegador.`);
process.exit(iguales === filas.length ? 0 : 1);
