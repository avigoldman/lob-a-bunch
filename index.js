'use strict';

const getResources = require('./utils/getResources');
const batchRequest = require('./utils/batchRequest');
const merge = require('lodash.merge');

function lobPlus(lob) {
  if (!(lob.constructor.name === 'Lob')) {
    throw new Error('lob must be an instance of Lob Node library');
  }
  
  // batching from the params value if its an array
  attachBatchCreate(lob.addresses);
  attachBatchCreate(lob.bankAccounts);

  // batching from the params.to value if its an array
  attachBatchSend(lob.postcards);
  attachBatchSend(lob.letters);
  attachBatchSend(lob.checks);

  return lob;
};

/**
 * Overrides the create function to allow for batching from params given if its an array
 * @param  {Object} resource  The lob resource to modify (postcards, letters, etc.)
 */
function attachBatchCreate(resource) {
  resource.pureCreate = resource.create; // save the original create for later

  resource.create = function(params, settings, callback) {
    if (typeof settings === 'function') {
      callback = settings;
      settings = {};
    }

    if (!(params instanceof Array)) {
      return this.pureCreate.apply(this, arguments);
    }

    return batchRequest(function(params, callback) {
      return resource.pureCreate(params, callback);
    }, params, settings).asCallback(callback);
  };
}

/**
 * Overrides the create function to allow for batching from the "to" parameter in the params
 * @param  {Object} resource  The lob resource to modify (postcards, letters, etc.)
 */
function attachBatchSend(resource) {
  resource.pureCreate = resource.create; // save the original create for later

  resource.create = function(params, settings, callback) {
    if (typeof settings === 'function') {
      callback = settings;
      settings = {};
    }

    if (!(params.to instanceof Array)) {
      return this.pureCreate.apply(this, arguments);
    }

    let recipients = params.to;
    let payloads = [];

    for (let i = 0; i < recipients.length; i++) {
      let newParams = JSON.parse(JSON.stringify(params));
      newParams.to = recipients[i];

      if (typeof newParams.to !== 'string') {
        merge(newParams, newParams.to.overrides || {});
        delete newParams.to.overrides;
      }

      payloads.push(newParams);
    }

    return batchRequest(function(params, callback) {
      return resource.pureCreate(params, callback);
    }, payloads, settings).asCallback(callback);
  };
}

module.exports = lobPlus;