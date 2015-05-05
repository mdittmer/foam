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
    'foam.dao.index.BlockGenerator',
    'foam.dao.index.BWTCharGenerator',
    'foam.dao.index.PopCountMapGenerator',
    'foam.dao.index.RotatedStr'
  ],
  exports: [
    'blockGenerator',
    'popCountMapGenerator'
  ],

  properties: [
    {
      name: 'blockGenerator',
      type: 'foam.dao.index.BlockGenerator',
      lazyFactory: function() {
        return this.BlockGenerator.create();
      }
    },
    {
      name: 'popCountMapGenerator',
      type: 'foam.dao.index.PopCountMapGenerator',
      lazyFactory: function() {
        return this.PopCountMapGenerator.create();
      }
    },
    {
      model_: 'StringProperty',
      name: 'data',
      adapt: function(_, nu) {
        if ( nu.charAt(nu.length - 1) !== this.eos ) return nu + this.eos;
        else return nu;
      },
      postSet: function(old, nu) {
        if ( old === nu ) return;
        this.bwt = this.computeBWT_();
      }
    },
    {
      name: 'bwt'
    },
    {
      model_: 'StringProperty',
      name: 'eos',
      defaultValue: String.fromCharCode(0x0000FFFF | 0)
    }
  ],

  methods: {
    // TODO(markdittmer): Research and implement a more efficient bwt algorithm.
    computeBWT_: function() {
      var len = this.data.length;
      var arr = new Array(len);
      var i;
      for ( i = 0; i < len; ++i ) {
        arr[i] = this.RotatedStr.create({
          data: this.data,
          startPos: i,
          mod: len
        });
      }
      arr.sort(function(a, b) {
        return a.compareTo(b);
      });
      // TODO(markdittmer): Model BWT; store mapping from bwt index to suffix
      // array index. This will enable (sub)string reconstruction for queries.
      var rtn = '';
      for ( i = 0; i < len; ++i ) {
        rtn += arr[i].charAt(len - 1);
      }
      return rtn;
    },
    invertBWT_: function() {
      var bwtCharGenerator = this.BWTCharGenerator.create();
      var len = this.bwt.length;
      var bwt = new Array(len);
      var i;
      for ( i = 0; i < len; ++i ) {
        bwt[i] = bwtCharGenerator.generateChar(this.bwt[i]);
      }
      var sortedBWT = bwt.slice(0);
      sortedBWT.sort();
      // TODO(markdittmer): Model inverted BWT.
      var invertedBWT = new Array(len);
      for ( i = 0; i < len; ++i ) {
        invertedBWT[i] = [bwt[i], sortedBWT[i]];
      }
      return invertedBWT;
    }
  },

  tests: [
    {
      model_: 'UnitTest',
      name: 'Abracadabra',
      description: 'Ta-da!',
      code: multiline(function() {/*
        var fmi = X.lookup('foam.dao.index.FMIndex').create({ data: 'abracadabra' });
        var bwt = fmi.bwt;
        this.assert(bwt === (fmi.eos + 'drcraaaabba'), 'Expected magic to happen');
      */})
    }
  ]
});
