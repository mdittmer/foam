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
  package: 'foam.u2.md',
  name: 'DetailView',
  extends: 'foam.u2.View',

  requires: [
    'foam.u2.PropertyView',
    'foam.u2.RelationshipView',
    'foam.u2.md.Checkbox',
    'foam.u2.md.TextField',
    'foam.u2.md.MultiLineTextField',
    'foam.u2.md.Select'
  ],

  imports: [ 'dynamic' ],
  exports: [ 'data', 'controllerMode' ],

  properties: [
    {
      name: 'data',
      postSet: function(old, nu) {
        if (nu.model_ !== this.model) this.model = nu.model_;
      }
    },
    {
      name: 'model',
      postSet: function(oldModel, model) {
        console.assert(Model.isInstance(model), 'Invalid model specified for ' + this.name_);
        if ( oldModel !== model ) {
          this.properties = model.getRuntimeProperties().filter(function(p) { return ! p.hidden; });
          this.relationships = model.relationships;
        }
      }
    },
    {
      name: 'properties',
    },
    {
      name: 'controllerMode',
      attribute: true
    },
    {
      name: 'relationships',
    },
    {
      name: 'showRelationships',
      defaultValue: true
    }
  ],

  methods: [
    function init() {
      this.Y.registerModel(this.Checkbox, 'foam.u2.tag.Checkbox');
      this.Y.registerModel(this.TextField, 'foam.u2.TextField');
      this.Y.registerModel(this.MultiLineTextField, 'foam.u2.MultiLineTextField');
      this.Y.registerModel(this.Select, 'foam.u2.tag.Select');
      this.SUPER();
    },
    function initE() {
      // TODO(braden): Once dynamic() returning arrays works again, revert to
      // returning properties and relationships directly, instead of wrapping
      // them.
      this.cls(this.myCls()).
      add(this.dynamic(function(model, properties) {
        return !model ? 'Set model or data.' : this.E().add(properties);
      }.bind(this), this.model$, this.properties$)).
      add(this.dynamic(function(model, showRelationships, relationships) {
        return model && showRelationships ? this.E().add(relationships) : undefined;
      }.bind(this), this.model$, this.showRelationships$, this.relationships$));
    },
    function elementForFeature(fName) {
      var f = this.model_.getFeature(fName) || this.X.data.model_.getFeature(fName);
      return f ?
        f.toE(this.Y) :
        this.E('Unknown feature: ' + fName).style({color: 'red'}) ;
    }
  ]
});
