'use strict';

const BBPromise = require('bluebird');

function BatchRequest(config, done) {
  if (!(this instanceof BatchRequest)) {
    return new BatchRequest(config, done);
  }

  if (typeof config.action !== 'function') {
    return done(new Error('Action must be given to BatchRequest'));
  }

  if (config.max_requests < 1) {
    return done(new Error('Max requests must be greater or equal to 1'));
  }

  this.maxRequests = config.max_requests || 25;
  this.queue = config.queue || [];
  this.action = config.action;
  this.every = config.every || function() {};
  this.done = done || function() {};
  
  this.numberOfRequests = 0;  
  this.paused = false;
  this.pauseCount = 0;
  this.lastPause = new Date().getTime();

  this.results = {
    errors: [],
    data: []
  };

  this.triggerRequests();
}

BatchRequest.prototype.handleResponse = function(type, request, response) {
  this.numberOfRequests--;

  if (type === 'error') {
    response._request = request;
    this.results.errors.push(response);
    this.every(response);
  }

  else if (type === 'success') {
    this.results.data.push(response);
    this.every(null, response);
  }

  else if (type === 'rateLimit') {
    this.queue.unshift(request);

    if (this.paused === false) {
      const pauseTime = this.calculatePauseTime(response);
      this.pause();

      setTimeout(() => { this.play(); }, pauseTime);
    }
  }

  if (this.isFinished()) {
    return this.finish();
  }
  
  this.triggerRequests();
};

BatchRequest.prototype.pause = function() {
  this.pauseCount = this.paused ? this.pauseCount : this.pauseCount+1;
  this.lastPause = new Date().getTime();
  this.paused = true;
};

BatchRequest.prototype.play = function() {
  this.paused = false;
  this.triggerRequests();
};

BatchRequest.prototype.calculatePauseTime = function(response) {
  const timeSinceStart = new Date().getTime() - this.lastPause;
  const waitTime = (response._response.headers['rate-limit-window'] * 1000) - timeSinceStart;

  return waitTime > 0 ? waitTime : 0;
}

BatchRequest.prototype.makeRequest = function(request, callback) {
  this.numberOfRequests++;

  this.action(request, (err, result) => {
    const response = err || result;
    let type = !!err ? 'error' : 'success';

    if (hitRateLimit(response)) {
      type = 'rateLimit';
    }

    callback(type, request, response);
  });
}

BatchRequest.prototype.triggerRequests = function() {
  if (this.paused) return;

  while(this.numberOfRequests < this.maxRequests && this.queue.length > 0) {
    this.makeRequest(this.queue.shift(), (type, request, response) => {
      this.handleResponse(type, request, response);
    });
  }
};

BatchRequest.prototype.isFinished = function() {
  return this.numberOfRequests === 0 && this.queue.length === 0;
};


BatchRequest.prototype.finish = function() {
  const results = { 
    rejected_count: this.results.errors.length,
    accepted_count: this.results.data.length,
    batch_count: this.pauseCount,
    errors: this.results.errors,
    data: this.results.data
  };

  if (results.rejected_count === 0) {
    delete results.errors;
  }

  if (results.rejected_count > 0 && results.accepted_count === 0) {
    const error = new Error('Failed to make batch request.');
    error.results = results;
    this.done(error);
  }
  else {
    this.done(null, results);
  }
};

/**
 * Checks if the given response indicates we hit the rate limit
 * @param  {Object} response  The result/err from the request
 * @return {Boolean}          Boolean if we hit the rate limit
 */
function hitRateLimit(response) {
  return 'rate-limit-remaining' in response._response.headers && parseInt(response._response.headers['rate-limit-remaining']) === 0;
}


module.exports = BBPromise.promisify(BatchRequest);