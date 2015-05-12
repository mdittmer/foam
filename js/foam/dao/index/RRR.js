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
    'foam.dao.index.BlockGenerator',
    'foam.dao.index.PopCountMapGenerator'
  ],
  imports: [
    'blockGenerator',
    'popCountMapGenerator'
  ],
  exports: [
    'blockGenerator',
    'popCountMapGenerator'
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
      name: 'popCountMapGenerator',
      type: 'foam.dao.index.PopCountMapGenerator',
      lazyFactory: function() {
        return this.PopCountMapGenerator.create();
      }
    },
    {
      name: 'data'
    },
    {
      model_: 'IntProperty',
      name: 'blockSize',
      documentation: 'Number of bits per block.',
      units: 'bits',
      defaultValue: 7
    },
    {
      model_: 'IntProperty',
      name: 'superBlockSize',
      documentation: 'Number of blocks per super-block.',
      units: 'blocks',
      defaultValue: 7
    },
    {
      model_: 'IntProperty',
      name: 'classSize',
      documentation: 'Number of bits in class part of block storage.',
      units: 'bits',
      lazyFactory: function() {
        return this.computeClassSize_();
      }
    },
    {
      name: 'popCountMap_',
      lazyFactory: function() {
        return this.generatePopCountMap_();
      }
    }
  ],

  methods: {
    init: function() {
      this.SUPER.apply(this, arguments);
      Events.dynamic(function() {
        this.blockSize;
        this.superBlockSize;
        this.popCountMap_ = this.generatePopCountMap_();
        this.classSize = this.computeClassSize_();
      }.bind(this));
    },
    fromBitVector: function(bitVector) {
      var values = [];
      for ( var i = 0; i < bitVector.bitLength; i += this.blockSize ) {
        // Read block and LSB-align it.
        var blockValue = bitVector.readNumbers(i, this.blockSize)[0] >>>
            (32 - this.blockSize);
        var popCount = this.popCount_(blockValue); // TODO(markdittmer): Implement this.
        var offset = this.offset_(blockValue, popCount); // TODO(markdittmer): Implement this.
        // Store values as [class, offset] before compressing them into a
        // BitVector.
        values.push([popCount, offset]);
      }
      // Compress values to BitVectors and store it.
      this.bitVector = this.valuesToBitVector_(values); // TODO(markdittmer): Implement this.
    },
    construct_: function() {
    },
    computeClassSize_: function() {
      return this.log2_(this.blockSize);
    },
    computeOffsetSize_: function(classNumber) {
      return this.log2_(this.blockGenerator.binomial(
          this.blockSize, classNumber));
    },
    generatePopCountMap_: function() {
      return this.popCountMapGenerator.generatePopCountMap(
          this.blockSize, this.superBlockSize);
    },
    log2_: function(num) {
      var count = 0;
      while ( num ) {
        ++count;
        num >>>= 1;
      }
      return count;
    }
  }

  // TODO(markdittmer): Write tests.
});
