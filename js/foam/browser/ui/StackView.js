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
  package: 'foam.browser.ui',
  name: 'StackView',
  extendsModel: 'foam.ui.SimpleView',
  imports: [
    'window'
  ],
  exports: [
    'as stack'
  ],
  properties: [
    {
      name: 'views_',
      documentation: 'Internal array of child views.',
      factory: function() { return []; }
    },
    {
      name: 'visibleIndex_',
      documentation: 'The index of the leftmost visible element.',
      defaultValue: 0
    },
    {
      name: 'preferredWidth',
      getter: function() {
        var total = 0;
        for (var i = 0; i < this.views_.length; i++) {
          total += this.views_[i].preferredWidth;
        }
        return total;
      }
    },
    {
      name: 'className',
      defaultValue: 'stackview-container'
    },
  ],

  methods: [
    function init(args) {
      this.SUPER(args);
      this.window.addEventListener('resize', this.resize);
    },
    {
      name: 'pushView',
      documentation: 'Default pushView that works on the top level. See ' +
          'pushView_ for details.',
      code: function(view, hints) {
        this.pushView_(-1, view, hints);
      }
    },
    {
      name: 'popView',
      documentation: 'Default popView that works on the top level. See ' +
          'popView_ for details.',
      code: function() {
        this.popView_(0);
      }
    },
    {
      name: 'pushView_',
      documentation: function() {/*
        <p>The real implementation used to push new views onto the stack.
        The index specifies the level of the stack we're operating at.

        Generally this is not called directly. Instead, views use the stack in
        their contexts to push views. That method is a bound call to this function
        with the index set appropriately.

        <h4>Hints</h4>
        <p>The last argument is an object containing hints. Should the switch
        be transitionless, or backwards? The supported hints are documented here.
        They take the form of an object with options rather than a confusing
        series of optional arguments.</p>
        <dl>
          <dt>instant: true</dt>
          <dd>If this StackView is configured to use an animated transition,
          setting <tt>instant: true</tt> will skip the transition and instantly
          replace the view.</dd>

          <dt>preview: true</dt>
          <dd>Previews are optional pushes. This mode might be used to push and
          render details of the item under the cursor. Show the child view (the
          preview) if there's room for both the main and child views, but if
          there isn't room then keep showing the main view.</dd>
        </dl>
      */},
      // TODO(braden): Actually implement the preview hint. Instant is a no-op
      // until we actually have animated transitions to skip.
      code: function(index, view, hints) {
        if (!view) return;
        if (!hints) hints = {};

        // Pushing a new view with index i means we drop everything in the list
        // that's greater than i, and then add the new view back. There will be
        // i + 1 views in the stack after a pushView(i, v);
        this.destroyChildViews_(index + 1);

        var substack = {
          __proto__: this,
          pushView: this.pushView_.bind(this, this.views_.length),
          popView: this.popView_.bind(this, this.views_.length)
        };

        // HACK: Replacing the values of properties on a child view is a hack
        // and dangerous. If we can think of a better way to make sure the child
        // view is talking to the right stack, then we should change this.
        if (view.stack)
          view.stack = substack;
        view.X.stack = substack;

        this.views_.push({
          id: this.nextID(),
          view: view
        });

        if (this.$) this.renderChild(index + 1);
        this.resize();
      }
    },
    function popView_(index) {
      // popView_(i) pops everything greater than and including i. Therefore,
      // a view that calls this.stack.popView() (on the substack object created
      // above) will be removed from the stack.
      this.destroyChildViews_(index);
      this.resize();
    },

    function destroyChildViews_(index) {
      while(this.views_.length > index) {
        var obj = this.views_.pop();
        obj.view.destroy();
        obj.hideBinding(); // Destroys the Events.dynamic for the hidden class.
        this.X.$(obj.id).outerHTML = '';
      }
    },

    function renderChild(index) {
      var obj = this.views_[index];
      this.$.insertAdjacentHTML('beforeend', this.childHTML(index, this.views_[index]));
      obj.view.initHTML();
    },
    function childHTML(index) {
      var obj = this.views_[index];
      var html = '<div id="' + obj.id + '" class="stackview-panel">';
      html += obj.view.toHTML();
      html += '</div>';

      // This is added as an initializer, and when the inner view is inited,
      // the dynamic binding is created. We can't create it directly, or it
      // will throw unsubscribe immediately, since the DOM node is not yet
      // rendered.
      var self = this;
      obj.view.addInitializer(function() {
        obj.hideBinding = self.X.dynamic(
            function() { self.visibleIndex_; },
            function() {
              var e = self.X.$(obj.id);
              if ( ! e ) throw EventService.UNSUBSCRIBE_EXCEPTION;
              DOM.setClass(e, 'stackview-hidden', index < self.visibleIndex_);
            }
        ).destroy;
      });

      return html;
    },
  ],

  templates: [
    function CSS() {/*
      .stackview-container {
        align-items: flex-start;
        display: flex;
      }
      .stackview-panel {
        flex-grow: 1;
      }
      .stackview-hidden {
        display: none;
      }
    */},
    function toHTML() {/*
      <div id="<%= this.id %>" <%= this.cssClassAttr() %>></div>
      <% this.addInitializer(this.onLoad); %>
    */},
  ],

  listeners: [
    {
      name: 'onLoad',
      code: function() {
        // Render and configure each child view that has already been loaded.
        for (var i = 0; i < this.views_.length; i++) {
          this.renderChild(i);
        }
      }
    },
    {
      name: 'resize',
      isFramed: true,
      code: function() {
        if ( ! this.$ ) return;
        var width = this.$.offsetWidth;
        var index = this.views_.length - 1;
        while (index >= 0 && width >= this.views_[index].view.preferredWidth) {
          width -= this.views_[index].view.preferredWidth;
          index--;
        }

        index = Math.min(index + 1, this.views_.length - 1);
        this.visibleIndex_ = index;
      }
    },
  ]
});