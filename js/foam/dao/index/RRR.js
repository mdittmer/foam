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
  name: 'RRR',
  package: 'foam.dao.index',

  requires: [
    'foam.Memo',
    'foam.dao.index.PopCountMapGenerator'
  ],
  imports: [
    'blockGenerator',
    'popCountMapGenerator'
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
      model_: 'IntProperty',
      name: 'blockSize',
      documentation: 'Number of bits per block.',
      defaultValue: 8
    },
    {
      model_: 'IntProperty',
      name: 'superBlockSize',
      documentation: 'Number of blocks per super-block.',
      defaultValue: 8
    },
    {
      name: 'popCountMap_',
      lazyFactory: function() {
        return this.generatePopCountMap_();
      }
    }
  ],

  methods: {
    init: function() {
      this.SUPER.apply(this, arguments);
      Events.dynamic(function() {
        this.blockSize;
        this.superBlockSize;
        this.generatePopCountMap_();
      }.bind(this));
    },
    generatePopCountMap_: function() {
      return this.popCountMapGenerator.generatePopCountMap(
          this.blockSize, this.superBlockSize);
    }
  }

  // TODO(markdittmer): Write tests.
});
