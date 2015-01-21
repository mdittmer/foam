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
  name: 'GlobalController',
  package: 'foam.i18n',

  requires: [
    'foam.i18n.ChromeMessagesBuilder'
  ],

  imports: [
    'console'
  ],

  properties: [
    {
      name: 'builders',
      factory: function() {
        return this.getBuilders();
      }
    }
  ],

  methods: [
    {
      name: 'visitModels',
      code: function() {
        var afuncs = [];
        [
          {
            name: 'USED_MODELS',
            coll: USED_MODELS
          },
          {
            name: 'UNUSED_MODELS',
            coll: UNUSED_MODELS
          }
        ].forEach(function(coll) {
          if (!coll.coll) {
            this.console.warn('Attempt to build XMB from missing model' +
                'collection: "' + coll.name + '"');
            return;
          }
          Object.getOwnPropertyNames(coll.coll).forEach(
              function(modelName) {
                afuncs.push(arequire(modelName).aseq(function(ret, model) {
                  Object.getOwnPropertyNames(this.builders).forEach(
                      function(model, builderName) {
                        this.builders[builderName].visitModel(model);
                      }.bind(this, model));
                  ret();
                }.bind(this)));
              }.bind(this));
        }.bind(this));
        return apar.apply(null, afuncs);
      }
    },
    {
      name: 'getBuilders',
      code: function() {
        return {
          chromeMessages: this.ChromeMessagesBuilder.create()
        };
      }
    }
  ]
});