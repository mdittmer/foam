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
  name: 'Alphabet',
  package: 'foam.dao.index',

  properties: [
    {
      model_: 'StringProperty',
      name: 'data',
      required: true
    },
    {
      model_: 'BooleanProperty',
      name: 'keepData',
      defaultValue: false
    },
    {
      name: 'length',
      getter: function() { return this.alphaList_.length; }
    },
    {
      name: 'alphaMap_'
    },
    {
      model_: 'ArrayProperty',
      name: 'alphaList_'
    }
  ],

  methods: [
    function init() {
      this.SUPER.apply(this, arguments);
      this.buildAlphabet_();
    },
    function lookup(idx) {
      return this.alphaList_[idx];
    },
    function indexOf(ch) {
      return this.alphaMap_[ch];
    },
    function buildAlphabet_() {
      var alphaMap = this.buildAlphaMap_();
      var alphaList = Object.keys(alphaMap).sort();
      for ( var i = 0; i < alphaList.length; ++i ) {
        alphaMap[alphaList[i]] = i;
      }
      this.alphaMap_ = alphaMap;
      this.alphaList_ = alphaList;
      if ( ! this.keepData ) this.data = '';
    },
    function buildAlphaMap_() {
      var str = this.data;
      var len = str.length;
      var map = {};
      for ( var i = 0; i < len; ++i ) { map[str[i]] = true; }
      return map;
    }
  ]
});
