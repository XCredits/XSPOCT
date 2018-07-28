'use strict';
const Insight = require('bitcore-explorers').Insight;
delete global._bitcore;
const bitcore = require('bitcore-lib');
// const bs58 = require('bs58');
const bs58check = require('bs58check');
const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const globalSpecification = '0.2.0';


bitcore.Networks.defaultNetwork = bitcore.Networks.testnet;
// bitcore.Networks.defaultNetwork=bitcore.Networks.livenet;
// define Buffer if not defined (e.g. in browser)
if (typeof Buffer === 'undefined') {
  Buffer = bitcore.deps.Buffer;
}

module.exports = {
  generateAndBroadcastBurnTransaction,
  generateAndBroadcastAssetBurnTransaction,
  generateBurnTransaction,
  generateAssetBurnTransaction,
  generateSingleOutput,
  generateBurnAddressFromHash,
  transferXspoct,
  addOutputsToXspoctNote,
  addPrivateDetailsToXspoctNote,
  sha256Plus,
  generateAddressAndKeys,
  generateXspoctNoteFromBurnTransaction,
};

/**
 *
 * @param {*} amount
 * @param {*} fee
 * @param {*} outputAmounts
 * @param {*} inputPrivateKey
 * @param {*} changeAddress
 * @param {*} networkName
 * @param {*} callback
 */
function generateAndBroadcastBurnTransaction(
    amount,
    fee,
    outputAmounts,
    inputPrivateKey,
    changeAddress,
    networkName,
    callback) {
  let insightUrl;
  let bitcoreNetwork;
  if (networkName === 'testnet') {
    insightUrl = 'https://test-insight.bitpay.com';
    bitcoreNetwork = bitcore.Networks.testnet;
  } else if (networkName === 'livenet') {
    insightUrl = 'https://insight.bitpay.com';
    bitcoreNetwork = bitcore.Networks.livenet;
  } else {
    throw new Error('Network name not found.');
  }
  const insight = new Insight(insightUrl);

  const privateKeyBitcore = new bitcore.PrivateKey(inputPrivateKey);
  const publicKeyBitcore = privateKeyBitcore.toPublicKey();
  const addressBitcore = publicKeyBitcore.toAddress(bitcoreNetwork);

  insight.getUnspentUtxos(addressBitcore, function(err, utxos) {
    if (err) {
      return callback(err);
    } else if (utxos.length === 0) {
      return callback('No utxo found for corresponding key');
    } else if (utxos.length > 1) {
      return callback('More than 1 utxo found for corresponding key. Note that this requirement will removed in the future.');
    } else {
      const utxo = utxos[0];
      const burnTransaction = generateBurnTransaction(
          utxo.txId,
          amount,
          outputAmounts,
          networkName);

      const bitcoreTransaction = new bitcore.Transaction()
          .from(utxo)
          .to(burnTransaction.address, amount)
          .fee(fee)
          .change(changeAddress)
          .sign(inputPrivateKey);

      insight.broadcast(bitcoreTransaction.serialize(),
          function(err, txId) {
        if (err) {
          return callback(err);
        } else {
          burnTransaction.txId = txId;
          let xspoctNotes = [];
          burnTransaction.outputsPrivate.forEach(function(output) {
            // generate an XSPOCT note for each output
            const xn = generateXspoctNoteFromBurnTransaction(
                burnTransaction.address,
                burnTransaction.string,
                output.proofInputAddress,
                output.spendInfoString,
                output.proofInputPrivateKey,
                output.amount,
                burnTransaction.txId);
            xspoctNotes.push(xn);
          });
          return callback(undefined, {burnTransaction, xspoctNotes});
        }
      });
    }
  });
}


/**
 *
 * @param {*} assetSettings
 * @param {*} chainTransactionAmount Should be small, as it is simply a proof transaction
 * @param {*} fee
 * @param {*} outputAmounts
 * @param {*} inputPrivateKey
 * @param {*} changeAddress
 * @param {*} networkName
 * @param {*} callback
 */
function generateAndBroadcastAssetBurnTransaction(
    assetSettings,
    chainTransactionAmount,
    fee,
    outputAmounts,
    inputPrivateKey,
    changeAddress,
    networkName,
    callback) {
  let insightUrl;
  let bitcoreNetwork;
  if (networkName === 'testnet') {
    insightUrl = 'https://test-insight.bitpay.com';
    bitcoreNetwork = bitcore.Networks.testnet;
  } else if (networkName === 'livenet') {
    insightUrl = 'https://insight.bitpay.com';
    bitcoreNetwork = bitcore.Networks.livenet;
  } else {
    throw new Error('Network name not found.');
  }
  const insight = new Insight(insightUrl);

  const privateKeyBitcore = new bitcore.PrivateKey(inputPrivateKey);
  const publicKeyBitcore = privateKeyBitcore.toPublicKey();
  const addressBitcore = publicKeyBitcore.toAddress(bitcoreNetwork);

  insight.getUnspentUtxos(addressBitcore, function(err, utxos) {
    if (err) {
      return callback(err);
    } else if (utxos.length === 0) {
      return callback('No utxo found for corresponding key');
    } else if (utxos.length > 1) {
      return callback('More than 1 utxo found for corresponding key. Note that this requirement will removed in the future.');
    } else {
      const utxo = utxos[0];
      const burnTransaction = generateAssetBurnTransaction(
          assetSettings,
          chainTransactionAmount,
          outputAmounts,
          networkName);

      const bitcoreTransaction = new bitcore.Transaction()
          .from(utxo)
          .to(burnTransaction.address, chainTransactionAmount)
          .fee(fee)
          .change(changeAddress)
          .sign(inputPrivateKey);

      insight.broadcast(bitcoreTransaction.serialize(),
          function(err, txId) {
        if (err) {
          return callback(err);
        } else {
          burnTransaction.txId = txId;
          let xspoctNotes = [];
          burnTransaction.outputsPrivate.forEach(function(output) {
            // generate an XSPOCT note for each output
            const xn = generateXspoctNoteFromBurnTransaction(
                burnTransaction.address,
                burnTransaction.string,
                output.proofInputAddress,
                output.spendInfoString,
                output.proofInputPrivateKey,
                output.amount,
                burnTransaction.txId);
            xspoctNotes.push(xn);
          });
          return callback(undefined, {burnTransaction, xspoctNotes});
        }
      });
    }
  });
}


/**
 *
 * @param {*} utxoId
 * @param {*} amount
 * @param {*} outputAmounts
 * @param {*} networkName
 * @return {object} Burn transaction information
 */
function generateBurnTransaction(
    utxoId,
    amount,
    outputAmounts,
    networkName
  ) {
  const {outputsPrivate, outputsForTransaction} =
      generateOutputs(amount, outputAmounts, networkName);

  // Generate burn transaction on Bitcoin
  const burnTransaction = {
    source: {
      utxo: utxoId,
      platform: 'bitcoin-' + networkName,
    },
    outputs: outputsForTransaction,
    specification: globalSpecification,
  };
  const burnTransactionString = JSON.stringify(burnTransaction);

  const burnTransactionHash = sha256Plus(Buffer.from(burnTransactionString));

  const address =
      generateBurnAddressFromHash(burnTransactionHash, networkName);
  if (!bitcore.Address.isValid(address)) {
    throw new Error('\n Error: Address failed to generate \n');
  }

  return {
      address,
      outputsPrivate,
      object: burnTransaction, // Data about where outputs will go
      string: burnTransactionString,
      hash: burnTransactionHash,
  };
}

/**
 *
 * @param {*} assetSettings
 * @param {*} amount
 * @param {*} outputAmounts
 * @param {*} networkName
 * @return {object} Burn transaction information
 */
function generateAssetBurnTransaction(
    assetSettings,
    amount,
    outputAmounts,
    networkName
  ) {
  const {outputsPrivate, outputsForTransaction} =
      generateOutputs(assetSettings.supply, outputAmounts, networkName);

  // Generate burn transaction on Bitcoin
  const burnTransaction = {
    asset: assetSettings,
    outputs: outputsForTransaction,
    specification: globalSpecification,
  };
  const burnTransactionString = JSON.stringify(burnTransaction);

  const burnTransactionHash = sha256Plus(Buffer.from(burnTransactionString));

  const address =
      generateBurnAddressFromHash(burnTransactionHash, networkName);
  if (!bitcore.Address.isValid(address)) {
    throw new Error('\n Error: Address failed to generate \n');
  }

  return {
      address,
      outputsPrivate,
      object: burnTransaction, // Data about where outputs will go
      string: burnTransactionString,
      hash: burnTransactionHash,
  };
}

/**
 *
 * @param {*} amountTotal
 * @param {*} outputAmounts
 * @param {*} networkName
 * @return {*}
 */
function generateOutputs(amountTotal, outputAmounts, networkName) {
  // Generate private and public keys for future transactions
  const outputsForTransaction = [];
  const outputsPrivate = [];

  // Check the sum
  let outputSum = 0;
  outputAmounts.forEach((ithAmount) => {
    if (ithAmount <= 0) {
      throw new Error('Output amounts cannot be negative or zero.');
    }
    outputSum += ithAmount;
  });
  if (outputSum !== amountTotal) {
    throw new Error('Output amount does not sum to input amount.');
  }
  outputAmounts.forEach((amount)=>{
    const {outputPrivate, outputForTransaction} =
        generateSingleOutput(amount, networkName);
    outputsPrivate.push(outputPrivate);
    outputsForTransaction.push(outputForTransaction);
  });
  return {outputsPrivate, outputsForTransaction};
}

/**
 *
 * @param {number} amount
 * @param {string} networkName
 * @return {object}
 */
function generateSingleOutput(amount, networkName) {
  let networkBitcore;
  if (networkName === 'livenet') {
    networkBitcore = bitcore.Networks.livenet;
  } else if (networkName === 'testnet') {
    networkBitcore = bitcore.Networks.testnet;
  } else {
    throw new Error('Network not found.');
  }

  // Generate a private/public key/address
  const proofInputPrivateKeyBitcore = new bitcore.PrivateKey();
  const inputProofPublicKeyBitcore = proofInputPrivateKeyBitcore.publicKey;
  const addressBitcore =
      new bitcore.Address(inputProofPublicKeyBitcore, networkBitcore);

  const proofInputPrivateKey = proofInputPrivateKeyBitcore.toString();
  const inputProofPublicKey = inputProofPublicKeyBitcore.toString();
  const proofInputAddress = addressBitcore.toString();

  // where the next transaction will be found
  const spendInfo = {
    proofInputAddress: proofInputAddress,
    specification: globalSpecification,
    verificationPlatform: 'bitcoin-' + networkName,
    nonce: crypto.randomFillSync(Buffer.alloc(32)).toString('base64'),
  };
  const spendInfoString = JSON.stringify(spendInfo);
  const spendInfoHash = sha256Plus(spendInfoString);

  const outputPrivate = {
    amount,
    proofInputPrivateKey,
    inputProofPublicKey,
    proofInputAddress,
    spendInfoString,
    spendInfoHash,
  };
  const outputForTransaction = {
    amount,
    spendInfoHash,
  };

  return {outputPrivate, outputForTransaction};
}

/**
 * @param {string} networkName
 * @return {*} Address details
 */
function singleAddress(networkName) {
  let networkBitcore;
  if (networkName === 'livenet') {
    networkBitcore = bitcore.Networks.livenet;
  } else if (networkName === 'testnet') {
    networkBitcore = bitcore.Networks.testnet;
  } else {
    throw new Error('Network not found.');
  }

  // Generate a private/public key/address
  const privateKeyBitcore = new bitcore.PrivateKey();
  const publicKeyBitcore = privateKeyBitcore.publicKey;
  const addressBitcore =
      new bitcore.Address(publicKeyBitcore, networkBitcore);

  return {
    privateKey: privateKeyBitcore.toString(),
    publicKey: publicKeyBitcore.toString(),
    address: addressBitcore.toString(),
  };
}


/**
 *
 * @param {string} hash
 * @param {string} networkName
 * @return {string} Address to be used for burn transaction
 */
function generateBurnAddressFromHash(hash, networkName) {
  // Add prefix
  let prefix;
  if (networkName === 'livenet') {
    prefix = '00';
  } else if (networkName === 'testnet') {
    prefix = '6f';
  } else {
    throw new Error('Unrecognised network.');
  }

  const prefixedString = prefix.concat(hash);
  let prefixedStringBuffer = Buffer.from(prefixedString, 'hex');
  prefixedStringBuffer = prefixedStringBuffer.slice(0, 21);

  // // https://www.reddit.com/r/Bitcoin/comments/2ss3en/calculating_checksum_for_bitcoin_address/
  // // https://en.bitcoin.it/wiki/Technical_background_of_version_1_Bitcoin_addresses
  // console.log('\n\n Test string:');
  // const testString = '00f54a5851e9372b87810a8e60cdd2e7cfd80b6e31';
  // const testStringBuffer = Buffer.from(testString, 'hex');
  // prefixedStringBuffer = testStringBuffer;
  // console.log('prefixedStringBuffer: ', prefixedStringBuffer, ' ', prefixedStringBuffer.length);

  const address = bs58check.encode(prefixedStringBuffer);

  return address;
}

/**
 * An XSPOCT note, when first created, has only the burn transaction on it.
 * Although there can be many burn inputs (when XSPOCT notes are joined), it can
 * only have multiple inputs when XSPOCT notes are joined.
 * Format:
 * xspoctNote = { // indexed by address
 *  burnTransactions:[
 * {
 *    string: "string-that-contains-public-key-for-address-and-secret-public-key-as-well-as-any-output-splits"
 *    txId: "txidOfProofTransactionOnBlockChain"
 *  } ],
 *  outputAddress: "address of next transaction"
 * }
 * Note that a single burn transaction will, in general, have many outputs. As
 * such, a new note should be created for each output of a burn transaction.
 * @param {*} burnTransactionAddress
 * @param {*} transactionString
 * @param {*} proofInputAddress
 * @param {*} spendInfoString
 * @param {*} proofInputPrivateKey
 * @param {*} amount
 * @param {*} txId
 * @return {*} The XSPOCT note
 */
function generateXspoctNoteFromBurnTransaction(
    burnTransactionAddress,
    transactionString,
    proofInputAddress,
    spendInfoString,
    proofInputPrivateKey,
    amount,
    txId) {
  const burnTransaction = {
    transactionString: transactionString,
    spendInfoStrings: {},
    txId: txId,
  };

  const spendInfoHash = sha256Plus(spendInfoString);
  burnTransaction.spendInfoStrings[spendInfoHash] = spendInfoString;

  const xspoctNote = {
    burnTransactions: {},
    xspoctTransactions: {},
    current: {
      burnTransactionAddress,
    },
    next: {
      proofInputAddress,
      proofInputPrivateKey,
    },
    amount: amount,
  };
  xspoctNote.burnTransactions[burnTransactionAddress] = burnTransaction;
  return xspoctNote;
}

/**
 *
 * @param {*} xspoctNote
 * @param {*} outputsForTransaction
 * @param {*} chainTransactionInputPrivateKey
 * @param {*} chainTransactionAmount
 * @param {*} chainTransactionFee
 * @param {*} networkName
 * @param {function} callback
 */
function transferXspoct(xspoctNote, outputsForTransaction,
    chainTransactionInputPrivateKey, chainTransactionAmount,
    chainTransactionFee, networkName, callback) {
  const {newXspoctNote, proofInputAddress, proofBurnAddress, changeAddress} =
      addOutputsToXspoctNote(xspoctNote, outputsForTransaction, networkName);

  let insightUrl;
  let bitcoreNetwork;
  if (networkName === 'testnet') {
    insightUrl = 'https://test-insight.bitpay.com';
    bitcoreNetwork = bitcore.Networks.testnet;
  } else if (networkName === 'livenet') {
    insightUrl = 'https://insight.bitpay.com';
    bitcoreNetwork = bitcore.Networks.livenet;
  } else {
    throw new Error('Network name not found.');
  }
  const insight = new Insight(insightUrl);

  const inputPrivateKeyBitcore = new bitcore.PrivateKey(chainTransactionInputPrivateKey);
  const inputPublicKeyBitcore = inputPrivateKeyBitcore.toPublicKey();
  const inputAddressBitcore = inputPublicKeyBitcore.toAddress(bitcoreNetwork);

  insight.getUnspentUtxos(inputAddressBitcore, function(err, utxos) {
    if (err) {
      return callback(err);
    } else if (utxos.length === 0) {
      return callback('No utxo found for corresponding key');
    } else if (utxos.length > 1) {
      return callback('More than 1 utxo found for corresponding key. Note that this requirement will removed in the future (will try to find an output with sufficient funds remaining).');
    } else {
      const utxo = utxos[0];

      const chargeUpTransactionAmount =
          chainTransactionAmount - chainTransactionFee;

      // Send funds to the target address on the blockchain
      const bitcoreChargeUpTransaction = new bitcore.Transaction()
          .from(utxo)
          .to(proofInputAddress, chargeUpTransactionAmount)
          .fee(chainTransactionFee)
          .change(inputAddressBitcore)
          .sign(chainTransactionInputPrivateKey);

      console.log('\nutxo');
      console.log(utxo);
      console.log('\nproofInputAddress');
      console.log(proofInputAddress);
      console.log('\nchargeUpTransactionAmount');
      console.log(chargeUpTransactionAmount);
      console.log('\nchainTransactionFee');
      console.log(chainTransactionFee);
      console.log('\ninputAddressBitcore');
      console.log(inputAddressBitcore);
      console.log('\nchainTransactionInputPrivateKey');
      console.log(chainTransactionInputPrivateKey);


      insight.broadcast(bitcoreChargeUpTransaction.serialize(),
          function(err, txId) {
        if (err) {
          return callback(err);
        } else {
          // Send funds from the target address to the burn transaction address
          insight.getUnspentUtxos(proofInputAddress, function(err, utxos) {
            if (err) {
              return callback(err);
            } else if (utxos.length === 0) {
              return callback('No utxo found for corresponding key');
            } else if (utxos.length > 1) {
              return callback('More than 1 utxo found for corresponding key. Note that this requirement will removed in the future (will try to find an output with sufficient funds remaining).');
            } else {
              // We choose a transaction amount at random
              // Between 10 and 20% of the input amount after fees
              const burnTransactionAmount =
                  Math.floor(0.1 * (1 + Math.random()) * (chargeUpTransactionAmount - chainTransactionFee));

              // If the change address is equal to the empty string, we set the
              // change address to the inputProof address

              const utxo = utxos[0];
              const bitcoreProofTransaction = new bitcore.Transaction()
                  .from(utxo)
                  .to(proofBurnAddress, burnTransactionAmount)
                  .fee(chainTransactionFee)
                  .change(changeAddress.address)
                  .sign(xspoctNote.next.proofInputPrivateKey);

                  console.log('\nutxo');
                  console.log(utxo);
                  console.log('\nproofBurnAddress');
                  console.log(proofBurnAddress);
                  console.log('\nmicrotransactionAmount');
                  console.log(burnTransactionAmount);
                  console.log('\nchainTransactionFee');
                  console.log(chainTransactionFee);
                  console.log('\nchangeAddress');
                  console.log(changeAddress.address);
                  console.log('\n xspoctNote.next.proofInputPrivateKey');
                  console.log(xspoctNote.next.proofInputPrivateKey);

              insight.broadcast(bitcoreProofTransaction.serialize(),
                  function(err, txId) {
                if (err) {
                  return callback(err);
                } else {
                  newXspoctNote.xspoctTransactions[newXspoctNote.current.proofInputAddress].txId
                      = txId;
                  return callback(undefined,
                      {xspoctNote: newXspoctNote, changeAddress: changeAddress});
                }
              });
            }
          });
        }
      });
    }
  });
}

/**
 *
 * @param {*} xspoctNote
 * @param {*} outputsForTransaction
 * @param {*} networkName
 * @return {*} An XSPOCT note
 */
function addOutputsToXspoctNote(xspoctNote, outputsForTransaction,
    networkName) {
  // if (!validateXspoctNote(xspoctNote)) {
  //   throw new Error('XSPOCT note is not well formed');
  // }

  // Check the total of the outputs add to the amount of the xspoctNote
  let outputTotal = 0;
  outputsForTransaction.forEach((output) => {
    outputTotal += output.amount;
  });
  if (xspoctNote.amount !== outputTotal) {
    console.log('xspoctNote.amount:', xspoctNote.amount, 'outputTotal:', outputTotal);
    throw new Error('The total of the outputs does not match the input XSPOCT not value');
  }
  // Get the last transaction output, by selecting the last address
  const proofInputAddress = xspoctNote.next.proofInputAddress;

  // Generate a change address for the transaction
  const changeAddress = singleAddress(networkName);

  // Sign the spendInfoHash
  // The purpose of signing of an output is to ensure that the change address
  // is not another burn address. The messgae can be any string, but we use this
  // for simplicity.
  const messageToSign = outputsForTransaction[0].spendInfoHash;
  const message =
    Buffer.from(messageToSign, 'hex');
  const sigObj = secp256k1.sign(message,
      Buffer.from(changeAddress.privateKey, 'hex'));
  const signatureHex = sigObj.signature.toString('hex');

  const transaction = {
    previousProofAddress: xspoctNote.current.proofInputAddress,
    outputs: outputsForTransaction,
    specification: globalSpecification,
    changeAddresses: {},
  };

  transaction.changeAddresses[changeAddress.address] = {
    message: messageToSign,
    signature: signatureHex,
  };

  const transactionString = JSON.stringify(transaction);

  // Hash the transaction data
  const transactionHash = sha256Plus(transactionString);

  const proofBurnAddress = generateBurnAddressFromHash(transactionHash, networkName);

  // Deep copy xspoctNote
  const newXspoctNote = JSON.parse(JSON.stringify(xspoctNote));

  newXspoctNote.xspoctTransactions[proofInputAddress] = {
    transactionString,
    proofInputAddress,
    proofBurnAddress,
  };
  // When we add the hash of the spendInfoString, we have no idea what the
  // output should be. As such, the output is deleted.
  newXspoctNote.current.proofInputAddress = proofInputAddress;
  newXspoctNote.current.proofBurnAddress = proofBurnAddress;
  newXspoctNote.next.proofInputAddress = undefined;
  newXspoctNote.next.proofInputPrivateKey = undefined;

  return {newXspoctNote, proofInputAddress, proofBurnAddress, changeAddress};
}

/**
 *
 * @param {*} xspoctNote
 * @param {*} outputPrivate
 * @return {*}
 */
function addPrivateDetailsToXspoctNote(xspoctNote, outputPrivate) {
  // Deep copy xspoctNote
  const newXspoctNote = JSON.parse(JSON.stringify(xspoctNote));

  newXspoctNote.xspoctTransactions[xspoctNote.current.proofInputAddress].spendInfoString =
      outputPrivate.spendInfoString;

  newXspoctNote.next.proofInputAddress = outputPrivate.proofInputAddress;
  newXspoctNote.next.proofInputPrivateKey = outputPrivate.proofInputPrivateKey;

  return newXspoctNote;
}

/**
 * @param {string} message
 * @return {string} In hex format
 */
function sha256Plus(message) {
  const hash1 = crypto.createHmac('sha256', message).digest('hex');
  const hash2 = crypto.createHmac('sha256', hash1 + message).digest('hex');
  return hash2;
}

/**
 * @return {object} privateKey, publicKey, address
 */
function generateAddressAndKeys() {
    const privateKey = new bitcore.PrivateKey();
    const publicKey = privateKey.publicKey;
    const address =
        new bitcore.Address(publicKey, bitcore.Networks.testnet).toString();

    return {privateKey, publicKey, address};
}


