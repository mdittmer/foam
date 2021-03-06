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
  package: 'foam.tutorials.todo.ui',
  name: 'TodoCitationView',
  extends: 'foam.ui.md.DetailView',
  properties: [
    {
      name: 'className',
      defaultValue: 'todo-citation'
    },
  ],
  templates: [
    function CSS() {/*
      .todo-citation {
        align-items: center;
        border-bottom: 1px solid #eee;
        display: flex;
        min-height: 48px;
      }
    */},
    function toHTML() {/*
      <div id="<%= this.id %>" <%= this.cssClassAttr() %>>
        $$isCompleted{ label: '' }
        $$title{ mode: 'read-only', floatingLabel: false }
      </div>
    */},
  ]
});
