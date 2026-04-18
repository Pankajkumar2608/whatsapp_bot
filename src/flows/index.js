/**
 * Flow registry — maps service_type → flow config.
 * To add a new service, just create a new flow file and register it here.
 */
const dentistFlow = require('./dentistFlow');
const makeupFlow = require('./makeupFlow');
const genericFlow = require('./genericFlow');

const flowRegistry = {
  dentist: dentistFlow,
  makeup: makeupFlow,
  generic: genericFlow,
};

/**
 * Get flow config by service type.
 * Falls back to generic if unknown.
 */
function getFlow(serviceType) {
  return flowRegistry[serviceType] || flowRegistry.generic;
}

module.exports = { getFlow, flowRegistry };
