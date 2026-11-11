'use strict';
// Explicit practice scope takes precedence over shared-topic scoring.
function eligibleForTopic(clinician, type, entity) {
  if (type === 'modality' && (clinician.excludedModalities || []).includes(entity.slug)) return false;
  if (type !== 'population') return true;
  const description = [entity.slug, entity.name, ...(entity.tags || [])].join(' ').toLowerCase();
  if (/\b(?:children|child)\b/.test(description) && !clinician.populations.includes('children')) return false;
  if (/\b(?:teens|teen|adolescents|adolescent)\b/.test(description) && !clinician.populations.includes('teens')) return false;
  return true;
}
module.exports = {eligibleForTopic};
