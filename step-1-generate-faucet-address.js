const xspoct = require('./xspoct.js');
const fs = require('fs');

const addressAndKeys = xspoct.generateAddressAndKeys();

console.log(addressAndKeys);

const faucetKey = {
  privateKey: addressAndKeys.privateKey.toString(),
  address: addressAndKeys.address.toString(),
};
console.log('Address');
console.log(faucetKey);

fs.writeFile('results/source-key.json', JSON.stringify(faucetKey), 'utf8',
    ()=>{});
