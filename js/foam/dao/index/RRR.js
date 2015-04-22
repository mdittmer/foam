
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
    'foam.Memo'
  ],
  properties: [
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
    }
  ],

  methods: [
    // TODO(markdittmer): Implement putting strings. BlockGenerator lazily provides
    // lookup tables. This component must manage raw class+offset bits +
    // super-block metadata.
  ]

  // TODO(markdittmer): Write tests.
});
