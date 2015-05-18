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
  name: 'CountingCharGenerator',
  package: 'foam.dao.index',

  properties: [
    {
      name: 'charCounts',
      lazyFactory: function() { return {}; }
    }
  ],

  methods: [
    {
      name: 'generateIntChar',
      code: function(jsChar) {
        if ( ! this.charCounts[jsChar] ) this.charCounts[jsChar] = 0;
        this.console.assert(this.charCounts[jsChar] < (1 << 16),
                            'BWT character counter overflow');
        var rtn = (jsChar.charCodeAt(0) << 16) | this.charCounts[jsChar];
        ++this.charCounts[jsChar];
        return rtn;
      }
    },
    {
      name: 'generateDoubleChar',
      code: function(jsChar) {
        if ( ! this.charCounts[jsChar] ) this.charCounts[jsChar] = 0;
        this.console.assert(this.charCounts[jsChar] < (1 << 16),
                            'BWT character counter overflow');
        var rtn = jsChar + String.fromCharCode(this.charCounts[jsChar]);
        ++this.charCounts[jsChar];
        return rtn;
      }
    }
  ]
});
