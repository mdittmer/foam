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
      lazyFactory: function() {
        return this.Memo.create({
          f: function(numBits, blockSize) {
            this.console.assert(numBits <= blockSize,
                'Cannot fit more bits than size of block');
            this.console.assert(blockSize < 31,
                'Maximum supported block size is 30 bits');
            var numBlocks = this.binomial(blockSize, numBits);
            var arr = new Array(numBlocks);
            var block = this.firstBlock(numBits);
            var mask = this.firstBlock(blockSize);
            for ( var i = 0; i < numBlocks; ++i ) {
              arr[i] = block;
              block = this.nextBlock(block);
            }
            return arr;
          }.bind(this),
          hashFunction: function(numBits, blockSize) {
            return numBits + ',' + blockSize;
          }
        }).get();
      }
    }
  ],

  methods: {
    firstBlock: function(numBits) {
      numBits = numBits | 0;
      return ((1 << numBits) - 1) | 0;
    },
    nextBlock: function(prevBlock) {
      prevBlock = prevBlock | 0;
      var tmp = ((prevBlock | (prevBlock - 1)) + 1) | 0;
      return tmp | ((((tmp & -tmp) / (prevBlock & -prevBlock)) >>> 1) - 1) | 0;
    }
  },

  tests: [
    {
      model_: 'UnitTest',
      name: '1/8',
      description: 'Compute 1-bit set bit in 8-bit block',
      code: multiline(function() {/*
        // Store and check 00000001, 00000010, ..., 10000000.
        var bg = X.lookup('foam.dao.index.BlockGenerator').create();
        var arr = bg.generateBlocks(1, 8);
        for ( var i = 0; i < 8; ++i ) {
          var chunk = arr[i];
          var expected = 1 << i;
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
        var arr = bg.generateBlocks(7, 8);
        for ( var i = 0; i < 8; ++i ) {
          var chunk = arr[i];
          var expected = (~(1 << (8 - (i + 1))) &
                  (0x000000FF | 0));
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
        var arr = bg.generateBlocks(2, 8);
        var expected = [
          0x00000003 | 0,
          0x00000005 | 0,
          0x00000006 | 0,
          0x00000009 | 0,
          0x0000000A | 0,
          0x0000000C | 0,
          0x00000011 | 0,
          0x00000012 | 0,
          0x00000014 | 0,
          0x00000018 | 0,
          0x00000021 | 0,
          0x00000022 | 0,
          0x00000024 | 0,
          0x00000028 | 0,
          0x00000030 | 0,
          0x00000041 | 0,
          0x00000042 | 0,
          0x00000044 | 0,
          0x00000048 | 0,
          0x00000050 | 0,
          0x00000060 | 0,
          0x00000081 | 0,
          0x00000082 | 0,
          0x00000084 | 0,
          0x00000088 | 0,
          0x00000090 | 0,
          0x000000A0 | 0,
          0x000000C0 | 0
        ];
        for ( var i = 0; i < expected.length; ++i ) {
          this.assert(arr[i] === expected[i], 'Chunk should be ' +
              expected[i] + ' and is ' + arr[i]);
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
        var arr = bg.generateBlocks(1, 11);
        for ( var i = 0; i < 11; ++i ) {
          var chunk = arr[i];
          var expected = 1 << i;
          this.assert(chunk === expected, 'Chunk should be ' +
              expected + ' and is ' + chunk);
        }
      */})
    }
  ]
});
