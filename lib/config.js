// Single on/off switch for the paid ("Club") ticket flow. Culqi has not approved
// the merchant account yet, so this stays false — only the free Cortesía flow
// is reachable while it's off. Flip to true once Culqi approves; nothing else
// needs to change, both the API (api/charge.js) and the UI (index.html, via
// GET /api/config) read this single value.
const PAYMENTS_ENABLED = false;

module.exports = { PAYMENTS_ENABLED };
