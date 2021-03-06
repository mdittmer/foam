/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
CLASS({
  package: 'foam.node.dao',
  name: 'JSONFileDAO',
  extends: 'MDAO',

  imports: [ 'console' ],

  properties: [
    {
      name: 'fs',
      factory: function() {
        return require('fs');
      }
    },
    {
      name:  'filename',
      label: 'File Name',
      defaultValueFn: function() {
        return this.name + '.json';
      }
    },
    {
      model_: 'BooleanProperty',
      name: 'writing',
      defaultValue: false
    }
  ],

  methods: {
    init: function() {
      this.SUPER();

      if ( Array.isArray(this.filename) ) {
        for ( var i = 0; i < this.filename.length; ++i ) {
          if ( this.loadFile(this.filename[i]) ) {
            this.filename = this.filename[i];
            break;
          }
          this.console.warn('Failed to load JSON file:', this.filename[i]);
        }
      } else {
        this.loadFile(this.filename);
      }

      if ( Array.isArray(this.filename) ) this.fileName = this.fileName[0] || '';

      this.addRawIndex({
        execute: function() {},
        bulkLoad: function() {},
        toString: function() { return "JSONFileDAO Update"; },
        plan: function() {
          return { cost: Number.MAX_VALUE };
        },
        put: this.updated,
        remove: this.updated
      });
    },
    loadFile: function(filename) {
      if ( ! this.fs.existsSync(filename) ) return undefined;
      var content = this.fs.readFileSync(filename, { encoding: 'utf-8' });
      var data = JSONUtil.parse(this.X, content);
      if ( ! data ) return undefined;
      data.select(this);
      return data;
    }
  },

  listeners: [
    {
      name: 'updated',
      isMerged: 1000,
      code: function() {
        if ( this.writing ) {
          this.updated();
          return;
        }
        this.select()(function(a) {
          this.writing = true;
          this.fs.writeFile(
            this.filename,
            JSONUtil.where(NOT_TRANSIENT).stringify(a),
            { encoding: 'utf-8' },
            function() { this.writing = false; }.bind(this));
        }.bind(this));
      }
    }
  ]
});
