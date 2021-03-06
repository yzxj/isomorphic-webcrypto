let generateSecureRandom;
if (require.getModules) {
  const NativeModules = require('react-native').NativeModules;
  const RNSecureRandom = NativeModules.RNSecureRandom;
  if (RNSecureRandom && RNSecureRandom.generateSecureRandomAsBase64) {
    generateSecureRandom = require('react-native-securerandom').generateSecureRandom;
  }
} 

if (!generateSecureRandom) {
  console.log(`
    isomorphic-webcrypto cannot ensure the security of some operations.
    Please eject and run:

        npm install react-native-securerandom --save
        react-native link

    If you'd like not to eject, upvote this feature request:
    https://expo.canny.io/feature-requests/p/crypto-api
  `);
  generateSecureRandom = function(length) {
    const uint8Array = new Uint8Array(length);
    while (length && length--) {
      uint8Array[length] = Math.floor(Math.random() * 256);
    }
    return Promise.resolve(uint8Array);
  }
}

const EventEmitter = require('mitt')
const b64u = require('b64u-lite')
const str2buf = require('str2buf')
const crypto = require('msrcrypto')
crypto.subtle.forceSync = true

const secureWatch = new EventEmitter()

let secured = !crypto.initPrng
let secureRandomError
if (!secured) {
  generateSecureRandom(48)
  .then(byteArray => {
    crypto.initPrng(Array.from(byteArray))
    secured = true
    secureWatch.emit('secure')
  })
  .catch(err => {
    secureRandomError = err
    secureWatch.emit('secureRandomError')
  })
}

crypto.ensureSecure = () => new Promise((resolve, reject) => {
  if (secured) return resolve();
  if (secureRandomError) return reject(secureRandomError)
  secureWatch.on('secure', () => resolve())
  secureWatch.on('secureRandomError', () => reject(secureRandomError))
});

function standardizeAlgoName(algo) {
  const upper = algo.toUpperCase();
  return upper === 'RSASSA-PKCS1-V1_5' ? 'RSASSA-PKCS1-v1_5' : upper;
}

function ensureUint8Array(buffer) {
  if (typeof buffer === 'string' || buffer instanceof String)
    return str2buf.toUint8Array(buffer);
  if (!buffer) return;
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  if (buffer instanceof Uint8Array) return buffer;
  return buffer;
}

const originalGetRandomValues = crypto.getRandomValues;
crypto.getRandomValues = function getRandomValues() {
  if (!secured) {
    throw new Error(`
      You must wait until the library is secure to call this method:
      crypto.ensureSecure(err => {
        if (err) throw err;
        const safeValues = crypto.getRandomValues();
      });
    `);
  }
  return originalGetRandomValues.apply(crypto, arguments);
}

// wrap all methods to ensure they're secure
const methods = [
  'decrypt',
  'digest',
  'deriveKey',
  'encrypt',
  'exportKey',
  'generateKey',
  'importKey',
  'sign',
  'unwrapKey',
  'verify',
  'wrapKey'
]
methods.map(key => {
  const original = crypto.subtle[key]
  crypto.subtle[key] = function() {
    const args = Array.from(arguments)
    return crypto.ensureSecure()
    .then(() => original.apply(crypto.subtle, args));
  }
  crypto.subtle[key].name = key;
})

const originalGenerateKey = crypto.subtle.generateKey;
crypto.subtle.generateKey = function generateKey() {
  const algo = arguments[0];
  if (algo) {
    if (algo.name) algo.name = algo.name.toLowerCase();
    if (algo.hash && algo.hash.name) algo.hash.name = algo.hash.name.toLowerCase();
  }
  return originalGenerateKey.apply(this, arguments)
  .then(res => {
    if (res.publicKey) {
      res.publicKey.usages = ['verify'];
      res.publicKey.algorithm.name = standardizeAlgoName(res.publicKey.algorithm.name);
      res.privateKey.usages = ['sign'];
      res.privateKey.algorithm.name = standardizeAlgoName(res.privateKey.algorithm.name);
    } else {
      res.usages = ['sign', 'verify'];
      res.algorithm.name = standardizeAlgoName(res.algorithm.name);
    }
    return res;
  });
}

const originalImportKey = crypto.subtle.importKey;
crypto.subtle.importKey = function importKey() {
  const importType = arguments[0];
  const key = arguments[1];
  return originalImportKey.apply(this, arguments)
  .then(res => {
    res.algorithm.name = standardizeAlgoName(res.algorithm.name);
    switch(res.type) {
      case 'secret':
        res.usages = ['sign', 'verify'];
        break;
      case 'private':
        res.usages = ['sign'];
        break;
      case 'public':
        res.usages = ['verify'];
        break;
    }
    if (importType === 'jwk' && key.kty === 'RSA') {
      res.algorithm.modulusLength = b64u.toBinaryString(key.n).length * 8;
      res.algorithm.publicExponent = str2buf.toUint8Array(b64u.toBinaryString(key.e));
    }
    return res;
  });
}

const originalExportKey = crypto.subtle.exportKey;
crypto.subtle.exportKey = function exportKey() {
  const key = arguments[1];
  return originalExportKey.apply(this, arguments)
  .then(res => {
    if (res.kty === 'RSA' || res.kty === 'EC') {
      if (res.d) {
        res.key_ops = ['sign'];
      } else {
        res.key_ops = ['verify'];
      }
    }
    switch(res.alg) {
      case 'EC-256':
      case 'EC-384':
      case 'EC-521':
        delete res.alg;
    }
    return res;
  });
}

const originalDigest = crypto.subtle.digest;
crypto.subtle.digest = function digest() {
  arguments[1] = ensureUint8Array(arguments[1]);
  return originalDigest.apply(this, arguments);
}

const originalSign = crypto.subtle.sign;
crypto.subtle.sign = function sign() {
  arguments[2] = ensureUint8Array(arguments[2]);
  return originalSign.apply(this, arguments);
}

module.exports = crypto
