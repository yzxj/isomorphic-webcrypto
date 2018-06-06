Forked to adjust compatibility for my own projects' environments.

# isomorphic-webcrypto [![NPM](https://img.shields.io/npm/v/isomorphic-webcrypto.svg)](https://npmjs.com/package/isomorphic-webcrypto)
webcrypto library for Node, React Native and IE11+

## What?

There's a great Node polyfill for the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API), but [it's not isomorphic](https://github.com/anvilresearch/webcrypto/issues/57).

IE11 and versions of Safari < 11 use an older version of the spec, so the browser implementation includes a [webcrypto-shim](https://github.com/vibornoff/webcrypto-shim) to iron out the differences. You'll still need to provide your own Promise polyfill.

There's currently no native crypto support in React Native, so [the Microsoft Research library](https://github.com/kevlened/msrCrypto) is exposed.

## Install

`npm install isomorphic-webcrypto`

## Usage

There's a simple hashing example below, but [there are many more WebCrypto examples here](https://github.com/diafygi/webcrypto-examples). This example requires you to `npm install hex-lite`.

```javascript
const crypto = require('isomorphic-webcrypto')
const hex = require('hex-lite')
// or
import crypto from 'isomorphic-webcrypto'
import hex from 'hex-lite'

crypto.subtle.digest(
  { name: 'SHA-256' },
  new Uint8Array([1,2,3]).buffer
)
.then(hash => {
  // hashes are usually represented as hex strings
  // hex-lite makes this easier
  const hashString = hex.fromBuffer(hash);
})
```

## Compatibility

* IE11+
* Safari 8+
* Edge 12+
* Chrome 43+
* Opera 24+
* Firefox 34+
* Node 4+
* React Native

### React Native

React Native support is implemented using [the Microsoft Research library](https://github.com/kevlened/msrCrypto). The React Native environment only supports `Math.random()`, so [react-native-securerandom](https://github.com/rh389/react-native-securerandom) is used to provide proper entropy. This is handled automatically, except for `crypto.getRandomValues()`, which requires you wait:

```javascript
const crypto = require('isomorphic-webcrypto')

(async () => {
  // Only needed for crypto.getRandomValues
  // but only wait once, future calls are secure
  await crypto.ensureSecure();
  const array = new Uint8Array(1);
  crypto.getRandomValues(array);
  const safeValue = array[0];
})()
```

Working React Native examples:

* Using [create-react-native-app](https://github.com/kevlened/webcrypto-react-native-examples/tree/master/crna) with Expo
* Using an ejected [create-react-native-app](https://github.com/kevlened/webcrypto-react-native-examples/blob/master/crna-ejected)

## I just want to drop in a script tag

You should use [the webcrypto-shim](https://github.com/vibornoff/webcrypto-shim) library directly:

```html
<!-- Any Promise polyfill will do -->
<script src="https://unpkg.com/bluebird"></script>
<script src="https://unpkg.com/webcrypto-shim"></script>
```

## License

MIT
