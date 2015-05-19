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
  name: 'FMIndex',
  package: 'foam.dao.index',

  requires: [
    'foam.dao.index.Alphabet',
    'foam.dao.index.BinarySearch',
    'foam.dao.index.BlockGenerator',
    'foam.dao.index.BWTController',
    'foam.dao.index.PopCountMapGenerator'
  ],
  exports: [
    'alphabet',
    'binarySearch',
    'blockGenerator',
    'eos',
    'popCountMapGenerator'
  ],

  properties: [
    {
      type: 'foam.dao.index.BinarySearch',
      name: 'binarySearch',
      factory: function() {
        return this.BinarySearch.create();
      }
    },
    {
      type: 'foam.dao.index.BlockGenerator',
      name: 'blockGenerator',
      factory: function() {
        return this.BlockGenerator.create();
      }
    },
    {
      type: 'foam.dao.index.PopCountMapGenerator',
      name: 'popCountMapGenerator',
      factory: function() {
        return this.PopCountMapGenerator.create();
      }
    },
    {
      model_: 'StringProperty',
      name: 'eos',
      defaultValue: '\0'
    },
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
      type: 'foam.dao.index.Alphabet',
      name: 'alphabet',
      factory: function() {
        var str = this.data;
        if ( str[str.length - 1] !== this.eos )
          str += this.eos;
        return this.Alphabet.create({ data: str });
      }
    },
    {
      type: 'foam.dao.index.BWTController',
      name: 'bwtController'
    }
  ],

  methods: [
    function init() {
      this.SUPER.apply(this, arguments);
      this.construct_();
    },
    function query(str) {
      var s = 0;
      var e = this.bwtController.length - 1;
      var c = this.bwtController.sortedCharCounts;
      var rank = this.bwtController.rank.bind(this.bwtController);

      for ( var i = str.length - 1; i >= 0; --i ) {
        var ch = str[i];
        s = c[ch] + rank(ch, s - 1);
        e = c[ch] + rank(ch, e) - 1;
        if ( e < s ) return null;
      }

      return { start: s, end: e };
    },
    function construct_() {
      this.bwtController = this.BWTController.create({ data: this.data });
      if ( ! this.keepData ) this.data = '';
    }
  ],

  tests: [
    {
      model_: 'UnitTest',
      name: 'Mississipi: Find "iss"',
      description: 'Test FM-Index query of "iss" on "missisipi"',
      code: function() {
        var str = 'mississippi';
        var fmi = X.lookup('foam.dao.index.FMIndex').create({
          data: str
        });
        var result = fmi.query('iss');
        this.assert(result && result.start === 3, 'Expected "iss" query in ' +
            '"mississippi" to result in start BWT index of 3');
        this.assert(result && result.end === 4, 'Expected "iss" query in ' +
            '"mississippi" to result in end BWT index of 4');
      }
    }
  ]
});
