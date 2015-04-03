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
      name: 'writeNumbers',
      code: function(startBit, endBit, values) {
        return this.doSized_(startBit, endBit, 32, values);
      }
    },
    {
      name: 'writeString',
      code: function(startBit, endBit, str) {
        var values = []
        for ( var i = 0; i < str.length; ++i ) {
          values.push(str.charCodeAt(i));
        }
        return this.doSized_(startBit, endBit, 16, values);
      }
    },
    {
      name: 'readNumbers',
      code: function(startBit, endBit) {
        return this.doSized_(startBit, endBit, 32);
      }
    },
    {
      name: 'readString',
      code: function(startBit, endBit) {
        var charCodes = this.doSized_(startBit, endBit, 16);
        var out = '';
        for ( var i = 0; i < charCodes.length; ++i ) {
          out += String.fromCharCode(charCodes[i]);
        }
        return out;
      }
    },
    {
      name: 'doSized_',
      code: function(startBit, numBits, numChunkBits, opt_values) {
        var out = opt_values || [];
        var i;

        // TODO(markdittmer): Break implementations below out so that:
        // (1) They are readable (use ifs and running-value).
        // (2) Split read and write into separate functions.
        // (3) After coding up and testing hard case, implement fastpath with
        //     fewer branches when read or write is chunk-aligned.

        if ( opt_values ) {
          // Write.
          for ( i = 0; i < Math.ceil(numBits / numChunkBits); ++i ) {
            // 1. On first iteration, if there are MSBs that should be kept from
            // the current byte due to the byte-aligned startBit offset
            // (startBit % 8), then get those bits from the view.
            this.view['setUint' + numChunkBits](
                Math.floor(startBit / 8) + (i * (numChunkBits / 8)),
                (((i === 0) && (startBit % 8)) ?
                (this.view.getUint8(Math.floor(startBit / 8)) >>>
                (numChunkBits - (startBit % 8)) <<
                (numChunkBits - (startBit % 8))) : 0) |
                // Above: Clear bits by shift-then-shift-back.
                // Below: Clear bits by masking.
                // & (((1 << (startBit % 8)) - 1) >>>
                // (numChunkBits - (startBit % 8)))) : 0) |
                // 2. On the last iteration, if there are LSBs that should be
                // kept from the current chunk due to the chunk-aligned
                // last-bit-location (number of such bits is:
                // numChunkBits - ((startBit + numBits) % numChunkBits)), then get those bits
                // from the view.
                ((((i + 1) >= Math.ceil(numBits / numChunkBits)) &&
                ((startBit + numBits) % numChunkBits)) ?
                (this.view['getUint' + numChunkBits](Math.floor(startBit / 8) + (i * (numChunkBits / 8))) <<
                ((startBit + numBits) % numChunkBits) >>>
                ((startBit + numBits) % numChunkBits)) : 0) |
                // Above: Clear bits by shift-then-shift-back.
                // Below: Clear bits by masking.
                // & ((1 << ((startBit + numBits) % numChunkBits)) - 1)) : 0) |
                // 3. Value to write (part 1): opt_values[i] shifted
                // byte-aligned startBit offset (startBit % 8). On the last
                // iteration, if there are LSBs that should be kept from the
                // current chunk, then be sure to zero-out those bits in the
                // value being written here.
                ((((i + 1) >= Math.ceil(numBits / numChunkBits)) &&
                ((startBit + numBits) % numChunkBits)) ?
                (opt_values[i] >>> (startBit % 8) >>>
                (numChunkBits - ((startBit + numBits) % numChunkBits)) <<
                (numChunkBits - ((startBit + numBits) % numChunkBits))) :
                // Above: Clear bits by shift-then-shift-back.
                // Not shown: Clear bits by masking.
                (opt_values[i] >>> (startBit % 8))) |
                // 3. Value to write (part 2): if this isn't the first chunk
                // and chunks aren't byte-aligned, then carry in
                // numChunkBits - (startBit % 8) bits from previous chunk. On
                // the last iteration, if there are LSBs that should be kept
                // from the current chunk, then be sure to zero-out those bits
                // in the value being written here.
                (((i > 0) && (startBit % 8)) ?
                ((((i + 1) >= Math.ceil(numBits / numChunkBits)) &&
                ((startBit + numBits) % numChunkBits)) ?
                ((opt_values[i - 1] << (numChunkBits - (startBit % 8))) >>>
                (numChunkBits - ((startBit + numBits) % numChunkBits)) <<
                (numChunkBits - ((startBit + numBits) % numChunkBits))) :
                (opt_values[i - 1] << (numChunkBits - (startBit % 8)))) : 0));
          }
        } else {
          // Read.
          for ( i = 0; i < Math.ceil(numBits / numChunkBits); ++i ) {
            // NOTE: This implementation will pad at the LSB end. E.g., read two
            // bytes, 0xABCD into a four-byte location will yield 0xABCD0000.
            out.push(
                // 1. Read the current chunk, shifting off (startBit % 8) MSBs.
                // If this is the last chunk and we are not keeping all of its
                // bits, then be sure to drop the LSBs that are to be ignored.
                ((((i + 1) >= Math.ceil(numBits / numChunkBits)) &&
                ((startBit + numBits) % numChunkBits)) ?
                ((this.view['getUint' + numChunkBits](
                    Math.floor(startBit / 8) + (i * (numChunkBits / 8))) << (startBit % 8)) >>>
                (numChunkBits - ((startBit + numBits) % numChunkBits)) <<
                (numChunkBits - ((startBit + numBits) % numChunkBits))) :
                // Above: Clear bits by shift-then-shift-back.
                // Not shown: Clear bits by masking.
                (this.view['getUint' + numChunkBits](
                    Math.floor(startBit / 8) + (i * (numChunkBits / 8))) << (startBit % 8))) |
                // 2. If there is a carry-in, then carry it in. As above, drop
                // that don't fit into the requested range of bits.
                (((startBit % 8) &&
                ((Math.floor(startBit / 8) + ((i + 1) * (numChunkBits / 8))) < this.numBytes)) ?
                ((((i + 1) >= Math.ceil(numBits / numChunkBits)) &&
                ((startBit + numBits) % numChunkBits)) ?
                ((this.view.getUint8(Math.floor(startBit / 8) + ((i + 1) * (numChunkBits / 8))) >>> (startBit % 8)) >>>
                (numChunkBits - ((startBit + numBits) % numChunkBits)) <<
                (numChunkBits - ((startBit + numBits) % numChunkBits))) :
                // Above: Clear bits by shift-then-shift-back.
                // Not shown: Clear bits by masking.
                (this.view.getUint8(Math.floor(startBit / 8) + ((i + 1) * (numChunkBits / 8))) >>> (startBit % 8))) : 0));
          }
        }
      }
    },
    {
      name: 'doSized_old_',
      code: function(startBit, endBit, numChunkBits, opt_values) {
        startBit = startBit >= 0 ? (startBit < this.numBits ? startBit :
            this.numBits - 1) : 0;
        endBit = endBit >= startBit ? (endBit < this.numBits ? endBit :
            this.numBits - 1) : startBit;

        // Calculations required for both read and write.
        var lastByte = this.numBytes - 1,
            // startBit is in startByte byte.
            startByte = Math.floor(startBit / 8),
            // startBit is in view[startByteOffset] (byte-indexed view).
            startByteOffset = lastByte - startByte,
            // startBit is startBitShift-th least significant bit in
            // view[startByteOffset] (byte-indexed view).
            startBitShift =  startBit % 8,
            // endBit is in endByte byte.
            endByte = Math.floor(endBit / 8),
            // endBit is in view[endByteOffset] (byte-indexed view).
            endByteOffset = lastByte - endByte,
            // When we ignore bytes less significant than startByte, endBit is
            // at bit index byteAlignedEndBit.
            clippedEndBit = endBit - (startByte * 8),
            // We need numChunks chunks to store the output.
            numChunks = Math.ceil((clippedEndBit + 1) / numChunkBits),
            // numChunkBytes bytes are required to store a chunk.
            numChunkBytes = Math.ceil(numChunkBits / 8),
            // endBit is endBitShift-th least significant bit in
            // view[endByteOffset] (byte-indexed view).
            endBitShift = (clippedEndBit + 1) % numChunkBits,
            chunkGetter = this.view['getUint' + numChunkBits].bind(this.view),
            byteGetter = this.view.getUint8.bind(this.view),
            out = opt_values || [];

        var i, basisChunkIdx;
        if ( opt_values) {
          // Write.
          var chunkSetter = this.view['setUint' + numChunkBits].bind(this.view);

          for ( i = 0; i < numChunks; ++i ) {
            basisChunkIdx = startByte + (numChunkBytes * i);

            var keepMask = 0, carryMask = 0;
            if ( startBitShift ) {
              if ( i !== 0 ) carryMask = ((1 << startBitShift) - 1);
              else           keepMask |= ((1 << startBitShift) - 1);
            }
            if ( endBitShift && (i + 1) >= numChunks )
              keepMask |= ~((1 << endBitShift) - 1);
            var newMask = ~keepMask;
            var keepBasis = chunkGetter(basisChunkIdx) & keepMask;
            var newBasis = (opt_values[i] << startBitShift) & newMask;
            var carryBasis = (i > 0) ?
                opt_values[i - 1] >>> (numChunkBits - startBitShift) &
                carryMask : 0;
            var newValue = keepBasis | newBasis | carryBasis;

            chunkSetter(basisChunkIdx, newValue);
          }
        } else {
          // Read.
          for ( i = 0; i < numChunks; ++i ) {
            basisChunkIdx = startByte + (numChunkBytes * i);

            var basis = chunkGetter(basisChunkIdx) >>> startBitShift;
            var carryInByteIdx = startByteOffset - (numChunkBytes * (i + 1));
            var carryIn = ((i + 1) < numChunks) ? (startBitShift ?
                (byteGetter(carryInByteIdx) << (32 - startBitShift)) :
                0) : 0;
            var value = basis | carryIn;
            out.push(value);
          }
          if ( endBitShift ) {
            var mask = ((1 << endBitShift) - 1);
            out[out.length - 1] &= mask;
          }
        }
        return out;
      }
    }
  ],

  tests: [
    {
      model_: 'UnitTest',
      name: 'Full write',
      description: 'Write whole 64-bit vector',
      code: multiline(function() {/*
        var bv = X.lookup('foam.dao.index.BitVector').create();
        var numsIn = [0x0ABCDEF0 | 0, 0x12345678 | 0];
        bv.writeNumbers(0, 63, numsIn);
        var numsOut = bv.readNumbers(0, 63);
        for ( var i = 0; i < numsOut.length; ++i ) {
          this.assert(numsIn[i] === numsOut[i], 'Number should be ' +
              numsIn[i].toString(16) + ' and is ' + numsOut[i].toString(16));
        }
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Write accross chunks',
      description: 'Write whole middle 32-bits of 64-bit vector',
      code: multiline(function() {/*
        var bv = X.lookup('foam.dao.index.BitVector').create();
        // var numsIn = [0x9ABCDEF9 | 0];
        debugger;
        bv.writeNumbers(30, , [0x03 | 0]);
        var numsOut = bv.readNumbers(0, 63);
        this.assert(numsOut[0] === (numsIn[0] << 16));
        this.assert(numsOut[1] === (numsIn[0] >>> 16));
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Full read',
      description: 'Read whole 64-bit vector',
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
