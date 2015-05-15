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
  name: 'WaveletTree',
  package: 'foam.dao.index',
  extendsModel: '',
  traits: [
  ],

  requires: [
    'foam.dao.index.BitVector',
    'foam.dao.index.RRR'
  ],
  imports: [
    'console'
  ],
  exports: [
  ],

  properties: [
    {
      model_: 'StringProperty',
      name: 'data',
      postSet: function() {
        this.construct_();
      }
    },
    {
      name: 'alphabet_'
    },
    {
      name: 'tree_'
    }
  ],

  methods: [
    function init() { this.construct_(); },
    function rank(ch, idx) {
      return this.rank_(idx, this.tree_, ch);
    },
    function select(ch, idx) {
      return this.select_(idx, this.tree_, ch);
    },
    function rank_(idx, node, ch) {
      var rrr = node.rrr;
      var bitValue = rrr.bitValue(idx);
      var chBitValue = this.chBitValue_(node, ch);

      // If character does not appear in string, then its rank is 0.
      if ( bitValue < 0 || chBitValue < 0 ) return 0;

      var chBitRank = chBitValue !== 0 ? rrr.rank1(idx) : rrr.rank0(idx);

      // TODO(markdittmer): We should have a more elegant way of checking
      // whether a node is a leaf.
      if ( ! node.left ) return chBitRank;

      var nextNode = chBitValue === 0 ? node.left : node.right;
      return this.rank_(chBitRank - 1, nextNode, ch);
    },
    function select_(idx, node, ch) {
      var rrr = node.rrr;
      var bitValue = rrr.bitValue(idx);
      var chBitValue = this.chBitValue_(node, ch);

      // If character does not appear in string, then select location is -1.
      if ( bitValue < 0 || chBitValue < 0 ) return -1;

      var chBitSelect;

      // TODO(markdittmer): We should have a more elegant way of checking
      // whether a node is a leaf.
      if ( ! node.left ) {
        chBitSelect = chBitValue !== 0 ? rrr.select1(idx) :
            rrr.select0(idx);
        return chBitSelect;
      }

      var nextNode = chBitValue === 0 ? node.left : node.right;
      var newIdx = this.select_(idx, nextNode, ch);
      chBitSelect = chBitValue !== 0 ? rrr.select1(newIdx + 1) :
          rrr.select0(newIdx + 1);
      return chBitSelect;
    },
    function chBitValue_(node, ch) {
      if ( typeof this.alphabet_[ch] === 'undefined' ) return -1;

      return this.alphabet_[ch] > node.mid ? 1 : 0;
    },
    function construct_() {
      this.alphabet_ = this.buildAlphabet_();
      this.tree_ = this.buildTree_(this.data, 0, this.alphabet_.length - 1);
    },
    function buildAlphabet_() {
      var alphaMap = this.buildAlphaMap_();
      var alphaList = Object.keys(alphaMap).sort();
      for ( var i = 0; i < alphaList.length; ++i ) {
        alphaMap[alphaList[i]] = i;
      }
      alphaMap.length = alphaList.length;
      return alphaMap;
    },
    function buildAlphaMap_() {
      var str = this.data;
      var len = str.length;
      var map = {};
      for ( var i = 0; i < len; ++i ) { map[str[i]] = true; }
      return map;
    },
    function buildTree_(str, start, end) {
      var isLeaf = (end - start) < 2;

      var mid = start + Math.floor((end - start) / 2);
      var left = '';
      var right = '';
      var nums = [];
      var num = 0;
      var i;
      for ( i = 0; i < str.length; ++i ) {
        if ( (i + 1) % 32 === 0 ) {
          nums.push(num);
          num = 0;
        }
        if ( this.alphabet_[str[i]] <= mid ) {
          num = num << 1;
          // Do not bother building more strings when current node is a leaf.
          // TODO(markdittmer): Should we have two versions of this loop to
          // avoid checking this on every iteration?
          if ( ! isLeaf ) left += str[i];
        } else {
          num = (num << 1) | 0x01;
          // Do not bother building more strings when current node is a leaf.
          // TODO(markdittmer): Should we have two versions of this loop to
          // avoid checking this on every iteration?
          if ( ! isLeaf ) right += str[i];
        }
      }
      num = num << (32 - (i % 32));
      nums.push(num);

      var bitVector = this.BitVector.create({ numBits: str.length });
      bitVector.writeNumbers(0, str.length, nums);
      var rrr = this.RRR.create();
      rrr.fromBitVector(bitVector);

      // TODO(markdittmer): Model wavelet tree nodes.
      if ( isLeaf ) {
        return { rrr: rrr, mid: mid };
      } else {
        return {
          rrr: rrr,
          mid: mid,
          left: this.buildTree_(left, start, mid),
          right: this.buildTree_(right, mid + 1, end)
        };
      }
    }
  ],

  tests: [
    {
      model_: 'UnitTest',
      name: 'Empty string',
      description: 'Check rank values on empty string',
      code: function() {
        var wt = X.lookup('foam.dao.index.WaveletTree').create({ data: '' });
        var rank = wt.rank('a', 0);
        this.assert(rank  === 0, 'Expected rank(a, 0) on empty ' +
            'string to be 0 and is ' + rank);
        rank = wt.rank('a', -1);
        this.assert(rank  === 0, 'Expected rank(a, -1) on empty ' +
            'string to be 0 and is ' + rank);
        rank = wt.rank('a', 1000);
        this.assert(rank  === 0, 'Expected rank(a, 1000) on empty ' +
            'string to be 0 and is ' + rank);
      }
    },
    {
      model_: 'UnitTest',
      name: 'Foobar rank',
      description: 'Check rank values on "foobar"',
      code: function() {
        var str = 'foobar';
        var wt = X.lookup('foam.dao.index.WaveletTree').create({ data: str });
        var data = [
          // For each char in str, check (1) just before char, (2) char
          // locations, (3) last char.
          { ch: 'f', idx: 0, expected: 1 },
          { ch: 'f', idx: str.length - 1, expected: 1 },
          { ch: 'o', idx: 0, expected: 0 },
          { ch: 'o', idx: 0, expected: 0 },
          { ch: 'o', idx: 2, expected: 2 },
          { ch: 'o', idx: str.length - 1, expected: 2 },
          { ch: 'b', idx: 2, expected: 0 },
          { ch: 'b', idx: 3, expected: 1 },
          { ch: 'b', idx: str.length - 1, expected: 1 },
          { ch: 'a', idx: 3, expected: 0 },
          { ch: 'a', idx: 4, expected: 1 },
          { ch: 'a', idx: str.length - 1, expected: 1 },
          { ch: 'r', idx: 4, expected: 0 },
          { ch: 'r', idx: 5, expected: 1 },
          { ch: 'z', idx: str.length - 1, expected: 0 }
        ];
        for ( var i = 0; i < data.length; ++i ) {
          var ch = data[i].ch;
          var idx = data[i].idx;
          var expected = data[i].expected;
          var rank = wt.rank(ch, idx);
          this.assert(rank === expected, 'Expected rank(' + ch + ', ' + idx +
              ') on "' + str + '" to be ' + expected + ' and is ' + rank);
        }
      }
    },
    {
      model_: 'UnitTest',
      name: 'Foobar select',
      description: 'Check select values on "foobar"',
      code: function() {
        var str = 'foobar';
        var wt = X.lookup('foam.dao.index.WaveletTree').create({ data: str });
        var data = [
          // For each char in str, check (1) just before char, (2) char
          // locations, (3) last char.
          { ch: 'f', idx: 1, expected: 0 },
          { ch: 'o', idx: 1, expected: 1 },
          { ch: 'o', idx: 2, expected: 2 },
          { ch: 'b', idx: 1, expected: 3 },
          { ch: 'a', idx: 1, expected: 4 },
          { ch: 'r', idx: 1, expected: 5 },
          { ch: 'z', idx: 1, expected: -1 }
        ];
        for ( var i = 0; i < data.length; ++i ) {
          var ch = data[i].ch;
          var idx = data[i].idx;
          var expected = data[i].expected;
          if ( i === 0 ) debugger;
          var select = wt.select(ch, idx);
          this.assert(select === expected, 'Expected select(' + ch + ', ' +
              idx + ') on "' + str + '" to be ' + expected + ' and is ' +
              select);
        }
      }
    }
  ]
});
