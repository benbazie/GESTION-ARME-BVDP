'use strict'

const SCOPE_KEYS = [
  'entite_id',
  'sous_entite_id',
  'coordination_regionale_id',
  'coordination_provinciale_id',
  'coordination_communale_id'
]

const extractScope = (source = {}) => {
  const scope = {}
  SCOPE_KEYS.forEach((key) => {
    if (source[key] !== undefined && source[key] !== null) {
      scope[key] = source[key]
    }
  })
  return scope
}

const hasScope = (scope = {}) => Object.keys(scope).length > 0

module.exports = {
  SCOPE_KEYS,
  extractScope,
  hasScope,
}
