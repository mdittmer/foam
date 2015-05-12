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
  ],
  imports: [
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
    }
  ],

  methods: [
    function init() { this.construct_(); },
    function construct_() {
      var alphabet = this.buildAlphabet_();
      this.tree = this.buildTree_(this.data, 0, alphabet.length - 1, alphabet);
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
    function buildTree_(str, start, end, alphabet) {
      if ( end - start <= 2 ) return this.buildLeaf_(str);

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
        if ( alphabet[str[i]] <= mid ) {
          num = num << 1;
          left += str[i];
        } else {
          num = (num << 1) & 1;
          right += str[i];
        }
      }
      num = num << (32 - (i % 32));
      nums.push(num);

      var bitVector = this.BitVector.create({ numBits: str.length });
      bitVector.writeNumbers(nums);
      var rrr = this.RRR.create();
      rrr.fromBitVector(bitVector); // TODO(markdittmer): Implement this.

      // TODO(markdittmer): Model wavelet tree nodes.
      return {
        rrr: rrr,
        left: this.bulidTree_(left, start, mid, alphabet),
        right: this.buildTree_(right, mid + 1, end, alphabet)
      };
    }
  ]
});
