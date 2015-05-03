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
  name: 'PopCountMapGenerator',
  package: 'foam.dao.index',

  requires: [
    'foam.Memo',
    'foam.dao.index.BlockGenerator'
  ],
  imports: [
    'console',
    'blockGenerator'
  ],
  exports: [
    'blockGenerator'
  ],

  properties: [
    {
      name: 'blockGenerator',
      type: 'foam.dao.index.BlockGenerator',
      lazyFactory: function() {
        return this.BlockGenerator.create();
      }
    },
    {
      model_: 'FunctionProperty',
      name: 'generatePopCountMap',
      lazyFactory: function() {
        return this.Memo.create({
          f: function(blockSize) {
            this.console.assert(blockSize <= 32,
                'Maximum supported block size for pop counts is 32 bits');
            var popCountMap = {};
            for ( var i = 0; i <= blockSize; ++i ) {
              popCountMap[i] = this.generatePopCountMap_(i, blockSize);
            }
            return popCountMap;
          }.bind(this)
        }).get();
      }
    },
    {
      model_: 'FunctionProperty',
      name: 'generatePopCountMap_',
      lazyFactory: function() {
        return this.Memo.create({
          f: function(numBits, blockSize) {
            var blocks = this.blockGenerator.generateBlocks(numBits, blockSize);
            var popCountMap = {};
            for ( var i = 0; i < blocks.length; ++i ) {
              var block = blocks[i];
              popCountMap[block] = this.generatePopCounts_(block, blockSize);
            }
            return popCountMap;
          }.bind(this),
          hashFunction: function(numBits, blockSize) {
            return numBits + ',' + blockSize;
          }
        }).get();
      }
    },
    {
      model_: 'FunctionProperty',
      name: 'generatePopCounts_',
      lazyFactory: function() {
        return this.Memo.create({
          f: function(block, numBits) {
            var counts = new Array(numBits);
            var msb = 1 << (numBits - 1);
            var count = 0;
            for ( var i = 0; i < numBits; ++i ) {
              if ( block & msb ) ++count;
              counts[i] = count;
              block <<= block;
            }
            return counts;
          }.bind(this),
          hashFunction: function(block, numBits) {
            return block + ',' + numBits;
          }
        }).get();
      }
    }
  ],

  tests: [
    {
      model_: 'UnitTest',
      name: '2-bit PopCountMap',
      description: 'Confirm values of 2-bit PopCountMap',
      code: multiline(function() {/*
        var pcmg = X.lookup('foam.dao.index.PopCountMapGenerator').create();
        var pcm = pcmg.generatePopCountMap(2);
        this.assert(Object.keys(pcm).length === 3, 'Expected three keys in ' +
            '2-bit popcount map');
        this.assert(Object.keys(pcm).filter(function(key) {
          return key === '0' || key === '1' || key === '2';
        }).length === Object.keys(pcm).length, 'Expected  keys in 2-bit ' +
            'popcount map to be 0, 1, 2');
      */})
    },
    {
      model_: 'UnitTest',
      name: 'PopCountMap memoization',
      description: 'Confirm that generatePopCountMap results are memoized',
      code: multiline(function() {/*
        var pcmg = X.lookup('foam.dao.index.PopCountMapGenerator').create();
        var t0 = GLOBAL.performance.now();
        var pcm1 = pcmg.generatePopCountMap(12);
        var t1 = GLOBAL.performance.now();
        var pcm2 = pcmg.generatePopCountMap(12);
        var t2 = GLOBAL.performance.now();
        this.assert((t1 - t0) >= (t2 - t1), 'generatePopCountMap: Expected ' +
            'to result in improved performance');
      */})
    },
    {
      model_: 'UnitTest',
      name: 'PopCountMap identity',
      description: 'Confirm that repeated generatePopCountMap returns same object',
      code: multiline(function() {/*
        var pcmg = X.lookup('foam.dao.index.PopCountMapGenerator').create();
        var pcm1 = pcmg.generatePopCountMap(14);
        var pcm2 = pcmg.generatePopCountMap(14);
        this.assert(pcm1 === pcm2, 'generatePopCountMap: Expected ' +
            'repeated call to return same object');
      */})
    },
    {
      model_: 'UnitTest',
      name: 'PopCountMap_ memoization',
      description: 'Confirm that generatePopCountMap_ results are memoized',
      code: multiline(function() {/*
        var pcmg = X.lookup('foam.dao.index.PopCountMapGenerator').create();
        var t0 = GLOBAL.performance.now();
        var pcm1 = pcmg.generatePopCountMap_(8, 15);
        var t1 = GLOBAL.performance.now();
        var pcm2 = pcmg.generatePopCountMap_(8, 15);
        var t2 = GLOBAL.performance.now();
        this.assert((t1 - t0) >= (t2 - t1), 'generatePopCountMap_: Expected ' +
            'to result in improved performance');
      */})
    },
    {
      model_: 'UnitTest',
      name: 'PopCountMap_ identity',
      description: 'Confirm that repeated generatePopCountMap_ returns same object',
      code: multiline(function() {/*
        var pcmg = X.lookup('foam.dao.index.PopCountMapGenerator').create();
        var pcm1 = pcmg.generatePopCountMap_(4, 7);
        var pcm2 = pcmg.generatePopCountMap_(4, 7);
        this.assert(pcm1 === pcm2, 'generatePopCountMap_: Expected ' +
            'repeated call to return same object');
      */})
    },
    {
      model_: 'UnitTest',
      name: 'PopCount memoization',
      description: 'Confirm that generatePopCounts_ results are memoized',
      code: multiline(function() {/*
        var pcmg = X.lookup('foam.dao.index.PopCountMapGenerator').create();
        var t0 = GLOBAL.performance.now();
        var pc1 = pcmg.generatePopCounts_(42, 16);
        var t1 = GLOBAL.performance.now();
        var pc2 = pcmg.generatePopCounts_(42, 16);
        var t2 = GLOBAL.performance.now();
        this.assert((t1 - t0) >= (t2 - t1), 'generatePopCounts_: Expected ' +
            'to result in improved performance');
      */})
    },
    {
      model_: 'UnitTest',
      name: 'PopCount identity',
      description: 'Confirm that repeated generatePopCounts_ returns same object',
      code: multiline(function() {/*
        var pcmg = X.lookup('foam.dao.index.PopCountMapGenerator').create();
        var pc1 = pcmg.generatePopCounts_(11, 8);
        var pc2 = pcmg.generatePopCounts_(11, 8);
        this.assert(pc1 === pc2, 'generatePopCounts_: Expected ' +
            'repeated call to return same object');
      */})
    }
  ]
});
