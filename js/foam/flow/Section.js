CLASS({
  package: 'foam.flow',
  name: 'Section',
  extendsModel: 'View',

  properties: [
    {
      name: 'title'
    },
    {
      model_: 'ViewFactoryProperty',
      name: 'inner'
    }
  ],

  methods: {
    /** Allow inner to be optional when defined using HTML. **/
    fromElement: function(e) {
      debugger;
      var children = e.children;
      if ( children.length == 1 && children[0].nodeName === 'inner' ) {
        this.SUPER(e);
      } else {
        console.log('inner ********: ', e.innerHTML);
        this.inner = e.innerHTML;
      }
    }
  },

  templates: [
    function toHTML() {/*<div class="flow-section">%%title<!--<%= this.inner({}, this.X)%>-->%%inner</div>*/}
  ]
});
