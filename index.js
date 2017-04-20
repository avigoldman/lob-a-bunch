'use strict';

const getResources = require('./utils/getResources');
const merge = require('lodash.merge');

function lobPlus(lob) {
  if (!(lob.constructor.name === 'Lob')) {
    throw new Error('lob must be an instance of Lob Node library');
  }

  return lob;
};

module.exports = lobPlus;