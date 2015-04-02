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
  name: 'BitVector',
  package: 'foam.dao.index',

  properties: [
    {
      model_: 'IntProperty',
      name: 'numBits',
      defaultValue: 64,
      postSet: function(old, nu) {
        if ( old === nu ) return;
        this.numBytes = Math.ceil(this.numBits / 8);
      }
    },
    {
      model_: 'IntProperty',
      name: 'numBytes',
      factory: function() {
        return Math.ceil(this.numBits / 8);
      },
      postSet: function(old, nu) {
        if ( old === nu ) return;
        this.rebuildBuffer_();
        this.rebuildView_();
      }
    },
    {
      name: 'buffer'
    },
    {
      model_: 'IntProperty',
      name: 'bufferByteOffset',
      defaultValue: 0
    },
    {
      name: 'view'
    }
  ],

  methods: [
    {
      name: 'init',
      code: function() {
        this.SUPER.apply(this, arguments);
        this.rebuildBuffer_();
        this.rebuildView_();
      }
    },
    {
      name: 'rebuildBuffer_',
      code: function() {
        this.buffer = new ArrayBuffer(this.numBytes);
      }
    },
    {
      name: 'rebuildView_',
      code: function() {
        this.view = new DataView(this.buffer, this.bufferByteOffset,
            this.numBytes);
      }
    },
    {
      name: 'readNumbers',
      code: function(startBit, endBit) {
        return this.readSized_(startBit, endBit, 32);
      }
    },
    {
      name: 'readString',
      code: function(startBit, endBit) {
        var charCodes = this.readSized_(startBit, endBit, 16);
        var out = '';
        for ( var i = 0; i < charCodes.length; ++i ) {
          out += String.fromCharCode(charCodes[i]);
        }
        return out;
      }
    },
    {
      name: 'readSized_',
      code: function(startBit, endBit, numChunkBits) {
        startBit = startBit >= 0 ? (startBit < this.numBits ? startBit :
            this.numBits - 1) : 0;
        endBit = endBit >= startBit ? (endBit < this.numBits ? endBit :
            this.numBits - 1) : startBit;
        var startByteOffset = Math.floor(startBit / 8),
            startBitOffset = startBit % 8,
            byteAlignedDiff = endBit - startByteOffset + 1,
            endByteOffset = Math.floor(byteAlignedDiff / 8),
            endBitOffset = byteAlignedDiff % numChunkBits,
            numChunks = Math.ceil(byteAlignedDiff / numChunkBits),
            chunkGetter = this.view['getUint' + numChunkBits].bind(this.view),
            byteGetter = this.view.getUint8.bind(this.view),
            numChunkBytes = Math.ceil(numChunkBits / 8),
            out = [];
        for ( var i = 0; i < numChunks; ++i ) {
          var basis = (chunkGetter(startByteOffset + (numChunkBytes * i))
              >>> startBitOffset);
          var carryIn = (i + 1 < numChunks) ? (startBitOffset ?
              (byteGetter(startByteOffset + (numChunkBytes * (i + 1)))
              << (32 - startBitOffset)) :
              0) : 0;
          out.push(basis | carryIn);
        }
        if ( endBitOffset ) {
          var mask = ((1 << endBitOffset) - 1);
          out[out.length - 1] &= mask;
        }
        return out;
      }
    }
  ],

  tests: [
    {
      model_: 'UnitTest',
      name: 'Full read',
      description: 'Read whole 32-bit number',
      code: multiline(function() {/*
        var bv = X.lookup('foam.dao.index.BitVector').create(),
            nums = bv.readNumbers(0, 63);
        this.assert(nums.length === 2, 'Default BitVector contains 64 bits');
        this.assert(nums[0]  === 0, 'Default lower read is 0');
        this.assert(nums[1]  === 0, 'Default upper read is 0');
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Drop MSB',
      description: 'Read everything except MSB',
      code: multiline(function() {/*
        var bv = X.lookup('foam.dao.index.BitVector').create();

        // TODO(markdittmer): Use a write interface when one is ready.
        bv.view.setUint32(0, 0x11111111 | 0);
        bv.view.setUint32(4, 0x88888888 | 0);

        var nums = bv.readNumbers(0, 62);
        this.assert(nums.length === 2, 'Default BitVector contains 64 bits');
        this.assert(nums[0]  === (0x11111111 | 0), 'Lower read should be ' +
            (0x11111111 | 0).toString(16) + ' and is ' + (nums[1] | 0).toString(16));
        this.assert(nums[1]  === (0x08888888 | 0), 'Upper read should be ' +
            (0x08888888 | 0).toString(16) + ' and is ' + (nums[1] | 0).toString(16));
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Drop LSB',
      description:
          'Read everything except LSB. Result is number shifted right by 1 bit',
      code: multiline(function() {/*
        var bv = X.lookup('foam.dao.index.BitVector').create();

        // TODO(markdittmer): Use a write interface when one is ready.
        bv.view.setUint32(0, 0x88888888 | 0);
        bv.view.setUint32(4, 0x11111111 | 0);

        var nums = bv.readNumbers(1, 63);
        this.assert(nums.length === 2, 'Default BitVector contains 64 bits');
        this.assert(nums[0]  === (0xc4444444 | 0), 'Lower read should be ' +
            (0xc4444444 | 0).toString(16) + ' and is ' + (nums[0] | 0).toString(16));
        this.assert(nums[1]  === (0x08888888 | 0), 'Upper read should be ' +
            (0x08888888 | 0).toString(16) + ' and is ' + (nums[1] | 0).toString(16));
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Read Odd Bits',
      description:
          'Read an odd number of bits in the middle.',
      code: multiline(function() {/*
        var bv = X.lookup('foam.dao.index.BitVector').create();

        // TODO(markdittmer): Use a write interface when one is ready.
        bv.view.setUint32(0, 0xFF000000 | 0);
        bv.view.setUint32(4, 0x00000006 | 0);

        var nums = bv.readNumbers(25, 33);
        this.assert(nums.length === 1, '9-bit read contains one number.');
        this.assert(nums[0]  === (0x000001CF | 0), 'Read should be ' +
            (0x000001CF | 0).toString(16) + ' and is ' + (nums[0] | 0).toString(16));
      */})
    }
  ]
});
