
/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

CLASS({
  name: 'BlockGenerator',
  package: 'foam.dao.index',

  requires: [
    'foam.Memo'
  ],
  imports: [
    'console'
  ],

  properties: [
    {
      model_: 'FunctionProperty',
      name: 'factorial',
      defaultValueFn: function() {
        return this.Memo.create({
          f: function(n) {
            if ( n < 1 ) return 1;
            return n * this.factorial(n - 1);
          }.bind(this)
        }).get();
      }
    },
    {
      model_: 'FunctionProperty',
      name: 'binomial',
      defaultValueFn: function() {
        return this.Memo.create({
          f: function(n, k) {
            return this.factorial(n) /
                (this.factorial(k) * this.factorial(n - k));
          }.bind(this),
          hashFunction: function(n, k) {
            return n + ',' + k;
          }
        }).get();
      }
    },
    {
      model_: 'FunctionProperty',
      name: 'generateBlocks',
      defaultValueFn: function() {
        return this.Memo.create({
          f: function(numBits, blockSize) {
            this.console.assert(numBits <= blockSize,
                'Cannot fit more bits than size of block');
            this.console.assert(blockSize < 31,
                'Maximum supported block size is 30 bits');
            var totalBits = this.binomial(blockSize, numBits) * blockSize,
                totalBytes = Math.ceil(totalBits / 8),
                buffer = new ArrayBuffer(totalBytes),
                bytes = new Uint8Array(buffer),
                block = this.firstBlock(numBits),
                mask = this.firstBlock(blockSize);
            while ( block & mask === block ) {
              this.appendBits(block, numBits, bytes);
              block = this.nextBlock(block);
            }
            return bytes;
          }.bind(this),
          hashFunction: function(numBits, blockSize) {
            return numBits + ',' + blockSize;
          }
        });
      }
    }
  ],

  methods: [
    {
      name: 'firstBlock',
      code: function(numBits) {
        numBits = numBits | 0;
        return ((1 << numBits) - 1) | 0;
      }
    },
    {
      name: 'appendBits',
      code: function(block, numBits, bytes) {
        if ( numBits >= 8 )
          return this.appendBits(block >>> 7, numBits - 7, this.appendBits(
              block, 7, bytes));
        var carryIn = 0, carryOut = 0;
        for ( var i = 0; i < bytes.byteLength; ++i ) {
          carryOut = bytes[i] >>> numBits;
          bytes[i] = (bytes[i] << numBits) | carryIn;
          carryIn = carryOut;
        }
        return bytes;
      }
    },
    {
      name: 'nextBlock',
      code: function(prevBlock) {
        prevBlock = prevBlock | 0;
        var tmp = ((prevBlock | (prevBlock - 1)) + 1) | 0;
        return tmp | ((((tmp & -tmp) / (prevBlock & -prevBlock)) >>> 1) - 1) | 0;
      }
    }
  ]

  // TODO(markdittmer): Write tests.
});
