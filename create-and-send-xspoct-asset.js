
const xspoct = require('./xspoct');
const bitcore = require('bitcore-lib');
const fs = require('fs');
const util = require('util');
const Insight = require('bitcore-explorers').Insight;
const insight = new Insight('https://test-insight.bitpay.com');

const amountTotal = 200000; // 0.00200000 Bitcoin
const chainTransactionFee = 1300; // 0.00013 Bitcoin
const chainTransactionAmount = 10000;
const outputAmounts = [20000, 39980000];
const networkName = 'testnet';

fs.readFile('results/starting-keys.json', 'utf8', (err, startingKeyText) => {
  const startingKey = JSON.parse(startingKeyText);
  console.log(startingKey);

  const aliceBurnSourcePrivateKey = startingKey.aliceBurnSource;
  const aliceChainTransactionSourcePrivateKey = startingKey.aliceFeeSource;
  const bobChainTransactionSourcePrivateKey = startingKey.bobFeeSource;

  const change = {};
  change.privateKeyText = startingKey.change;
  change.privateKey = new bitcore.PrivateKey(change.privateKeyText);
  change.publicKey = change.privateKey.toPublicKey();
  change.address = change.publicKey.toAddress(bitcore.Networks.testnet);

  let assetSettings;
  fs.readFile('asset-settings.json', 'utf8', (err, assetSettingsText) => {
    assetSettings = JSON.parse(assetSettingsText);
    doBurn(); 
  });

  function doBurn() {
    xspoct.generateAndBroadcastAssetBurnTransaction(
        assetSettings,
        chainTransactionAmount,
        chainTransactionFee,
        outputAmounts,
        aliceBurnSourcePrivateKey,
        change.address,
        networkName,
        (err, res)=>{
      if (err) {
        console.log(err);
        throw new Error(err);
      }
      const burnTransaction = res.burnTransaction;
      const xspoctNotes = res.xspoctNotes;

      console.log('burnTransaction');
      console.log(util.inspect(burnTransaction, {depth: null, colors: true}));
      fs.writeFile('./results/burn-transaction-' + burnTransaction.address + '.json',
          JSON.stringify(burnTransaction),
          'utf-8', (err, res)=>{});

      let noteCount = 0;
      xspoctNotes.forEach((xn)=>{
        noteCount++;
        console.log('\n\nAlice\'s XSPOCT Note:', noteCount);
        console.log(util.inspect(xn, {depth: null, colors: true}));
        fs.writeFile('./results/alice-xspoct-note'+ noteCount+ '.json',
          JSON.stringify(xn),
          'utf-8', (err, res)=>{});
      });

      console.log('Check if the burn transaction is processed.');
      checkBurnTransactionProcessed();

      /**
       * This function waits 10 seconds, then sees if the transaction has been
       * processed. If it hasn't it waits another 10 seconds and so on.
       */
      function checkBurnTransactionProcessed() {
        setTimeout(function() {
          insight.getUnspentUtxos(burnTransaction.address, function(err, utxos) {
            if (err) {
              throw new Error(err);
            } else if (utxos.length > 0) {
              console.log('Transaction found!');
              sendToBob();
            } else {
              console.log('Transaction has not yet been found.');
              checkBurnTransactionProcessed();
            }
          });
        }, 10000);
      }

      /** */
      function sendToBob() {
        console.log('\nAlice intends to send XSPOCT to Bob.\nBob generates an output address');
        const bobOutput =
            xspoct.generateSingleOutput(outputAmounts[0], 'testnet');

        console.log('\n\nBob\'s private output data:\n');
        console.log(bobOutput.outputPrivate);
        console.log('\n\nBob sends to Alice (outputForTransaction):\n');
        console.log(bobOutput.outputForTransaction);

        const outputsForTransactionBob = [bobOutput.outputForTransaction];
        // Alice decides to send the first output to Bob
        console.log('\n\n\nAlice adds the output string to the XSPOCT note and enters proof on the blockchain');

        xspoct.transferXspoct(xspoctNotes[0], outputsForTransactionBob,
            aliceChainTransactionSourcePrivateKey, chainTransactionAmount,
            chainTransactionFee, networkName,
            function(err, res) {
          if (err) {
            console.log(err);
            throw new Error(err);
          }
          console.log('\nAlice sends Bob this XSPOCT note:\n');
          console.log(util.inspect(res.xspoctNote, {depth: null, colors: true}));

          const xspoctNoteAsSentToBobFromAlice = res.xspoctNote;

          console.log('\n\n\nBob adds his private details to the XSPOCT note before saving');

          const bobXspoctNote =
              xspoct.addPrivateDetailsToXspoctNote(xspoctNoteAsSentToBobFromAlice,
                bobOutput.outputPrivate);

          console.log('\nBob\'s XSPOCT note:\n');
          console.log(util.inspect(bobXspoctNote, {depth: null, colors: true}));

          fs.writeFile('./results/bob-xspoct.json',
            JSON.stringify(bobXspoctNote),
            'utf-8', (err, res)=>{});

          sendToCharlie();
          // console.log('Check if the proof transaction for the transfer to Bob is processed.');
          // checkBobTransactionProcessed();
          // /**
          //  * This function waits 10 seconds, then sees if the transaction has been
          //  * processed. If it hasn't it waits another 10 seconds and so on.
          //  */
          // function checkBobTransactionProcessed() {
          //   setTimeout(function() {
          //     insight.getUnspentUtxos(chainTransactionAliceToBob.address,
          //         function(err, utxos) {
          //       if (err) {
          //         throw new Error(err);
          //       } else if (utxos.length > 0) {
          //         console.log('Transaction found!');
          //         sendToCharlie();
          //       } else {
          //         console.log('Transaction has not yet been found.');
          //         checkBobTransactionProcessed();
          //       }
          //     });
          //   }, 10000);
          // }

          /** */
          function sendToCharlie() {
            // Bob sends XSPOCT to Charlie
            console.log('\nBob intends to send XSPOCT to Charlie.\nCharlie generates an output address');
            const charlieOutput =
                xspoct.generateSingleOutput(outputAmounts[0], 'testnet');

            const outputsForTransactionCharlie = [charlieOutput.outputForTransaction];
            console.log('\n\n\nBob adds the output string to the XSPOCT note and enters proof on the blockchain');
            xspoct.transferXspoct(bobXspoctNote, outputsForTransactionCharlie,
                  bobChainTransactionSourcePrivateKey, chainTransactionAmount,
                  chainTransactionFee, networkName,
                  function(err, res) {
                if (err) {
                  throw new Error(err);
                }
                console.log('\nBob sends Charlie this XSPOCT note:\n');
                console.log(util.inspect(res.xspoctNote, {depth: null, colors: true}));

                console.log('\n\n\nCharlie adds his private details to the XSPOCT note before saving');
                const charlieXspoctNote =
                    xspoct.addPrivateDetailsToXspoctNote(res.xspoctNote, charlieOutput.outputPrivate);

                console.log('\nCharlie\'s XSPOCT note:\n');
                console.log(util.inspect(charlieXspoctNote, {depth: null, colors: true}));

                fs.writeFile('./results/charlie-xspoct.json',
                  JSON.stringify(charlieXspoctNote),
                  'utf-8', (err, res)=>{});
            });
          }
        });
      }
    });
  }
});
