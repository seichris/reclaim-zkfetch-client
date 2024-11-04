#! /bin/bash

mkdir -p public/browser-rpc
cp -r ./node_modules/@reclaimprotocol/circom-symmetric-crypto/resources ./public/browser-rpc
rm -rf public/browser-rpc/resources/gnark
npm run build