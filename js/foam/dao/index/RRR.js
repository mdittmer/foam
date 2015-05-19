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
    'foam.dao.index.BinarySearch',
    'foam.dao.index.BitVector',
    'foam.dao.index.BlockGenerator',
    'foam.dao.index.PopCountMapGenerator'
  ],
  imports: [
    'binarySearch',
    'blockGenerator',
    'console',
    'popCountMapGenerator'
  ],
  exports: [
    'binarySearch',
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
      name: 'binarySearch',
      type: 'foam.dao.index.BinarySearch',
      lazyFactory: function() {
        return this.BinarySearch.create();
      }
    },
    {
      model_: 'IntProperty',
      name: 'numBits',
      documentation: 'Number of bits in total.',
      units: 'bits'
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
      getter: function() {
        return this.popCountMapGenerator.generatePopCountMap(
            this.blockSize, this.superBlockSize);
      }
    },
    {
      type: 'foam.dao.index.BitVector',
      name: 'bitVector_'
    },
    {
      model_: 'ArrayProperty',
      name: 'superBlockOffsets_'
    },
    {
      model_: 'ArrayProperty',
      name: 'superBlockRanks_'
    }
  ],

  methods: {
    init: function() {
      this.SUPER.apply(this, arguments);
      Events.dynamic(function() {
        this.blockSize;
        this.superBlockSize;
        this.classSize = this.computeClassSize_();
      }.bind(this));
    },
    fromBitVector: function(bitVector) {
      var values = new Array(Math.ceil(bitVector.numBits / this.blockSize));
      var superBlockRanks = new Array(Math.ceil(bitVector.numBits /
          (this.blockSize * this.superBlockSize)));
      superBlockRanks[0] = 0;
      var rankCounter = 0;
      for ( var i = 0; (i * this.blockSize) < bitVector.numBits; ++i ) {
        // Read block and LSB-align it.
        var blockValue = bitVector.readNumbers(
            i * this.blockSize, this.blockSize)[0] >>>
            (32 - this.blockSize);
        var popCount = this.popCountMap_[blockValue].popCount;
        var offset = this.popCountMap_[blockValue].offset;
        // Store values as [class, offset] before compressing them into a
        // BitVector.
        values[i] = [popCount, offset];
        // Update rank counter, and store super block ranks at super block
        // boundaries.
        rankCounter += popCount;
        if ( (i + 1) % this.superBlockSize === 0 ) {
          var superBlockIdx = (i + 1) / this.superBlockSize;
          if ( superBlockIdx < superBlockRanks.length )
            superBlockRanks[superBlockIdx] = rankCounter;
        }
      }
      this.superBlockRanks_ = superBlockRanks;
      // Compress values to BitVectors and store it.
      var offsetSizes = this.computeOffsetSizes_(values);
      this.superBlockOffsets_ = this.computeSuperBlockOffsets_(offsetSizes);
      this.bitVector_ = this.constructBitVector_(values, offsetSizes);
      this.numBits = bitVector.numBits;
    },
    select0: function(idx) { return this.select_(0, idx); },
    select1: function(idx) { return this.select_(1, idx); },
    select_: function(bit, idx) {
      if ( idx <= 0 || idx > this.numBits ) return -1;

      this.binarySearch.data = this.superBlockRanks_;
      // Select comparator according to bit.
      this.binarySearch.comparator = bit !== 0 ?
          this.selectSuperBlockComparator1_ :
          this.selectSuperBlockComparator0_;
      var superBlockIdx = this.binarySearch.find(idx);

      var rank = bit !== 0 ?
          this.superBlockRank1_(superBlockIdx) :
          this.superBlockRank0_(superBlockIdx);
      var bvOffset = this.superBlockOffsets_[superBlockIdx];
      var blockCount = 0;
      while ( rank !== idx ) {
        // If we reach the end of the bitVector, then there is no idx'th bit.
        if ( bvOffset >= this.bitVector_.numBits ) return -1;

        var data = this.readBlock_(bvOffset);
        var popCount1 = data.popCount;
        // Adjust popCount according to bit.
        var popCount = bit !== 0 ? popCount1 :
            this.blockSize - popCount1;
        var offset = data.offset;
        bvOffset = data.bvOffset;

        // If this block doesn't contain desired bit, then continue to next
        // block.
        if ( rank + popCount < idx ) {
          rank += popCount;
          ++blockCount;
          continue;
        }

        // Lookup block value in block array.
        var blockValue = this.blockGenerator.generateBlocks(
            popCount1, this.blockSize)[offset];
        var popCounts = this.popCountMap_[blockValue].popCounts;

        // Binary search for appropriate bit in block.
        this.binarySearch.data = popCounts;
        // Select comparator according to bit.
        this.binarySearch.comparator = bit !== 0 ?
            this.selectBlockComparator1_ :
            this.selectBlockComparator0_;
        var blockBitIdx = this.binarySearch.find(idx - rank);
        // Adjust rank according to bit.
        var blockBitPopCount = bit !== 0 ? popCounts[blockBitIdx] :
            blockBitIdx + 1 - popCounts[blockBitIdx];
        rank += blockBitPopCount; //popCounts[blockBitIdx];

        // TODO(markdittmer): Remove assertion once we are confident that this
        // is always correct.
        this.console.assert(rank === idx, 'Block iteration should have taken' +
            'fast path, but did not');

        return (superBlockIdx * this.blockSize * this.superBlockSize) +
            (blockCount * this.blockSize) +
            blockBitIdx;
      }

      return (superBlockIdx * this.blockSize * this.superBlockSize) +
          (blockCount * this.blockSize);
    },
    rank0: function(idx) {
      return idx + 1 - this.rank1(idx);
    },
    rank1: function(idx) {
      if ( idx < 0 ) return 0;

      var ttlSuperBlockSize = this.blockSize * this.superBlockSize;
      var superBlockIdx = Math.min(Math.floor(idx / ttlSuperBlockSize),
                                   this.superBlockRanks_.length - 1);
      var rank = this.superBlockRanks_[superBlockIdx];
      var superBlockOffset = this.superBlockOffsets_[superBlockIdx];
      var bvOffset = superBlockOffset;
      var numBlockBits = (idx + 1) - (superBlockIdx * ttlSuperBlockSize);
      var numBlocks = Math.ceil(numBlockBits / this.blockSize);
      for ( var i = 0; i < numBlocks; ++i ) {
        var data = this.readBlock_(bvOffset);
        var popCount = data.popCount;
        var offset = data.offset;
        bvOffset = data.bvOffset;

        // Lookup block value in block array.
        var blockValue = this.blockGenerator.generateBlocks(
            popCount, this.blockSize)[offset];
        // Lookup total pop count in pop count map.
        var blockPopCounts = this.popCountMap_[blockValue].popCounts;
        // If bit index is somewhere within this block, then the last bit's
        // index is:
        // idx - ((superBlockIdx * ttlSuperBlockSize) + (i * this.blockSize)).
        // Otherwise, the above value is greater than this.blockSize - 1;
        // default to that value (which is the rank of the whole block).
        var blockIdx = Math.min(idx -
            ((superBlockIdx * ttlSuperBlockSize) +
            (i * this.blockSize)), this.blockSize - 1);
        var blockRank = blockPopCounts[blockIdx];

        rank += blockRank;
      }

      return rank;
    },
    bitValue: function(idx) {
      // Return of -1 signals bit idx is out of range.
      if ( idx < 0 || idx >= this.numBits ) return -1;

      var ttlSuperBlockSize = this.blockSize * this.superBlockSize;
      var superBlockIdx = Math.min(Math.floor(idx / ttlSuperBlockSize),
                                   this.superBlockRanks_.length - 1);
      var superBlockOffset = this.superBlockOffsets_[superBlockIdx];
      var bvOffset = superBlockOffset;
      var numBlockBits = (idx + 1) - (superBlockIdx * ttlSuperBlockSize);
      var numBlocks = Math.ceil(numBlockBits / this.blockSize);
      for ( var i = 0; i < numBlocks; ++i ) {
        var data = this.readBlock_(bvOffset);
        var popCount = data.popCount;
        var offset = data.offset;
        bvOffset = data.bvOffset;

        // Only need to do value lookup in last block.
        if ( i === numBlocks - 1 ) {
          // Lookup block value in block array.
          var blockValue = this.blockGenerator.generateBlocks(
              popCount, this.blockSize)[offset];
          var bitIdx = idx - ((superBlockIdx * ttlSuperBlockSize) +
              (i * this.blockSize));
          // TODO(markdittmer): Remove assertion once we are confident that this
          // is always correct.
          this.console.assert(bitIdx >= 0 && bitIdx < this.blockSize, 'Bit ' +
              'index out of range: Should be within [0, ' + this.blockSize +
              ') and is ' + bitIdx);
          return (blockValue >>> (this.blockSize - bitIdx - 1)) & 0x01;
        }
      }

      // Return of -1 signals bit idx is out of range.
      return -1;
    },
    readBlock_: function(bvOffset) {
      // Read class (popCount) and offset from bit vector.
      var popCount = this.bitVector_.readNumbers(
          bvOffset, this.classSize)[0] >>> (32 - this.classSize);
      bvOffset += this.classSize;
      var offsetSize = this.computeOffsetSize_(popCount);
      var offset = this.bitVector_.readNumbers(
          bvOffset, offsetSize)[0] >>> (32 - offsetSize);
      bvOffset += offsetSize;

      return { popCount: popCount, offset: offset, bvOffset: bvOffset };
    },
    invertBlockPopCounts_: function(popCounts) {
      return popCounts.map(function(pc, i) {
        return i + 1 - pc;
      }.bind(this));
    },
    computeOffsetSizes_: function(values) {
      var offsetSizes = new Array(values.length);
      for ( var i = 0; i < values.length; ++i ) {
        var popCount = values[i][0];
        offsetSizes[i] = this.computeOffsetSize_(popCount);
      }
      return offsetSizes;
    },
    computeSuperBlockOffsets_: function(offsetSizes) {
      // Every super block contains [size of class number] *
      // [blocks per super block] bits. It also contains a variable-length
      // offset computed later.
      var baseSize = this.classSize * this.superBlockSize;
      var numSuperBlocks = Math.ceil(offsetSizes.length / this.superBlockSize);
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
        var value = values[i];
        var popCount = value[0];
        var offset = value[1];
        // MSB-align class number before writing to bit vector.
        bitVector.writeNumbers(bitVectorOffset, this.classSize,
                               [popCount << (32 - this.classSize)]);
        bitVectorOffset += this.classSize;
        // MSB-align offset before writing to bit vector.
        bitVector.writeNumbers(bitVectorOffset, offsetSizes[i],
                               [offset << (32 - offsetSizes[i])]);
        bitVectorOffset += offsetSizes[i];
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
    log2_: function(num) {
      var count = 0;
      while ( num ) {
        ++count;
        num >>>= 1;
      }
      return count;
    }
  },

  listeners: [
    {
      name: 'superBlockRank0_',
      code: function(superBlockIdx) {
        return (superBlockIdx * this.blockSize * this.superBlockSize) -
            this.superBlockRank1_(superBlockIdx);
      }
    },
    {
      name: 'superBlockRank1_',
      code: function(superBlockIdx) {
        return this.superBlockRanks_[superBlockIdx];
      }
    },
    {
      name: 'selectSuperBlockComparator0_',
      code: function(midValue_, searchValue, i, data) {
        // midValue_ is number of 1s before ith super block. Compute number of 0s
        // before ith super block.
        var baseValue = i * this.blockSize * this.superBlockSize;
        var midValue = baseValue - midValue_;
        if ( midValue < searchValue && i === data.length - 1 ) return 0;
        // Same as midValue_ adjustment, but for value just past mid.
        var nextBaseValue = (i + 1) * this.blockSize * this.superBlockSize;
        var nextValue = nextBaseValue - data[i + 1];
        if ( midValue < searchValue && nextValue >= searchValue ) return 0;
        if ( midValue >= searchValue ) return 1;
        else                           return -1;
      }
    },
    {
      name: 'selectSuperBlockComparator1_',
      code: function(midValue, searchValue, i, data) {
        if ( midValue < searchValue && i === data.length - 1 ) return 0;
        if ( midValue < searchValue && data[i + 1] >= searchValue ) return 0;
        if ( midValue >= searchValue ) return 1;
        else                           return -1;
      }
    },
    {
      name: 'selectBlockComparator0_',
      code: function(midValue_, searchValue, i, data) {
        // midValue_ is number of 1s up to and including the ith bit in the block.
        // Compute number of 0s up to and including the ith bit in the block..
        var midValue = i + 1 - midValue_;
        if ( midValue === searchValue && i === 0 ) return 0;
        // Same as midValue_ adjustment, but for value just before mid.
        var prevValue = i - data[i - 1];
        if ( midValue === searchValue && prevValue < searchValue ) return 0;
        if ( midValue >= searchValue ) return 1;
        else                           return -1;
      }
    },
    {
      name: 'selectBlockComparator1_',
      code: function(midValue, searchValue, i, data) {
        if ( midValue === searchValue &&
            (i === 0 || data[i - 1] < searchValue) ) return 0;
        if ( midValue >= searchValue ) return 1;
        else                           return -1;
      }
    }
  ],

  tests: [
    {
      model_: 'UnitTest',
      name: 'Single 5-bit block',
      description: 'Check behaviour for single 5-bit block RRR',
      code: function() {
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 5 });
        // Write five MSB-aligned bits: 00101.
        bv.writeNumbers(0, 5, [0x05 << (32 - 5)]);

        var rrr = X.lookup('foam.dao.index.RRR').create({ blockSize: 5, superBlockSize: 1 });
        this.assert(rrr.classSize === 3, 'Expected popCount of five-bit block to ' +
            'fit into exactly 3 bits');
        rrr.fromBitVector(bv);

        // Class (i.e., popCount): 2 (binary: 010).
        // Values in class: 00011 00101 00110 01001 01010 01100 10001 10010
        //                  10100 11000.
        // Number of values in class: 10 (offsets 0 - 9).
        // Number of bits to store offset: 4 (0000 - 1001).
        // Value (00101) Offset: 1 (binary: 0001).
        // 7-bit RRR value = class, offset = 010 0001.

        // TODO(markdittmer): This tests implementation details; shouldn't be
        // doing that in a unit test.
        var expectedValue = 33;
        // LSB-align 7-bit RRR value.
        var rrrBitVectorValue = rrr.bitVector_.readNumbers(0, 7)[0] >>>
            (32 - 7);
        this.assert(expectedValue === rrrBitVectorValue, 'Expected RRR value ' +
            'of ' + expectedValue + ' and is ' + rrrBitVectorValue);

        var expected = [0, 0, 1, 1, 2];
        for ( var i = 0; i < expected.length; ++i ) {
          var rank = rrr.rank1(i);
          this.assert(rank === expected[i], 'Expected rank1(' + i + ') to be ' +
              expected[i] + ' and is ' + rank);
        }
      }
    },
    {
      model_: 'UnitTest',
      name: 'Oversized rank index',
      description: 'Check behaviour for passing an index to rank that is ' +
          'larger than the bit vector',
      code: function() {
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 5 });
        // Write five MSB-aligned bits: 00101.
        bv.writeNumbers(0, 5, [0x05 << (32 - 5)]);

        var rrr = X.lookup('foam.dao.index.RRR').create({ blockSize: 5, superBlockSize: 1 });
        rrr.fromBitVector(bv);

        // Rank of index passed end of bits is total rank; in this case, 2.
        var rank = rrr.rank1(1000);
        this.assert(rank === 2, 'Expected rank1(1000) to be 2 and is ' + rank);
      }
    },
    {
      model_: 'UnitTest',
      name: 'Undersized rank index',
      description: 'Check behaviour for  passing an index to rank that is ' +
          'less than 0',
      code: function() {
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 5 });
        // Write five MSB-aligned bits: 00101.
        bv.writeNumbers(0, 5, [0x05 << (32 - 5)]);

        var rrr = X.lookup('foam.dao.index.RRR').create({ blockSize: 5, superBlockSize: 1 });
        rrr.fromBitVector(bv);

        // Rank of index less than 0 is always 0.
        var rank = rrr.rank1(-1);
        this.assert(rank === 0, 'Expected rank1(-1) to be 2 and is ' + rank);
      }
    },
    {
      model_: 'UnitTest',
      name: 'Empty bit vector',
      description: 'Test rank of nothing',
      code: function() {
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 0 });

        var rrr = X.lookup('foam.dao.index.RRR').create({ blockSize: 5, superBlockSize: 1 });
        rrr.fromBitVector(bv);

        // Rank should always be 0.
        var rank = rrr.rank1(-1);
        this.assert(rank === 0, 'Expected rank1(-1) to be 0 and is ' + rank);
        rank = rrr.rank1(0);
        this.assert(rank === 0, 'Expected rank1(0) to be 0 and is ' + rank);
        rank = rrr.rank1(1000);
        this.assert(rank === 0, 'Expected rank1(1000) to be 0 and is ' + rank);
      }
    },
    {
      model_: 'UnitTest',
      name: 'Multiple blocks',
      description: 'Test data across multiple blocks',
      code: function() {
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 10 });

        var rrr = X.lookup('foam.dao.index.RRR').create({ blockSize: 5, superBlockSize: 2 });
        // Write ten MSB-aligned bits: 00101 01000.
        bv.writeNumbers(0, 10, [(0x05 << (32 - 5)) | (0x08 << (32 - 10))]);
        rrr.fromBitVector(bv);

        var expected = [0, 0, 1, 1, 2, 2, 3, 3, 3, 3];
        for ( var i = 0; i < expected.length; ++i ) {
          var rank = rrr.rank1(i);
          this.assert(rank === expected[i], 'Expected rank1(' + i + ') to be ' +
              expected[i] + ' and is ' + rank);
        }
      }
    },
    {
      model_: 'UnitTest',
      name: 'Multiple super blocks',
      description: 'Test data across multiple super blocks',
      code: function() {
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 10 });

        var rrr = X.lookup('foam.dao.index.RRR').create({ blockSize: 5, superBlockSize: 1 });
        // Write ten MSB-aligned bits: 00101 10000.
        bv.writeNumbers(0, 10, [(0x05 << (32 - 5)) | (0x10 << (32 - 10))]);
        rrr.fromBitVector(bv);

        var expected = [0, 0, 1, 1, 2, 3, 3, 3, 3, 3];
        for ( var i = 0; i < expected.length; ++i ) {
          var rank = rrr.rank1(i);
          this.assert(rank === expected[i], 'Expected rank1(' + i + ') to be ' +
              expected[i] + ' and is ' + rank);
        }
      }
    },
    {
      model_: 'UnitTest',
      name: 'Bit value',
      description: 'Test bitValue(idx) interface',
      code: function() {
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 10 });

        var rrr = X.lookup('foam.dao.index.RRR').create({ blockSize: 5, superBlockSize: 1 });
        // Write ten MSB-aligned bits: 00101 10000.
        bv.writeNumbers(0, 10, [(0x05 << (32 - 5)) | (0x10 << (32 - 10))]);
        rrr.fromBitVector(bv);

        var expected = [0, 0, 1, 0, 1, 1, 0, 0, 0, 0];
        for ( var i = 0; i < expected.length; ++i ) {
          var bitValue = rrr.bitValue(i);
          this.assert(bitValue === expected[i], 'Expected bitValue(' + i +
              ') to be ' + expected[i] + ' and is ' + bitValue);
        }
      }
    },
    {
      model_: 'UnitTest',
      name: 'Select1',
      description: 'Test select1(idx) interface',
      code: function() {
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 10 });

        var rrr = X.lookup('foam.dao.index.RRR').create({ blockSize: 5, superBlockSize: 1 });
        // Write ten MSB-aligned bits: 00101 10101.
        bv.writeNumbers(0, 10, [(0x05 << (32 - 5)) | (0x15 << (32 - 10))]);
        rrr.fromBitVector(bv);

        var select;
        select = rrr.select1(-1);
        this.assert(select === -1, 'Expected select1(-1) to be -1 and is ' +
            select);
        select = rrr.select1(0);
        this.assert(select === -1, 'Expected select1(0) to be -1 and is ' +
            select);
        select = rrr.select1(1);
        this.assert(select === 2, 'Expected select1(1) to be 2 and is ' +
            select);
        select = rrr.select1(2);
        this.assert(select === 4, 'Expected select1(2) to be 4 and is ' +
            select);
        select = rrr.select1(3);
        this.assert(select === 5, 'Expected select1(3) to be 5 and is ' +
            select);
        select = rrr.select1(4);
        this.assert(select === 7, 'Expected select1(4) to be 7 and is ' +
            select);
        select = rrr.select1(5);
        this.assert(select === 9, 'Expected select1(5) to be 9 and is ' +
            select);
        select = rrr.select1(6);
        this.assert(select === -1, 'Expected select1(6) to be -1 and is ' +
            select);
      }
    },
    {
      model_: 'UnitTest',
      name: 'Select0',
      description: 'Test select0(idx) interface',
      code: function() {
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 10 });

        var rrr = X.lookup('foam.dao.index.RRR').create({ blockSize: 5, superBlockSize: 1 });
        // Write ten MSB-aligned bits: 00101 10101.
        bv.writeNumbers(0, 10, [(0x05 << (32 - 5)) | (0x15 << (32 - 10))]);
        rrr.fromBitVector(bv);

        var select;
        select = rrr.select0(-1);
        this.assert(select === -1, 'Expected select0(-1) to be -1 and is ' +
            select);
        select = rrr.select0(0);
        this.assert(select === -1, 'Expected select0(0) to be -1 and is ' +
            select);
        select = rrr.select0(1);
        this.assert(select === 0, 'Expected select0(1) to be 2 and is ' +
            select);
        select = rrr.select0(2);
        this.assert(select === 1, 'Expected select0(2) to be 4 and is ' +
            select);
        select = rrr.select0(3);
        this.assert(select === 3, 'Expected select0(3) to be 5 and is ' +
            select);
        select = rrr.select0(4);
        this.assert(select === 6, 'Expected select0(4) to be 7 and is ' +
            select);
        select = rrr.select0(5);
        this.assert(select === 8, 'Expected select0(5) to be 9 and is ' +
            select);
        select = rrr.select0(6);
        this.assert(select === -1, 'Expected select0(6) to be -1 and is ' +
            select);
      }
    }
  ]
});
