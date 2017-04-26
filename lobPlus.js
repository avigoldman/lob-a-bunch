'use strict';

const getResources = require('./utils/getResources');
const batchRequest = require('./utils/batchRequest');
const merge = require('lodash.merge');
const cloneDeep = require('lodash.clonedeep');

function lobPlus(lob) {
  lobCheck(lob);
  
  // batching from the params value if its an array
  attachBatchCreate(lob.addresses);
  attachBatchCreate(lob.bankAccounts);

  // batching from the params.to value if its an array
  attachBatchSend(lob.postcards);
  attachBatchSend(lob.letters);
  attachBatchSend(lob.checks);

  return lob;
};

lobPlus.safe = function(lob) {
  lobCheck(lob);

  // batching from the params value if its an array
  attachBatchCreate(lob.addresses, 'batch');
  attachBatchCreate(lob.bankAccounts, 'batch');

  // batching from the params.to value if its an array
  attachBatchSend(lob.postcards, 'batch');
  attachBatchSend(lob.letters, 'batch');
  attachBatchSend(lob.checks, 'batch');
}

function lobCheck(lob) {
  if (!(lob.constructor.name === 'Lob')) {
    throw new Error('lob must be an instance of Lob Node library');
  }
}

/**
 * Overrides the create function to allow for batching from params given if its an array
 * @param  {Object} resource  The lob resource to modify (postcards, letters, etc.)
 */
function attachBatchCreate(resource, key = 'create') {
  resource.pureCreate = resource.create; // save the original create for later

  resource[key] = function(params, config, callback) {
    if (typeof config === 'function') {
      callback = config;
      config = {};
    }

    if (!(params instanceof Array)) {
      return this.pureCreate.apply(this, arguments);
    }

    config.queue = params;
    config.action = function(params, callback) {
      return resource.pureCreate(params, callback);
    };

    return batchRequest(config).asCallback(callback);
  };
}

/**
 * Overrides the create function to allow for batching from the "to" parameter in the params
 * @param  {Object} resource  The lob resource to modify (postcards, letters, etc.)
 */
function attachBatchSend(resource, key = 'create') {
  resource.pureCreate = resource.create; // save the original create for later

  resource[key] = function(params, config, callback) {
    if (typeof config === 'function') {
      callback = config;
      config = {};
    }

    if (!(params.to instanceof Array)) {
      return this.pureCreate.apply(this, arguments);
    }

    let recipients = params.to;
    let queue = [];

    for (let i = 0; i < recipients.length; i++) {
      let newParams = cloneDeep(params);
      newParams.to = recipients[i];

      if (typeof newParams.to !== 'string') {
        merge(newParams, newParams.to.overrides || {});
        delete newParams.to.overrides;
      }

      queue.push(newParams);
    }

    config.queue = queue;
    config.action = function(params, callback) {
      return resource.pureCreate(params, callback);
    };

    return batchRequest(config).asCallback(callback);
  };
}

module.exports = lobPlus;