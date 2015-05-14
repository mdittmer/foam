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

// Notes on reimplementing draft below:
// A wavelet tree can answer rank queries efficiently. Should be able to use
// that to avoid storing characters twice as big.
// Twice-as-big-char-value = (16-bit char code, 16-bit counter)
// = (16-bit char code, rank(current bwt idx, 16-bit char code))
//
// Not that rank() here is rank in the bwt string, NOT the data string. Need to
// double-check post on FM-Index to determine whether wavelet tree used for rank
// in bwt or data, but I am quite confident that it is bwt, so we can reuse the
// wavelet tree that we need anyway here, and ditch the extra storage.

CLASS({
  name: 'BWT',
  package: 'foam.dao.index',

  requires: [
    'foam.dao.index.BWTCharGenerator',
    'foam.dao.index.RotatedStr',
    'foam.dao.index.WaveletTree'
  ],

  properties: [
    {
      model_: 'StringProperty',
      name: 'eos',
      defaultValue: String.fromCharCode(0x0000FFFF | 0)
    },
    {
      type: 'foam.dao.index.WaveletTree',
      name: 'waveletTree_'
    },
    // Phase 1: Input data. Data may be discarded in Phase 2.
    {
      name: 'data',
      required: true,
      getter: function() {
        if ( this.data_ ) return this.data_;
        return this.getFullString_();
      },
      setter: function(data) {
        this.data_ = data;
      }
    },
    {
      model_: 'StringProperty',
      name: 'data_',
      adapt: function(_, nu) {
        if ( nu.charAt(nu.length - 1) !== this.eos ) return nu + this.eos;
        else return nu;
      },
      postSet: function(old, nu) {
        if ( old === nu ) return;
        // Number associated with first character is:
        // (16-bit char code, 16-bit counter) = ([first char code], 0).
        this.firstCharNum_ = nu.charCodeAt(0) << 16;
      }
    },
    {
      model_: 'IntProperty',
      name: 'firstCharNum_'
    },
    {
      model_: 'BooleanProperty',
      name: 'discardData',
      defaultValue: true
    },
    // Phase 2: BWT as plain string. Data may be discarded in Phase 3.
    {
      model_: 'StringProperty',
      name: 'bwt',
      getter: function() {
        if ( this.bwt_ ) return this.bwt_;
        if ( ! this.data_ ) return '';
        this.bwt = this.computeBWT_();
        return this.bwt_;
      },
      setter: function(bwt) {
        if ( this.discardData ) this.data = '';
        this.bwt_ = bwt;
        if ( bwt ) this.waveletTree_ = this.WaveletTree.create({ data: bwt });
      }
    },
    // Phase 3. Data may be discarded in Phase 4.
    {
      name: 'eosIdx_',
      getter: function() {
        if ( this.eosIdx__ >= 0 ) return this.eosIdx__ >= 0;
        if ( this.numBWT__.length == 0 ) this.eosIdx__ = this.locateEOSIdx_();

        throw new Error('Expected numBWT__ initialized to imply ' +
            'eosIdx__ is set');
      },
      setter: function(eosIdx) {
        this.eosIdx__ = eosIdx;
      }
    },
    {
      model_: 'IntProperty',
      name: 'eosIdx__',
      defaultValue: -1
    },
    {
      name: 'sortedBWT_',
      getter: function() {
        if ( this.sortedBWT__ ) return this.sortedBWT__;
        if ( ! this.bwt ) return '';
        this.sortedBWT_ = this.bwt.split('').sort().join('');
        return this.sortedBWT__;
      },
      setter: function(sortedBWT) {
        this.sortedBWT__ = sortedBWT;
      }
    },
    {
      model_: 'StringProperty',
      name: 'sortedBWT__'
    },
    {
      model_: 'BooleanProperty',
      name: 'discardBWT',
      defaultValue: false
    },
    {
      model_: 'BooleanProperty',
      name: 'discardSortedBWT',
      defaultValue: true
    },
    // Phase 4.
    {
      name: 'bwtMap',
      getter: function() {
        if ( this.bwtMap_ ) return this.bwtMap_;
        this.bwtMap_ = this.generateBWTMap_();
        return this.bwtMap_;
      },
      setter: function(bwtMap) {
        if ( this.discardBWT ) this.bwt_ = '';
        if ( this.discardSortedBWT ) this.sortedBWT_ = '';
        this.bwtMap_ = bwtMap;
      }
    },
    {
      name: 'bwtMap_'
    }
  ],

  methods: [
    function computeBWT_() {
      var len = this.data_.length;
      var arr = new Array(len);
      var i;
      for ( i = 0; i < len; ++i ) {
        arr[i] = this.RotatedStr.create({
          data: this.data_,
          startPos: i,
          mod: len
        });
      }
      arr.sort(function(a, b) {
        return a.compareTo(b);
      });
      var rtn = '';
      for ( i = 0; i < len; ++i ) {
        rtn += arr[i].charAt(len - 1);
      }
      return rtn;
    },
    function locateEOSIdx_() {
      var bwt = this.bwt;
      var len = bwt.length;
      for ( var i = 0; i < len; ++i ) {
        if ( bwt[i] === this.eos ) return i;
      }

      throw new Error('Expected bwt to contain end-of-string character');
    },

    // TODO(markdittmer): Trying to do away with two-char representations and
    // bwt map. This requires an implementation of select(idx) over wavelet
    // trees and rrrs.

    // function generateBWTMap_() {
    //   var fst = this.bwt;
    //   var snd = this.sortedBWT_;

    //   if ( fst.length !== snd.length )
    //     throw new Error('BWT and sorted BWT are not the same size');
    //   if ( fst.length === 0 ) return {};

    //   var map = {};
    //   for ( var i = 0; i < fst.length; ++i ) {
    //     map[fst[i]] = map[snd[i]];
    //     // var fstChar = fst[i];
    //     // var fstRank = this.bwtRank_(fst[i], i);
    //     // var sndChar = snd[i];
    //     // var sndRank = this.sortedBWTRank_(snd[i], i);
    //     // map[fstChar + String.fromCharCode(fstRank)] =
    //     //     sndChar + String.fromCharCode(sndRank);
    //   }
    //   return map;
    // },
    // function bwtRank_(ch, idx) {
    //   return this.waveletTree_.rank(ch, idx);
    // },
    // function sortedBWTRank_(ch, idx) {
    //   var firstIdx = this.bsFindFirst_(this.sortedBWT_, ch, 0, idx);
    //   return idx - firstIdx + 1;
    // },
    // function bsFind_(arr, value, start, end) {
    //   var mid;
    //   while ( start <= end ) {
    //     mid = Math.floor(start + ((end - start) / 2));
    //     if ( arr[mid] === value ) return mid;
    //     if ( arr[mid] < value ) start = mid + 1;
    //     if ( arr[mid] > value ) end = mid - 1;
    //   }
    //   return -1;
    // },
    // function bsFindFirst_(arr, value, start, end) {
    //   var mid;
    //   while ( start <= end ) {
    //     mid = Math.floor(start + ((end - start) / 2));
    //     if ( arr[mid] === value &&
    //         (mid === 0 || arr[mid - 1] !== value) ) return mid;

    //     if ( arr[mid] > value ) end = mid - 1;
    //     else                    start = mid + 1;
    //   }
    //   return -1;
    // },
    // TODO(markdittmer): This would be unnecessary if we always stored BWT
    // chars as two-char strings instead of numbers (which happen to have the
    // same number of bits as two-char strings). On the other hand, our binary
    // search would then have to construct numbers from two-char strings.
    // function numToTwoChar_(num) {
    //   return String.fromCharCode(num >>> 16) +
    //       String.fromCharCode(num & 0x0000FFFF);
    // },
    function getFullString_() {
      var bwt = this.bwt;
      var sortedBWT = this.sortedBWT_;
      var idx = this.eosIdx_;
      var str = '';
      while ( sortedBWT[idx] !== this.eos ) {
        str += sortedBWT[idx];

        // TODO(markdittmer): Use select queries to locate next bwt index.
      }
      return str;
    }
    // TODO(markdittmer): Still need a basic reading interface that can
    // construct substrings from a start idx and length.
  ]

  // TODO(markdittmer): Write tests.
});
