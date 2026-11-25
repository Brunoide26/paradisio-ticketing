// Etapas del ciclo de vida de un evento en Paradisio OS.
//
// El documento de finanzas viejo sólo tenía `status` (planificación,
// presupuesto, confirmado, realizado), que mezclaba la etapa del evento con
// qué tan firmes eran sus números. Ahora cada evento tiene `stage`; `status`
// se sigue escribiendo para que el editor y el endpoint viejos (api/ceo.js)
// sigan funcionando igual.

const STAGES = [
  { id: 'concept', label: 'Concepto', status: 'planificación' },
  { id: 'evaluation', label: 'Evaluación financiera', status: 'presupuesto' },
  { id: 'confirmed', label: 'Confirmado', status: 'confirmado' },
  { id: 'preproduction', label: 'Preproducción', status: 'confirmado' },
  { id: 'on_sale', label: 'En venta', status: 'confirmado' },
  { id: 'live', label: 'En vivo', status: 'confirmado' },
  { id: 'settlement', label: 'Liquidación', status: 'realizado' },
  { id: 'closed', label: 'Cerrado', status: 'realizado' },
  { id: 'cancelled', label: 'Cancelado', status: 'cancelado' },
];
const STAGE_IDS = STAGES.map((s) => s.id);

const FROM_STATUS = { 'planificación': 'concept', presupuesto: 'evaluation', confirmado: 'confirmed', realizado: 'closed', cancelado: 'cancelled' };

// Números reales sólo desde la liquidación: antes de eso todo es presupuesto.
const ACTUAL_STAGES = new Set(['settlement', 'closed']);

function stageOf(e) {
  if (e && STAGE_IDS.includes(e.stage)) return e.stage;
  return FROM_STATUS[e && e.status] || 'concept';
}
function statusForStage(stage) {
  return (STAGES.find((s) => s.id === stage) || STAGES[0]).status;
}
const isActualStage = (stage) => ACTUAL_STAGES.has(stage);

module.exports = { STAGES, STAGE_IDS, stageOf, statusForStage, isActualStage };
