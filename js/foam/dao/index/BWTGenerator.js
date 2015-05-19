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
  name: 'BWTGenerator',
  package: 'foam.dao.index',

  requires: [
    'foam.dao.index.RotatedStr'
  ],
  imports: [
    'eos'
  ],

  properties: [
    {
      model_: 'StringProperty',
      name: 'eos',
      defaultValue: '\0'
    }
  ],

  methods: [
    function generateBWT(str, opt_includeIndices) {
      if ( str[str.length - 1] !== this.eos ) str += this.eos;
      var len = str.length;
      var arr = new Array(len);
      var i;
      for ( i = 0; i < len; ++i ) {
        arr[i] = this.RotatedStr.create({
          data: str,
          startPos: i,
          mod: len
        });
      }
      arr.sort(function(a, b) {
        return a.compareTo(b);
      });
      var bwtStr = '';
      for ( i = 0; i < len; ++i ) {
        bwtStr += arr[i].charAt(len - 1);
      }
      var indices = opt_includeIndices ? new Array(str.length) : [];
      if ( opt_includeIndices ) {
        for ( i = 0; i < len; ++i ) {
          indices[i] = arr[i].startPos;
        }
      }
      return { str: bwtStr, indices: indices };
    }
  ],

  tests: [
    {
      model_: 'UnitTest',
      name: 'Abracadabra',
      description: 'Ta-da!',
      code: function() {
        var bwtg = X.lookup('foam.dao.index.BWTGenerator').create();
        var bwt = bwtg.generateBWT('abracadabra');
        this.assert(bwt === 'ard' + bwtg.eos + 'rcaaaabb', 'Expected magic to happen');
      }
    }
  ]
});
