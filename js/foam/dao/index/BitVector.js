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

  imports: [ 'console' ],

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
      code: function(startBit, bitLength, values) {
        this.console.assert(bitLength <=  values.length * 32, 'Number values ' +
            'passed to BitVector.writeNumbers (containing ' +
            (values.length * 32) + ' bits) do not contain enough bits for ' +
            bitLength + '-bit write');
        return this.write_(startBit, bitLength, 32, values);
      }
    },
    {
      name: 'writeString',
      code: function(startBit, bitLength, str) {
        var values = [], strLength = Math.ceil(bitLength / 16);
        this.console.assert(strLength <= str.length, 'String passed to ' +
            'BitVector.writeString is too short (length ' + str.length +
            ') for bitlength: ' + bitLength + '(implies ' + strLength +
            ' 16-bit characters)');
        for ( var i = 0; i < strLength; ++i ) {
          values.push(str.charCodeAt(i));
        }
        return this.write_(startBit, bitLength, 16, values);
      }
    },
    {
      name: 'readNumbers',
      code: function(startBit, bitLength) {
        return this.read_(startBit, bitLength, 32);
      }
    },
    {
      name: 'readString',
      code: function(startBit, bitLength) {
        var charCodes = this.read_(startBit, bitLength, 16);
        var out = '';
        for ( var i = 0; i < charCodes.length; ++i ) {
          out += String.fromCharCode(charCodes[i]);
        }
        return out;
      }
    },
    {
      name: 'modInv',
      code: function(num, mod) {
        return (mod - num) % mod;
      }
    },
    {
      name: 'maskKeepLSBs',
      code: function(numBits) {
        if ( numBits === 32 ) return (0xFFFFFFFF | 0);
        return (1 << numBits) - 1;
      }
    },
    {
      name: 'maskKeepMSBs',
      code: function(numBits) {
        if ( numBits === 32 ) return (0xFFFFFFFF | 0);
        return this.maskKeepLSBs(numBits) << this.modInv(numBits, 32);
      }
    },
    {
      name: 'maskNotLSBs',
      code: function(numBits) {
        if ( numBits === 0 ) return (0xFFFFFFFF | 0);
        return this.maskKeepMSBs(this.modInv(numBits, 32));
      }
    },
    {
      name: 'maskNotMSBs',
      code: function(numBits) {
        if ( numBits === 0 ) return (0xFFFFFFFF | 0);
        return this.maskKeepLSBs(this.modInv(numBits, 32));
      }
    },
    {
      name: 'write_',
      code: function(startBit, numBits, numChunkBits, values) {
        var startBitOffset = startBit % numChunkBits,
            invStartBitOffset = this.modInv(startBitOffset, numChunkBits),
            invNumChunkBits = this.modInv(numChunkBits, 32),
            numChunkBytes = numChunkBits / 8,
            numChunks = Math.ceil((startBitOffset + numBits) / numChunkBits),
            startByte = Math.floor(startBit / 8);
        for ( var i = 0; i < numChunks; ++i ) {
          var value = 0,

          // 0. Compute meta-mask to avoid overwriting bits beyond the end of
          // the write length.
          numOverwriteBits = ((i + 1) * numChunkBits) - startBitOffset -
              numBits,
          dropLSBsMask = (numOverwriteBits > 0) ?
              this.maskNotLSBs(numOverwriteBits) : this.maskNotLSBs(0);

          // 1. Carry-in and/or existing MSBs.
          // TODO(markdittmer): This is only computed unconditionally for
          // debugging purposes. Move it into if-statement below once all tests
          // are passing.
          var carryKeepMask = (startBitOffset > 0) ?
              (this.maskNotLSBs(numChunkBits - startBitOffset, 32) &
              this.maskNotMSBs(32  - numChunkBits, 32)) : 0,
          maskedCarryKeepMask = carryKeepMask & dropLSBsMask;
          if ( startBitOffset > 0 ) {
            if ( i > 0 ) {
              var carry = (values[i - 1] << invStartBitOffset) &
                  maskedCarryKeepMask;
              value |= carry;
            } else {
              var keep = this.getChunk_(numChunkBits, i * numChunkBytes) &
                  maskedCarryKeepMask;
              value |= keep;
            }
          }

          // 2. Data to write (almost; see 3.).
          var dataMask = this.maskNotMSBs(32 - numChunkBits + startBitOffset),
          maskedDataMask = dataMask & dropLSBsMask;
          value |= (values[i] >>> startBitOffset) & maskedDataMask;

          // 3. Chunk part beyond intended write location. If there are bits in
          // this chunk beyond the intended write location, write them back.
          // TODO(markdittmer): This is only computed unconditionally for
          // debugging purposes. Move it into if-statement below once all tests
          // are passing.
          var keepLSBsMask = numOverwriteBits > 0 ?
              this.maskKeepLSBs(numOverwriteBits) : 0;
          if ( numOverwriteBits > 0 ) {
            var keepLSBs = this.getChunk_(numChunkBits, startByte +
                (i * numChunkBytes)) & keepLSBsMask;
            value |= keepLSBs;
          }

          // TODO(markdittmer): This is for debugging purposes. Remove once all
          // tests are passing.
          var fullMask = maskedCarryKeepMask ^ maskedDataMask ^ keepLSBsMask;
          this.console.assert(fullMask === (((1 << numChunkBits) - 1) || (0xFFFFFFFF | 0)), 'Write masks ' +
              'fail to account for every bit exactly once. Masks XOR\'d is ' +
              fullMask.toString(16));

          this.putChunk_(numChunkBits, startByte + (i * numChunkBytes), value);
        }
      }
    },
    {
      name: 'read2_',
      code: function(startBit, numBits, numChunkBits) {
      }
    },
    {
      name: 'write_old_',
      code: function(startBit, numBits, numChunkBits, values) {
        var startByte = Math.floor(startBit / 8),
            startBitOffset = startBit % 8,
            numChunks = Math.ceil((startBit + numBits) / numChunkBits),
            // TODO(markdittmer): Used in two contexts (name currently matches
            // first). Rename?
            firstChunkShift = (numChunkBits - startBitOffset) % numChunkBits,
            firstByteShift = (8 - startBitOffset) % 8,
            firstByteAlign = numChunkBits - 8,
            // TODO(markdittmer): Used in two contexts (name currently matches
            // first). Rename?
            keepLastChunkShift = (startBitOffset + numBits) % numChunkBits,
            dropLastChunkShift = (numChunkBits - keepLastChunkShift) %
                numChunkBits;

        for ( var i = 0; i < numChunks; ++i ) {
          var value = 0,
          byteOffset = i * (numChunkBits / 8),
          writeIdx = startByte + byteOffset,
          baseValue = values[i] >>> startBitOffset,
          // TODO(markdittmer): This shouldn't be calculated for i = 0.
          carryClipShift = 32 - numChunkBits,
          carryValue = values[i - 1] << firstChunkShift <<
              carryClipShift >>> carryClipShift,

          // Predicates for potential bit-OR'ing steps.
          keepFirstChunkBits = (i === 0) && (startBitOffset !== 0),
          isLastChunk = (i + 1) >= Math.ceil((startBit + numBits) / numChunkBits),
          latterChunkWithShift = (i > 0) && (startBitOffset !== 0),
          extraLastChunkBits = isLastChunk && (keepLastChunkShift !== 0),
          lastChunkWithShift = isLastChunk && (keepLastChunkShift !== 0);

          // 1. On first iteration, if there are MSBs that should be kept from
          // the current byte due to the byte-aligned startBit offset
          // (startBit % 8), then get those bits from the view.
          if ( keepFirstChunkBits ) {
            // Shift then shift back to zero-out unwanted bits.
            value |= this.view.getUint8(startByte) >>> firstByteShift <<
                firstByteShift << firstByteAlign;
         }

          // 2. On the last iteration, if there are LSBs that should be
          // kept from the current chunk due to the chunk-aligned
          // last-bit-location (number of such bits is:
          // numChunkBits - keepLastChunkShift), then get those bits
          // from the view.
          if ( extraLastChunkBits ) {
            // Shift then shift back to zero-out unwanted bits.
            value |= this.getChunk_(32, startByte + byteOffset) <<
                keepLastChunkShift >>> keepLastChunkShift;
          }

          // 3. Value to write (part 1): opt_values[i] shifted
          // byte-aligned startBit offset (startBit % 8). On the last
          // iteration, if there are LSBs that should be kept from the
          // current chunk, then be sure to zero-out those bits in the
          // value being written here.
          if ( extraLastChunkBits ) {
            // Shift then shift back to zero-out unwanted bits.
            value |= baseValue >>> dropLastChunkShift <<
                dropLastChunkShift;
          } else {
            value |= baseValue;
          }

          // 4. Value to write (part 2): if this isn't the first chunk
          // and chunks aren't byte-aligned, then carry in
          // numChunkBits - (startBit % 8) bits from previous chunk. On
          // the last iteration, if there are LSBs that should be kept
          // from the current chunk, then be sure to zero-out those bits
          // in the value being written here.
          if ( latterChunkWithShift ) {
            if ( lastChunkWithShift ) {
              value |= carryValue >>> dropLastChunkShift <<
                  dropLastChunkShift;
            } else {
              value |= carryValue;
            }
          }

          this.putChunk_(numChunkBits, writeIdx, value);
        }
      }
    },
    {
      name: 'read_',
      code: function(startBit, numBits, numChunkBits) {
        // NOTE: This implementation will pad at the LSB end. E.g., read two
        // bytes, 0xABCD into a four-byte location will yield 0xABCD0000.
        var out = [],
            startByte = Math.floor(startBit / 8),
            startBitOffset = startBit % 8,
            numChunkBytes = numChunkBits / 8,
            numChunks = Math.ceil(numBits / numChunkBits),
            // TODO(markdittmer): Name copied from write_. Rename?
            keepLastChunkShift = (startBit + numBits) % numChunkBits;

        for ( var i = 0; i < numChunks; ++i ) {
          var value = 0,
          byteOffset = i * numChunkBytes,
          endByteOffset = (i + 1) * numChunkBytes,
          lastChunkShift = numChunkBits - keepLastChunkShift,
          baseValue = this.getChunk_(numChunkBits, startByte + byteOffset) <<
              startBitOffset,

          // Predicates for potential bit-OR'ing steps.
          isLastChunk = (i + 1) >= Math.ceil(numBits / numChunkBits),
          hasBytePastChunk = (startByte + endByteOffset) < this.numBytes;

          // 1. Read the current chunk, shifting off (startBit % 8) MSBs.
          // If this is the last chunk and we are not keeping all of its
          // bits, then be sure to drop the LSBs that are to be ignored.
          if ( isLastChunk && keepLastChunkShift !== 0 ) {
            value |= baseValue >>> keepLastChunkShift << keepLastChunkShift;
          } else {
            value |= baseValue;
          }

          // 2. If there is a carry-in, then carry it in.

          // TODO(markdittmer): Is the action below necessary?
          // As above, drop
          // that don't fit into the requested range of bits.
          if ( startBitOffset !== 0 && hasBytePastChunk ) {
            var carryValue = this.view.getUint8(startByte + endByteOffset) >>>
                ((8 - startBitOffset) % 8);
            value |= carryValue;
            // var carryValue = this.view.getUint8(startByte + endByteOffset) >>>
            //     startBitOffset;
            // // TODO(markdittmer): This is not shifting the correct distance.
            // if ( isLastChunk && keepLastChunkShift ) {
            //   value |= carryValue >>> lastChunkShift << lastChunkShift;
            // } else {
            //   value |= carryValue;
            // }
          }

          out.push(value);
        }

        return out;
      }
    },
    {
      name: 'getChunk_',
      code: function(numChunkBits, viewByteOffset) {
        var numChunkBytes = Math.ceil(numChunkBits / 8);

        // Fast path: There is room to do a natural read.
        if ( viewByteOffset >= 0 &&
            viewByteOffset <= this.numBytes - numChunkBytes ) {
          return this.view['getUint' + numChunkBits](viewByteOffset);
        }

        // Slow path: Do the largest read the buffer will allow; shift to
        // adjust to requested index, and to clip size to requested read size.
        var readNumBytes = (this.numBytes >= 4 ? 4 :
            (this.numBytes >= 2 ? 2 : 1)),
            readNumBits = readNumBytes * 8,
            maxReadIdx = this.numBytes - readNumBytes,
            readByteOffset = (viewByteOffset < 0 ? 0 :
            (viewByteOffset > maxReadIdx ? maxReadIdx :
            viewByteOffset)),
            offsetBitDiff = Math.abs(readByteOffset - viewByteOffset) * 8,
            clipChunkShift = numChunkBits - readNumBits,
            chunk = this.view['getUint' + readNumBits](readByteOffset);

        this.console.assert(readByteOffset !== viewByteOffset ||
            clipChunkShift !== 0, 'Bit vector read took slow path when it ' +
            'should have taken fast path');

        // Align read MSB with chunk MSB.
        if ( clipChunkShift !== 0 ) chunk <<= clipChunkShift;

        // If necessary, shift MSB-aligned read to desired read location
        // alignment (relative to actual read alignment forced by size of read).
        if ( readByteOffset > viewByteOffset) return chunk >>> offsetBitDiff;
        else if ( readByteOffset < viewByteOffset )
          return chunk << offsetBitDiff;
        else return chunk;
      }
    },
    {
      name: 'putChunk_',
      code: function(numChunkBits, viewByteOffset, data) {
        var numChunkBytes = Math.ceil(numChunkBits / 8);

        // Fast path: There is room to do a natural write.
        if ( viewByteOffset >= 0 &&
            viewByteOffset <= this.numBytes - numChunkBytes ) {
          this.view['setUint' + numChunkBits](viewByteOffset, data);
          return;
        }

        // Slow path: Do the largest write the buffer will allow; shift to
        // adjust to requested index, and to clip size to requested write size.
        var writeNumBytes = (this.numBytes >= 4 ? 4 :
            (this.numBytes >= 2 ? 2 : 1)),
            writeNumBits = writeNumBytes * 8,
            maxWriteIdx = this.numBytes - writeNumBytes,
            writeByteOffset = (viewByteOffset < 0 ? 0 :
            (viewByteOffset > maxWriteIdx ? maxWriteIdx :
            viewByteOffset)),
            offsetBitDiff = Math.abs(writeByteOffset - viewByteOffset) * 8,
            clipChunkShift = numChunkBits - writeNumBits,
            keepData = this.view['getUint' + writeNumBits](writeByteOffset),
            writeData = data;

        this.console.assert(writeByteOffset !== viewByteOffset ||
            clipChunkShift !== 0, 'Bit vector write took slow path when it ' +
            'should have taken fast path');

        // Align write MSB with chunk MSB.
        if ( clipChunkShift !== 0 ) {
          if ( clipChunkShift > 0 ) writeData >>>= clipChunkShift;
          else                      writeData <<= -clipChunkShift;
        }

        // If necessary, shift MSB-aligned write data to desired write location
        // alignment (relative to actual write alignment forced by size of
        // write). At the same time, shift "keep data" read from the buffer
        // that will fill in bits not being explicitly written.
        if ( writeByteOffset > viewByteOffset) {
          keepData = keepData << (writeNumBits - offsetBitDiff) >>> (writeNumBits - offsetBitDiff);
          writeData <<= offsetBitDiff;
        } else if ( writeByteOffset < viewByteOffset) {
          keepData = keepData >>> (writeNumBits - offsetBitDiff) << (writeNumBits - offsetBitDiff);
          writeData >>>= offsetBitDiff;
        } else {
          // (Attempted) write size is larger than buffer. No shifting or
          // keeping of existing data required.
          keepData = 0;
        }
        this.view['setUint' + writeNumBits](writeByteOffset,
            keepData | writeData);
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
        bv.writeNumbers(0, 64, numsIn);
        var numsOut = bv.readNumbers(0, 64);
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
        var numsIn = [0x9ABCDEF9 | 0];
        bv.writeNumbers(16, 32, numsIn);
        var numsOut = bv.readNumbers(0, 64);
        this.assert(numsOut[0] === (numsIn[0] >>> 16), 'Number should be ' +
            (numsIn[0] >>> 16).toString(16) + ' and is ' +
            numsOut[0].toString(16));
        this.assert(numsOut[1] === (numsIn[0] << 16), 'Number should be ' +
            (numsIn[0] << 16).toString(16) + ' and is ' +
            numsOut[1].toString(16));
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Short writes',
      description: 'Write in small chunks',
      code: multiline(function() {/*
        var bv = X.lookup('foam.dao.index.BitVector').create();
        // Deliberately include extra 1-valued bits to attempt to sabatoge
        // writes that should be masking most bits.
        var numsIn = [
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0, // 3 MSBs: 010.
          0xBFFFFFFF | 0, // 3 MSBs: 101.
          0x5FFFFFFF | 0  // 3 MSBs: 010.
        ];
        for ( var i = 0; i < 20; ++i ) {
          bv.writeNumbers(3 * i, 3, [numsIn[i]]);
        }
        var numsOut = bv.readNumbers(0, 64);
        this.assert(numsOut[0] === (0xAAAAAAAA | 0), 'Number should be ' +
            (0xAAAAAAAA | 0).toString(16) + ' and is ' +
            numsOut[0].toString(16));
        this.assert(numsOut[1] === (0xAAAAAAA0 | 0), 'Number should be ' +
            (0xAAAAAAA0 | 0).toString(16) + ' and is ' +
            numsOut[1].toString(16));
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Full small write',
      description: 'Write to small bitvector (whole vector)',
      code: multiline(function() {/*
        var size = 11,
            bv = X.lookup('foam.dao.index.BitVector').create({ numBits: size }),
            numsIn = [(0xFFFFFFFF | 0)],
            len = size;
        bv.writeNumbers(0, len, numsIn);
        var numsOut = bv.readNumbers(0, size),
            expected = numsIn[0] >>> (32 - len) << (32 - len);

        this.assert(numsOut[0] === expected, 'Number should be ' + expected +
            ' and is ' + numsOut[0]);
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Partial small write',
      description: 'Write to a small bitvector (internal piece of vector)',
      code: multiline(function() {/*
        var size = 11,
            bv = X.lookup('foam.dao.index.BitVector').create({ numBits: size }),
            numsIn = [(0xAFFFFFFF | 0)], // MSBs: 1010 11... Ensures 1 in write
                                         // LSB location.
            offset = 5,
            len = size - offset - 1; // Don't write to the LSB.
        bv.writeNumbers(offset, len, numsIn);
        var numsOut = bv.readNumbers(0, size),
            expected = numsIn[0] >>> (32 - len) << (32 - len) >>> offset;

        this.assert(numsOut[0] === expected, 'Number should be ' + expected +
            ' and is ' + numsOut[0]);
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Full large write',
      description: 'Write to large bitvector (whole vector)',
      code: multiline(function() {/*
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 111 }),
            numsIn = [
              (0xFFFFFFFF | 0),
              (0xFFFFFFFF | 0),
              (0xFFFFFFFF | 0),
              (0xFFFFFFFF | 0)
            ],
            expected = [
              (0xFFFFFFFF | 0),
              (0xFFFFFFFF | 0),
              (0xFFFFFFFF | 0),
              (0xFFFE0000 | 0)
            ];
        bv.writeNumbers(0, 111, numsIn);
        var numsOut = bv.readNumbers(0, 111);

        for ( var i = 0; i < 4; ++i ) {
          this.assert(numsOut[i] === expected[i], 'Number should be ' +
              expected[i] + ' and is ' + numsOut[i]);
        }
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Partial large write',
      description: 'Write to large bitvector (internal piece of vector)',
      code: multiline(function() {/*
        var bv = X.lookup('foam.dao.index.BitVector').create({ numBits: 111 }),
            numsIn = [
              (0xAAAAAAAA | 0),
              (0xAAAAAAAA | 0),
              (0xAAAAAAAA | 0),
              (0xAAAAAAAA | 0)
            ],
            expected = [
              (0x15555555 | 0),
              (0x55555555 | 0),
              (0x50000000 | 0),
              (0x00000000 | 0)
            ];
        bv.writeNumbers(3, 65, numsIn);
        var numsOut = bv.readNumbers(0, 111);

        for ( var i = 0; i < 4; ++i ) {
          this.assert(numsOut[i] === expected[i], 'Number should be ' +
              expected[i] + ' and is ' + numsOut[i]);
        }
      */})
    },
    {
      model_: 'UnitTest',
      name: 'String write',
      description: 'Write string (16-bit chunks)',
      code: multiline(function() {/*
        var strIn = 'Hello world!!',
            size = strIn.length * 16,
            bv = X.lookup('foam.dao.index.BitVector').create({ numBits: size }),
            expected = 'Hello world!!';
        bv.writeString(0, size, strIn);
        var strOut = bv.readString(0, size);
        this.assert(strOut === expected, 'String should be "' + expected +
            '" and is "' + strOut + '"');
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Substring read',
      description: 'Read back part of string written to bitvector',
      code: multiline(function() {/*
        var strIn = 'Hello world!!',
            size = strIn.length * 16,
            bv = X.lookup('foam.dao.index.BitVector').create({ numBits: size }),
            expected = 'world';
        bv.writeString(0, size, strIn);
        var strOut = bv.readString(6 * 16, 5 * 16);
        this.assert(strOut === expected, 'Substring should be "' + expected +
            '" and is "' + strOut + '"');
      */})
    },
    {
      model_: 'UnitTest',
      name: 'Offset write',
      description: 'Write to bitvector at some offset',
      code: multiline(function() {/*
        var offset = 2,
            strIn = 'Hello world!!',
            bitLen = strIn.length * 16,
            size = bitLen + (2 * offset),
            bv = X.lookup('foam.dao.index.BitVector').create({ numBits: size }),
            expected = 'Hello world!!';
        bv.writeString(offset, bitLen, strIn);
        var strOut = bv.readString(offset, bitLen);
        this.assert(strOut === expected, 'String should be "' + expected +
            '" and is "' + strOut + '"');
      */})
    }
  ]
});
