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
    'foam.Memo',
    'foam.dao.index.BitVector'
  ],
  imports: [
    'console'
  ],

  properties: [
    {
      model_: 'FunctionProperty',
      name: 'factorial',
      lazyFactory: function() {
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
      lazyFactory: function() {
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
      todo: 'Since managing returned vector is the responsibility of the caller, this probably should not be memoized here. If anything, the caller can memoize.',
      lazyFactory: function() {
        return this.Memo.create({
          f: function(numBits, blockSize) {
            this.console.assert(numBits <= blockSize,
                'Cannot fit more bits than size of block');
            this.console.assert(blockSize < 31,
                'Maximum supported block size is 30 bits');
            var totalBits = this.binomial(blockSize, numBits) * blockSize,
            vector = this.BitVector.create({ numBits: totalBits }),
            block = this.firstBlock(numBits),
            mask = this.firstBlock(blockSize);
            for ( var i = 0; (block & mask) === block; i += blockSize ) {
              var msbAlignedBlock = block << (32 - blockSize);
              vector.writeNumbers(i, blockSize, [msbAlignedBlock]);
              block = this.nextBlock(block);
            }
            return vector;
          }.bind(this),
          hashFunction: function(numBits, blockSize) {
            return numBits + ',' + blockSize;
          }
        }).get();
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
  ],

  tests: [
    {
      model_: 'UnitTest',
      name: '1/8',
      description: 'Compute 1-bit set bit in 8-bit block',
      code: multiline(function() {/*
        // Store and check 00000001, 00000010, ..., 10000000.
        var bg = X.lookup('foam.dao.index.BlockGenerator').create();
        var vector = bg.generateBlocks(1, 8);
        for ( var i = 0; i < 8; ++i ) {
          var chunk = vector.readNumbers(i * 8, 8)[0],
              expected = 1 << (32 - 8 + i);
          this.assert(chunk === expected, 'Chunk should be ' +
              expected + ' and is ' + chunk);
        }
      */})
    },
    {
      model_: 'UnitTest',
      name: '7/8',
      description: 'Compute 7-bit set bit in 8-bit block',
      code: multiline(function() {/*
        // Store and check 01111111, 10111111, ..., 11111110.
        var bg = X.lookup('foam.dao.index.BlockGenerator').create();
        var vector = bg.generateBlocks(7, 8);
        for ( var i = 0; i < 8; ++i ) {
          var chunk = vector.readNumbers(i * 8, 8)[0],
              expected = (~(1 << (32 - (i + 1))) &
                  (0xFF000000 | 0));
          this.assert(chunk === expected, 'Chunk should be ' +
              expected + ' and is ' + chunk);
        }
      */})
    },
    {
      model_: 'UnitTest',
      name: '2/8',
      description: 'Compute 2-bit set bit in 8-bit block',
      code: multiline(function() {/*
        // Store and check 00000011, 00000101, ..., 11000000.
        var bg = X.lookup('foam.dao.index.BlockGenerator').create();
        var vector = bg.generateBlocks(2, 8);
        var expected = [
          0x03000000 | 0,
          0x05000000 | 0,
          0x06000000 | 0,
          0x09000000 | 0,
          0x0A000000 | 0,
          0x0C000000 | 0,
          0x11000000 | 0,
          0x12000000 | 0,
          0x14000000 | 0,
          0x18000000 | 0,
          0x21000000 | 0,
          0x22000000 | 0,
          0x24000000 | 0,
          0x28000000 | 0,
          0x30000000 | 0,
          0x41000000 | 0,
          0x42000000 | 0,
          0x44000000 | 0,
          0x48000000 | 0,
          0x50000000 | 0,
          0x60000000 | 0,
          0x81000000 | 0,
          0x82000000 | 0,
          0x84000000 | 0,
          0x88000000 | 0,
          0x90000000 | 0,
          0xA0000000 | 0,
          0xC0000000 | 0
        ];
        for ( var i = 0; i < expected.length; ++i ) {
          var chunk = vector.readNumbers(i * 8, 8)[0];
          this.assert(chunk === expected[i], 'Chunk should be ' +
              expected[i] + ' and is ' + chunk);
        }
      */})
    },
    {
      model_: 'UnitTest',
      name: '1/11',
      description: 'Compute 1-bit set bit in 11-bit block',
      code: multiline(function() {/*
        // Store and check 00000000001, 00000000010, ..., 10000000000.
        var bg = X.lookup('foam.dao.index.BlockGenerator').create();
        var vector = bg.generateBlocks(1, 11);
        for ( var i = 0; i < 11; ++i ) {
          var chunk = vector.readNumbers(i * 11, 11)[0],
              expected = 1 << (32 - 11 + i);
          this.assert(chunk === expected, 'Chunk should be ' +
              expected + ' and is ' + chunk);
        }
      */})
    }
  ]
});
