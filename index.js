'use strict';

const getResources = require('./utils/getResources');
const merge = require('lodash.merge');

function lobPlus(lob) {
  if (!(lob.constructor.name === 'Lob')) {
    throw new Error('lob must be an instance of Lob Node library');
  }

  // batching from the params.to value if its an array
  attachBatchSend(lob.postcards);

  return lob;
};

/**
 * Overrides the create function to allow for batching from the "to" parameter in the params
 * @param  {Object} resource  The lob resource to modify (postcards, letters, etc.)
 */
function attachBatchSend(resource) {
  resource.pureCreate = resource.create; // save the original create for later

  resource.create = function(params, callback) {
    if (!(params.to instanceof Array)) {
      return this.pureCreate.apply(this, arguments);
    }

    let recipients = params.to;
    let payloads = [];

    for (let i = 0; i < recipients.length; i++) {
      let newParams = JSON.parse(JSON.stringify(params));
      newParams.to = recipients[i];

      merge(newParams, newParams.to.overrides || {});
      delete newParams.to.overrides;

      payloads.push(newParams);
    }

    return batchRequest(function(params, callback) {
      return resource.pureCreate(params, callback);
    }, payloads).asCallback(callback);
  };
}

module.exports = lobPlus;