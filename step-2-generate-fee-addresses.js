const Insight = require('bitcore-explorers').Insight;
const insight = new Insight('https://test-insight.bitpay.com');
delete global._bitcore;
const bitcore = require('bitcore-lib');
const xspoct = require('./xspoct.js');
const fs = require('fs');

const bitcoinTransactionFee = 1300; // 0.00013 Bitcoin
const chainTransactionAmount = 10000; // 1 fee goes to charge up, 1 fee goes to burn, 1-2 goes to burn address 2 goes to change
const burnTransactionAmount = 200000; // 0.00200000 Bitcoin

const aliceBurnSourceAmount = burnTransactionAmount + bitcoinTransactionFee;
const aliceFeeSourceAmount = chainTransactionAmount;
const bobFeeSourceAmount = chainTransactionAmount;


const change = xspoct.generateAddressAndKeys();
const aliceBurnSource = xspoct.generateAddressAndKeys();
const aliceFeeSource = xspoct.generateAddressAndKeys();
const bobFeeSource = xspoct.generateAddressAndKeys();

const privateKeysForStorage = {
  change: change.privateKey.toString(),
  aliceBurnSource: aliceBurnSource.privateKey.toString(),
  aliceFeeSource: aliceFeeSource.privateKey.toString(),
  bobFeeSource: bobFeeSource.privateKey.toString(),
};


fs.writeFile('results/starting-keys.json',
    JSON.stringify(privateKeysForStorage), 'utf8', ()=>{}
);

fs.writeFile('results/starting-keys-backup-' + privateKeysForStorage.change + '.json',
    JSON.stringify(privateKeysForStorage), 'utf8', ()=>{}
);

fs.readFile('results/source-key.json', 'utf8', (err, sourceKeyText)=>{
  if (err) {
    throw new Error(err);
  }
  console.log(sourceKeyText);
  const privateKeyText = JSON.parse(sourceKeyText).privateKey;
  console.log(privateKeyText);
  const privateKey = new bitcore.PrivateKey(privateKeyText);
  const publicKey = privateKey.toPublicKey();
  const address = publicKey.toAddress(bitcore.Networks.testnet);

  console.log('Address:', address);

  insight.getUnspentUtxos(address, function(err, utxos) {
      if (err) {
        // Handle errors...
      } else {
        console.log(utxos);

        const bitcoreTransaction = new bitcore.Transaction()
            .from(utxos[0])
            .to(aliceBurnSource.address, aliceBurnSourceAmount)
            .to(aliceFeeSource.address, aliceFeeSourceAmount)
            .to(bobFeeSource.address, bobFeeSourceAmount)
            .fee(bitcoinTransactionFee)
            .change(change.address)
            .sign(privateKey);

        console.log(bitcoreTransaction);
        // throw new Error('Don\'t broadcast!!!!');
        insight.broadcast(bitcoreTransaction.serialize(), (err, res) => {
          if (err) {
            throw new Error(err);
          }
          console.log(res);

          // findUtxoTimer(0);
          // setTimeout(findUtxoTimer(1), 1000);
          // setTimeout(findUtxoTimer(2), 2000);
          // setTimeout(findUtxoTimer(4), 4000);
          // setTimeout(findUtxoTimer(8), 8000);
          // setTimeout(findUtxoTimer(16), 16000);
          // setTimeout(findUtxoTimer(30), 30000);
          // setTimeout(findUtxoTimer(60), 60000);
          // /**
          //  * time how long it takes to get on to the network (with txId)
          //  * @param {*} time
          //  */
          // function findUtxoTimer(time) {
          //   insight.getUnspentUtxos(address, function(err, utxos) {
          //     if (utxos.length === 0) {
          //       console.log('No transactions at time: ', time);
          //     } else {

          //     }
          //   });
          // }
        });
      }
  });
});
