'use strict'

/**
 * Returns an object of resources from the given lob object
 * @param  {Lob}     lob       A lob instance
 * @return {Object}  resources An object of resources
 */
function getResources (lob) {
  const ResourceBase = lob.resourceBase
  let resources = {}

  Object.keys(lob).forEach((key) => {
    const resource = lob[key]
    if (resource instanceof ResourceBase && resource !== ResourceBase) {
      resources[key] = resource
    }
  })

  return resources
}

module.exports = getResources
