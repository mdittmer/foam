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
  name: 'BinarySearch',
  package: 'foam.dao.index',

  properties: [
    {
      name: 'data'
    },
    {
      model_: 'FunctionProperty',
      name: 'comparator',
      defaultValue: function(a, b) {
        return a - b;
      }
    }
  ],

  methods: [
    {
      name: 'find',
      code: function(value) {
        var data = this.data;
        var start = 0, end = data.length - 1;
        var mid;
        while ( start <= end ) {
          mid = Math.floor(start + ((end - start) / 2));
          var cmp = this.comparator(data[mid], value, mid, data);
          if ( cmp === 0 ) return mid;
          if ( cmp < 0 ) start = mid + 1;
          else           end = mid - 1;
        }

        return -1;
      }
    }
  ]

  //TODO(markdittmer): Write tests.
});
