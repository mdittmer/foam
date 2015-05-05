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
  name: 'RotatedStr',
  package: 'foam.dao.index',


  properties: [
    {
      model_: 'StringProperty',
      name: 'data'
    },
    {
      model_: 'IntProperty',
      name: 'startPos'
    },
    {
      model_: 'IntProperty',
      name: 'mod'
    }
  ],

  methods: {
    charAt: function(idx) {
      return this.data[(idx + this.startPos) % this.mod];
    },
    charCodeAt: function(idx) {
      return this.data.charCodeAt((idx + this.startPos) % this.mod);
    },
    compareTo: function(other) {
      var lim = Math.min(this.mod, other.mod);
      for ( var i = 0; i < lim; ++i ) {
        var diff = this.charCodeAt(i) - other.charCodeAt(i);
        if ( diff !== 0 ) return diff;
      }
      if ( this.mod < other.mod ) return -1;
      else if ( this.mod === other.mod ) return 0;
      else return 1;
    },
    toString: function() {
      return this.data.slice(this.startPos) + this.data.slice(0, this.startPos);
    }
  }
});
