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
    'foam.Memo'
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
          f: function(blockSize, superBlockSize) {
            this.console.assert(blockSize <= 32,
                'Maximum supported block size for pop counts is 32 bits');
            var blocks = this.blockGenerator.generateBlocks(
                blockSize, superBlockSize);
            var popCountMap = {};
            for ( var i = 0; i < blocks.length; ++i ) {
              var block = blocks[i];
              popCountMap[block] =
                  this.generatePopCounts_(block, blockSize);
            }
            return popCountMap;
          }.bind(this),
          hashFunction: function(blockSize, superBlockSize) {
            return blockSize + ',' + superBlockSize;
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
  ]
});
