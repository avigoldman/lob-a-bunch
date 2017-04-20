'use strict';

const BBPromise = require('bluebird');

/**
 * A requester - pulls from the queue and makes the requests recursively until the queue is empty
 * @param {Object}   params                  An object of required params with vars shared across requesters
 * @param {Function} params.func             The function to call recursively
 * @param {Array}    params.queue            An array of payloads to send through the func
 * @param {Object}   params.state            The internal state
 * @param {Object}   params.combinedResults  The object with the request results stored on it
 * @param {Function} params.done             The function called when the queue is empty by each requester
 */
function requester(params) {
  const { func, queue, state, combinedResults, done } = params;

  // close this requester if there are no more items in the queue
  if (queue.length <= 0) {
    state.requester_count--;
    return done();
  }

  // wait the specified time from rate limitng
  if (state.waiting) {
    return setTimeout(() => {
      return requester(params);
    }, state.waiting);
  }

  const payload = queue.shift();

  func(payload, (err, result) => {
    const response = err || result;
    // we errored out and hit the rate limit
    if (hitRateLimit(response)) {
      state.actually_hit++;
      queue.push(payload);
  
      // if this is the first requester to hit the rate limit alert the others
      if (!state.waiting) {
        combinedResults.batches_count++;
        
        state.round_start_time = new Date().getTime(); // update the start time to this round
        state.waiting = calculateWaitTime(response, state.round_start_time);

        // this timeout will be the first requester to resume and will clear out the waiting var
        return setTimeout(() => {
          state.waiting = null;

          return requester(params);
        }, state.waiting);
      }

      return requester(params);
    }
    
    // the request succeeded or came back with an error other than a rate limit
    if (err) {
      combinedResults.errors.push({
        payload: payload,
        error: err
      });
    }
    else {
      combinedResults.results.push(result);
    }

    combinedResults.rejected_count += !!err;
    combinedResults.accepted_count += !!result;

    state.each(err, result);

    return requester(params);
  });
}

/**
 * Checks if the given result indicates we hit the rate limit
 * @param  {Object} result  The result/err from the request
 * @return {Boolean}        Boolean if we hit the rate limit
 */
function hitRateLimit(result) {
  return 'rate-limit-remaining' in result._response.headers && parseInt(result._response.headers['rate-limit-remaining']) === 0;
}

/**
 * Uses the headers and time since we started a new round
 * @param  {Object} result         result the result/err from the request
 * @param  {Int} roundStartTime    start time in milliseconds
 * @return {Int}                   Milliseconds to pause
 */
function calculateWaitTime(result, roundStartTime) {
  const now = new Date().getTime();
  const timeSinceStart = now - roundStartTime;
  const waitTime = (result._response.headers['rate-limit-window'] * 1000) - timeSinceStart;

  if (waitTime > 0) {
    return waitTime;
  }

  return 0;
}


/**
 * Takes a function, queue, and settings and makes requests
 * @param  {Function} func      The function to call for each value in the queue
 * @param  {Array}    queue     An array of payloads to send through the func
 * @param  {Object}   settings  Settings for the requests
 * @return {Promise}            A promise that resolves when the queue is empty and all requests have finished
 */
module.exports = function batchRequest(func, queue,
  settings = { max_requesters: 10, each: (err, result) => {} }) {
  return new BBPromise((resolve, reject) => {
    const state = {
      round_start_time: new Date().getTime(),
      max_requesters: settings.max_requesters || 10,
      each: (err, result) => {},
      requester_count: 0,
      waiting: null,
      actually_hit: 0
    }; 
    
    // max_requesters should never be more then the items in the queue
    state.max_requesters = state.max_requesters > queue.length ? queue.length : state.max_requesters;

    const combinedResults = {
      rejected_count: 0,
      accepted_count: 0,
      batches_count: 0,
      errors: [],
      data: []
    };

    const done = () => {
      if (state.requester_count > 0) { return; }

      if (combinedResults.errors.length === 0) {
        delete combinedResults.errors;
      }
  
      if (combinedResults.accepted > 0) {return resolve(combinedResults); }
      return reject(combinedResults);
    };
    

    // start requesters
    for (let i = 0; i < state.max_requesters; i++) {
      state.requester_count += 1;
      requester({ func, queue, state, combinedResults, done }); 
    }
  });
}

