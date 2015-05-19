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
      model_: 'BooleanProperty',
      name: 'storeIndices',
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
    function queryBWTRange(str) {
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
    function querySnippets(str, opt_preLen, opt_postLen, opt_limit) {
      if ( opt_limit <= 0 ) return [];

      var preLen = opt_preLen === 0 ? opt_preLen : (opt_preLen || 10);
      var postLen = opt_postLen === 0 ? opt_postLen : (opt_postLen || 10);
      var range = this.queryBWTRange(str);
      if ( ! range ) return [];

      var limit = Math.min(range.end - range.start + 1, opt_limit || 10);
      var snippets = new Array(limit);
      for ( var i = 0; i < limit; ++i ) {
        var idx = range.start + i;
        snippets[i] = this.bwtController.read(idx, -preLen) +
            this.bwtController.read(idx, postLen);
      }

      return snippets;
    },
    function queryStringIndices(str, opt_limit) {
      if ( ! this.storeIndices ) throw new Error('Unable to lookup original ' +
          'index of characters when config parameter "storeIndices" is false');

      if ( opt_limit <= 0 ) return [];

      var range = this.queryBWTRange(str);
      if ( ! range ) return [];

      var limit = Math.min(range.end - range.start + 1, opt_limit || 1000);
      var indices = new Array(limit);
      for ( var i = 0; i < limit; ++i ) {
        var idx = range.start + i;
        indices[i] = this.bwtController.originalIndexOf(idx);
      }

      return indices;
    },
    function construct_() {
      this.bwtController = this.BWTController.create({
        data: this.data,
        storeIndices: this.storeIndices
      });
      if ( ! this.keepData ) this.data = '';
    }
  ],

  tests: [
    {
      model_: 'UnitTest',
      name: 'Mississipi: Find BWT range: "iss"',
      description: 'Test FM-Index BWT range query of "iss" on "missisipi"',
      code: function() {
        var str = 'mississippi';
        var fmi = X.lookup('foam.dao.index.FMIndex').create({
          data: str
        });
        var result = fmi.queryBWTRange('iss');
        this.assert(result && result.start === 3, 'Expected "iss" query in ' +
            '"mississippi" to result in start BWT index of 3');
        this.assert(result && result.end === 4, 'Expected "iss" query in ' +
            '"mississippi" to result in end BWT index of 4');
      }
    },
    {
      model_: 'UnitTest',
      name: 'Mississipi: Find snippets: "iss"',
      description: 'Test FM-Index snippets query of "iss" on "missisipi"',
      code: function() {
        var str = 'mississippi';
        var fmi = X.lookup('foam.dao.index.FMIndex').create({
          data: str
        });
        var result = fmi.querySnippets('iss', 1, 4);
        this.assert(result.length === 2, 'Expected  "iss" query in ' +
            '"mississippi" to yield two results and yileded' + result.length);
        this.assert(result[0] === 'missi' || result[0] === 'sissi',
                    'Expected  bracketed "iss" query results in '+
                        '"mississippi" to yield "missi" or "sissi" and ' +
                        'yielded "' + result[0] + '"');
        this.assert(result[1] === 'missi' || result[1] === 'sissi',
                    'Expected  bracketed "iss" query results in '+
                        '"mississippi" to yield "missi" or "sissi" and ' +
                        'yielded "' + result[1] + '"');
      }
    },
    {
      model_: 'UnitTest',
      name: 'Mississipi: Find string indices: "iss"',
      description: 'Test FM-Index string indices query of "iss" on "missisipi"',
      code: function() {
        var str = 'mississippi';
        var fmi = X.lookup('foam.dao.index.FMIndex').create({
          data: str,
          storeIndices: true
        });
        var result = fmi.queryStringIndices('iss');
        this.assert(result.length === 2, 'Expected  "iss" query in ' +
            '"mississippi" to yield two results and yileded' + result.length);
        this.assert(result[0] === str.indexOf('iss') ||
            result[0] === str.lastIndexOf('iss'), 'Expected index-of query ' +
            'for "iss" in "mississippi" to be index of first "iss" or ' +
            'second "iss" and is ' + result[0]);
        this.assert(result[1] === str.indexOf('iss') ||
            result[1] === str.lastIndexOf('iss'), 'Expected index-of query ' +
            'for "iss" in "mississippi" to be index of first "iss" or ' +
            'second "iss" and is ' + result[1]);
      }
    }
  ]
});
