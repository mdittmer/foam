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
  name: 'RRR',
  package: 'foam.dao.index',

  requires: [
    'foam.Memo',
    'foam.dao.index.BlockGenerator'
  ],
  imports: [
    'blockGenerator'
  ],

  properties: [
    {
      model_: 'IntProperty',
      name: 'blockSize',
      documentation: 'Number of bits per block.',
      defaultValue: 8
    },
    {
      model_: 'IntProperty',
      name: 'superBlockSize',
      documentation: 'Number of blocks per super-block.',
      defaultValue: 8
    },
    {
      name: 'blockGenerator',
      type: 'foam.dao.index.BlockGenerator',
      lazyFactory: function() {
        this.BlockGenerator.create();
      }
    },
    {
      name: 'popCountMap_',
      lazyFactory: function() { return {}; }
    }
  ],

  methods: {
    // TODO(markdittmer): This should probably live in its own Memoizing
    // component so that each popCountMap_ is only generated once.
    generateBlocks_: function() {
      var blocks = this.blockGenerator.generateBlocks(
          this.blockSize, this.superBlockSize);
      for ( var i = 0; i < blocks.length; ++i ) {
        var block = blocks[i];
        this.popCountMap_[block] = this.generatePopCounts_(block);
      }
    },
    generatePopCounts_: function(block, numBits) {
      var counts = new Array(numBits);
      var count = 0;
      for ( var i = numBits - 1; i >= 0; --i ) {
        if ( block & 1 ) ++count;
        counts[i] = count;
        block >>>= block;
      }
      return counts;
    }
  }

  // TODO(markdittmer): Write tests.
});
