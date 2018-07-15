# XSPOCT
XCredits-style private off-chain transactions

## Using this repository
1. Generate a private key, public key and addrees by running 
~~~
node step-1-generate-faucent-address.js
~~~

2. Get some Bitcoin testnet coins from a testnet faucet.

3. Generate a private keys for the variety of 'source' adresses needed. Run
~~~
node step-2-generate-fee-addresses.js
~~~

4. Run 
~~~
node create-and-send-xspoct.js
~~~

to simulate sending XSPOCT from Alice, to Bob then to Charlie.

To read about the whitepaper about this methodology, [click here](https://github.com/XCredits/xcredits-whitepapers/blob/master/xspoct.md).