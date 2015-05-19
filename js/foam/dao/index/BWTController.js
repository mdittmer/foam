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
  name: 'BWTController',
  package: 'foam.dao.index',

  requires: [
    'foam.dao.index.Alphabet',
    'foam.dao.index.BWTGenerator',
    'foam.dao.index.WaveletTree'
  ],
  imports: [
    'alphabet'
  ],

  properties: [
    {
      model_: 'StringProperty',
      name: 'data',
      required: true
    },
    {
      model_: 'IntProperty',
      name: 'length'
    },
    {
      model_: 'BooleanProperty',
      name: 'keepData',
      defaultValue: false
    },
    {
      type: 'foam.dao.index.Alphabet',
      name: 'alphabet'
    },
    {
      type: 'foam.dao.index.BWTGenerator',
      name: 'bwtGenerator',
      lazyFactory: function() {
        return this.BWTGenerator.create();
      }
    },
    {
      type: 'foam.dao.index.WaveletTree',
      name: 'bwtWaveletTree'
    },
    {
      type: 'foam.dao.index.WaveletTree',
      name: 'sortedWaveletTree'
    },
    {
      name: 'sortedCharCounts'
    }
  ],

  methods: [
    function init() {
      this.SUPER.apply(this, arguments);
      this.construct_();
    },
    function read(startIdx, length) {
      return length >= 0 ? this.readFwd_(startIdx, length) :
          this.readBwd_(startIdx, -length);
    },
    function rank(ch, idx) { return this.bwtWaveletTree.rank(ch, idx); },
    function select(ch, idx) { return this.bwtWaveletTree.select(ch, idx); },
    function readBwd_(startIdx, length) {
      if ( length <= 0 ) return '';
      var succs = this.bwtWaveletTree;
      var preds = this.sortedWaveletTree;
      var strArr = new Array(length);
      var idx = startIdx;
      var ch = succs.lookup(idx);
      for ( var i = length - 1; i >= 0; --i ) {
        idx = preds.select(ch, succs.rank(ch, idx));
        ch = succs.lookup(idx);
        strArr[i] = ch;
      }

      return strArr.join('');
    },
    function readFwd_(startIdx, length) {
      if ( length <= 0 ) return '';
      var preds = this.bwtWaveletTree;
      var succs = this.sortedWaveletTree;
      var str = preds.lookup(startIdx);
      var idx = startIdx;
      for ( var i = 1; i < length; ++i ) {
        var ch = succs.lookup(idx);
        str += ch;
        // No need to do an extra rank + select on last iteration.
        if ( (i + 1) !== length ) idx = preds.select(ch, succs.rank(ch, idx));
      }

      return str;
    },
    function reconstruct_() {
      // Force alphabet reconstruction.
      this.alphabet = '';
      this.construct_();
    },
    function construct_() {
      var str = this.data;
      if ( str[str.length - 1] !== this.bwtGenerator.eos )
        str += this.bwtGenerator.eos;
      this.length = this.data.length;
      if ( ! this.alphabet )
        this.alphabet = this.Alphabet.create({ data: str });

      var bwt = this.bwtGenerator.generateBWT(str);
      var sorted = bwt.split('').sort().join('');
      this.bwtWaveletTree = this.WaveletTree.create({
        data: bwt,
        alphabet: this.alphabet
      });
      this.sortedWaveletTree = this.WaveletTree.create({
        data: sorted,
        alphabet: this.alphabet
      });

      var sortedCharCounts = {};
      for ( var i = 0; i < this.alphabet.length; ++i ) {
        var ch = this.alphabet.lookup(i);
        sortedCharCounts[ch] = this.sortedWaveletTree.select(ch, 1);
      }
      var eos = this.bwtGenerator.eos;
      sortedCharCounts[eos] = this.sortedWaveletTree.select(eos, 1);
      this.sortedCharCounts = sortedCharCounts;

      if ( ! this.keepData ) this.data = '';
    }
  ],

  tests: [
    // TODO(markdittmer): These tests are for a generator with eos AFTER all
    // other values. We have switched to BEFORE all other values. These tests
    // need to be rewritten.
    {
      model_: 'UnitTest',
      name: 'Abracadabra: 1-char reads',
      description: 'Test reading a single char from "abracadabra"',
      code: function() {
        var bwtc = X.lookup('foam.dao.index.BWTController').create({
          data: 'abracadabra'
        });
        // BWT: [eos]drcraaaabba.
        var expected = bwtc.bwtGenerator.eos + 'drcraaaabba';
        for ( var i = 0; i < expected.length; ++i ) {
          var read = bwtc.read(i, 1);
          this.assert(read === expected[i], 'Expected read(' + i + ', 1) to ' +
              'be "' + expected[i] + '" and is "' + read + '"');
        }
      }
    },
    {
      model_: 'UnitTest',
      name: 'Abracadabra: 2-char reads',
      description: 'Test reading a single char from "abracadabra"',
      code: function() {
        var bwtc = X.lookup('foam.dao.index.BWTController').create({
          data: 'abracadabra'
        });
        // String: abracadabra.
        // BWT: [eos]drcraaaabba.
        var eos = bwtc.bwtGenerator.eos;
        var expected = [
          eos + 'a',
          'da',
          'ra',
          'ca',
          'ra',
          'ab',
          'ab',
          'ac',
          'ad',
          'br',
          'br',
          'a' + eos
        ];
        for ( var i = 0; i < expected.length; ++i ) {
          var read = bwtc.read(i, 2);
          this.assert(read === expected[i], 'Expected read(' + i + ', 2) to ' +
              'be "' + expected[i] + '" and is "' + read + '"');
        }
      }
    },
    {
      model_: 'UnitTest',
      name: 'Abracadabra: 5-char reads',
      description: 'Test reading a single char from "abracadabra"',
      code: function() {
        var bwtc = X.lookup('foam.dao.index.BWTController').create({
          data: 'abracadabra'
        });
        // String: abracadabra.
        // BWT: [eos]drcraaaabba.
        var eos = bwtc.bwtGenerator.eos;
        var expected = [
          eos + 'abra',
          'dabra',
          'racad',
          'cadab',
          'ra' + eos + 'ab',
          'abrac',
          'abra' + eos,
          'acada',
          'adabr',
          'braca',
          'bra' + eos + 'a',
          'a' + eos + 'abr'
        ];
        for ( var i = 0; i < expected.length; ++i ) {
          var read = bwtc.read(i, 5);
          this.assert(read === expected[i], 'Expected read(' + i + ', 5) to ' +
              'be "' + expected[i] + '" and is "' + read + '"');
        }
      }
    },
    {
      model_: 'UnitTest',
      name: 'Abracadabra: Backwards 1-char reads',
      description: 'Test reading a single char backwards from "abracadabra"',
      code: function() {
        var bwtc = X.lookup('foam.dao.index.BWTController').create({
          data: 'abracadabra'
        });
        // BWT: [eos]drcraaaabba. For each BWT char, we read the char that
        // appears directly before it in the original string.
        var expected = 'aabab' + bwtc.bwtGenerator.eos + 'drcaar';
        for ( var i = 0; i < expected.length; ++i ) {
          var read = bwtc.read(i, -1);
          this.assert(read === expected[i], 'Expected read(' + i + ', -1) to ' +
              'be "' + expected[i] + '" and is "' + read + '"');
        }
      }
    },
    {
      model_: 'UnitTest',
      name: 'Abracadabra: Full read in two parts',
      description: 'Test reading whole string, part fwd and part bwd: "abracadabra"',
      code: function() {
        var str = 'abracadabra';
        var bwtc = X.lookup('foam.dao.index.BWTController').create({
          data: str
        });
        str += bwtc.bwtGenerator.eos;
        var fwdLen = Math.floor(str.length / 2);
        var bwdLen = fwdLen - str.length;
        // BWT: [eos]drcraaaabba.
        var eos = bwtc.bwtGenerator.eos;
        var expected = [
          eos + 'abracadabra',
          'dabra' + eos + 'abraca',
          'racadabra' + eos + 'ab',
          'cadabra' + eos + 'abra',
          'ra' + eos + 'abracadab',
          'abracadabra' + eos,
          'abra' + eos + 'abracad',
          'acadabra' + eos + 'abr',
          'adabra' + eos + 'abrac',
          'bracadabra' + eos + 'a',
          'bra' + eos + 'abracada',
          'a' + eos + 'abracadabr'
        ];
        for ( var i = 0; i < expected.length; ++i ) {
          var read1 = bwtc.read(i, fwdLen);
          var read2 = bwtc.read(i, bwdLen);
          var read = read1 + read2;
          this.assert(read === expected[i], 'Expected read(' + i + ', ' +
              fwdLen + ') + read(' + i + ', ' + bwdLen + ') to be "' +
              expected[i] + '" and is "' + read + '"');
        }
      }
    }
  ]
});
