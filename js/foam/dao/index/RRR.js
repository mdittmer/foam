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
        var popCount = this.popCountMap_[blockValue].popCount;
        var offset = this.popCountMap_[blockValue].offset;
        // Store values as [class, offset] before compressing them into a
        // BitVector.
        values.push([popCount, offset]);
      }
      // Compress values to BitVectors and store it.
      var offsetSizes = this.computeOffsetSizes_(values);
      this.superBlockOffsets_ = this.computeSuperBlockOffsets_(offsetSizes);
      this.bitVector_ = this.constructBitVector_(values, offsetSizes);
    },
    computeOffsetSizes_: function(values) {
      var offsetSizes = new Array(values.length);
      for ( var i = 0; i < values.length; ++i ) {
        var popCount = values[0];
        offsetSizes[i] = popCount;
      }
      return offsetSizes;
    },
    computeSuperBlockOffsets_: function(offsetSizes) {
      // Every super block contains [size of class number] *
      // [blocks per super block] bits. It also contains a variable-length
      // offset computed later.
      var baseSize = this.classSize * this.superBlockSize;
      var numSuperBlocks = Math.floor(offsetSizes.length / this.superBlockSize);
      var counter = 0;
      var superBlockOffsets = new Array(numSuperBlocks);
      superBlockOffsets[0] = 0;
      for ( var i = 1; i < numSuperBlocks; ++i ) {
        // Sum the number of bits of all variable-sized offets in the previous
        // super block.
        var start = this.superBlockSize * (i - 1);
        var end = start + this.superBlockSize;
        var variableSize = offsetSizes.slice(start, end).reduce(
                function(acc, size) {
                  return acc + size;
                }, 0);
        // Store the number of bits prior to the start of the ith super block.
        superBlockOffsets[i] = counter + baseSize + variableSize;
        counter += baseSize + variableSize;
      }

      return superBlockOffsets;
    },
    constructBitVector_: function(values, offsetSizes) {
      // Bit vector size is the size, in bits, of all class values + all
      // variable-sized offsets.
      var bitVectorSize = this.classSize * values.length +
          offsetSizes.reduce(function(acc, size) {
            return acc + size;
          }, 0);
      // Construct bit vector from [popCount, offset] values.
      var bitVector = this.BitVector.create({ numBits: bitVectorSize });
      var bitVectorOffset = 0;
      for ( var i = 0; i < values.length; ++i ) {
        var popCount = values[0];
        var offset = values[1];
        // MSB-align class number before writing to bit vector.
        bitVector.writeNumbers(bitVectorOffset, this.classSize,
                               [popCount << (32 - this.classSize)]);
        bitVectorOffset += this.classSize;
        // MSB-align offset before writing to bit vector.
        bitVector.writeNumbers(bitVectorOffset, offsetSizes[i],
                               [offset << (32 - offsetSizes[i])]);
      }

      return bitVector;
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
