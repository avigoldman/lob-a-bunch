# Lob a bunch

Some times you want to send more then one postcard/letter/check at a time. Now you can.


## Table of contents
* [Installation](#installation)
* [Setup](#setup)
* [Basic Example](#basic-example)
* [Sending mail](#sending-mail)
* [Creating addresses and bank accounts](#creating-addresses-and-bank-accounts)
* [Handling responses](#handling-responses)
* [Handling errors](#handling-errors)
* [Testing](#testing)

## Installation

Install this the usual npm way. You need to have the [node Lob library](https://github.com/lob/lob-node/) installed separately.

```
npm install lob-a-bunch --save
```

## Setup

`lob-a-bunch` will modify an existing Lob object to give it the batching functionality.

```js
const lobABunch = require('lob-a-bunch');
const Lob = require('lob')('YOUR API KEY');

lobABunch(Lob);
```

### Safe mode

To lessen the chance of conflicts or incompatibilities with the lob library use safe mode.

When using the batch functionality use `batch` instead of `create` with same payload.

```
lobABunch.safe(Lob);

Lob.addresses.batch([ ... ]) // instead of Lob.addresses.create
	.then(() => {});
```


## Basic Example

Now we're all set to use an array of recipients instead of just one.

```js
Lob.postcards.create({
  description: 'Demo Postcard job',
  to: [ {
      name: 'Harry Potter',
      address_line1: '4 Privet Drive',
      address_city: ', Elkridge',
      address_state: 'MD',
      address_zip: '21075',
      overrides: {
        data: { name: 'Harry' }
      }
    }, {
      name: 'Ron Weasley',
      address_line1: '123 Main Street',
      address_city: 'Mountain View',
      address_state: 'CA',
      address_zip: '94041',
      overrides: {
        data: { name: 'Ron' }
      }
    } ],
  front: '<html style="padding: 1in; font-size: 50;">Front HTML for {{name}}</html>',
  back: '<html style="padding: 1in; font-size: 20;">Back HTML for {{name}}</html>',
  data: { name: 'my favorite person' }
}).then((results) => {
  console.log(results);
}).catch((err) => {
  console.log(err);
});
```

This should give use something like this back.

```js
{ "rejected_count": 0,
  "accepted_count": 2,
  "batch_count": 0,
  "data":
   [ { "id": "psc_dceaa5c60f3bc71d",
       ...
       "object": "postcard" },
     { "id": "psc_1c73d1a31c03e5f9",
       ...
       "object": "postcard" } ] }
```


## Sending mail
**Important:** The documentation is written for postcards but works identically with both *letters* and *checks*.

#### `postcard.create(payload[, config, callback])` -> `Promise`<br>`letters.create(payload[, config, callback])` -> `Promise`<br>`checks.create(payload[, config, callback])` -> `Promise`
* `payload`
	* See the [docs](https://lob.com/docs/node#postcards_object) for all the arguments
	* Type: `Object`
	* Required: `true`
* `payload.to`
	* Type: `Array|Object|String`
	* Description: `to` is either an single recipient (the default functionality) or an array of recipients. Recipients can be an object with the correct address parameters or a string ID of an pre-existing address.
	* Required: `true`
* `payload.to[x].overrides`
	* Type: `Object`
	* Description: An object of values to be merged the payload. Use this to modify the `message`, `data`, or any other value on a recipient basis.
	* Required: `false`
* `config`
	* Type: `Object`
	* Description: Configuration for the batch requesting.
	* Required: `false`
* `config.every`
	* Type: `Function`
	* Description: A function called with the `error` and `result` after each request is fulfilled.
	* Required: `false`
* `config.max_requests`
	* Type: `Number`
	* Description: The maximum number of requests that can be open at once. (This will never be larger then the number of recipients)
	* Default: `25`
	* Required: `false`
* `callback`
	* Type: `Function`
	* Description: A function called after all the requests have been fulfilled.
	* Required: `false`


## Creating addresses and bank accounts
**Important:** The documentation is written for addresses but works identically with *bank accounts*.

#### `addresses.create(payload[, config, callback])` -> `Promise`<br>`bankAccounts.create(payload[, config, callback])` -> `Promise`
* `payload`
	* See the [docs](https://lob.com/docs/node#addresses_create) for all the arguments
	* Type: `Array|Object`
	* Required: `true`
	* An a single address object or an array of address objects
* `config`
	* Type: `Object`
	* Description: Configuration for the batch requesting.
	* Required: `false`
* `config.every`
	* Type: `Function`
	* Description: A function called with the `error` and `result` after each request is fulfilled.
	* Required: `false`
* `config.max_requests`
	* Type: `Number`
	* Description: The maximum number of requests that can be open at once. (This will never be larger then the number of recipients)
	* Default: `25`
	* Required: `false`
* `callback`
	* Type: `Function`
	* Description: A function called after all the requests have been fulfilled.
	* Required: `false`


## Handling Responses

If a single object is passed in `payload.to` for sending mail or in creating an address or bank account the normal response is given. If an array is given in its place the response is as follows.

Response objects contain the listed values when given in the Promise or callback. The order of the responses is not guaranteed.

* `err.rejected_count` - The number of requests that failed for any reason except rate limiting.
* `err.accepted_count` - The number of requests that succeeded.
* `err.batch_count` - The number of times the rate limit was hit and waited on.
* `err.errors` - An array of all the errors that came back. The errors are passed directly from lob with the added value of `_request` which has the object sent to the API. This key only exists if there is one or more errors.
* `err.data` - An array of all the successful responses. These are purely passed through from lob.


## Handling Errors

The batch create functions will throw back an error only if no requests are successful and there is at least one error. The error has a `results` key which is identical to the response outline above.

```
Lob.postcards.create(...)
.catch((err) => {
	console.log(err.results); // outputs { rejected_count: 3, ... }
});
```


## Testing