var NODEJS = this.NODEJS = typeof vm !== 'undefined' && vm.runInThisContext;
var GLOBAL = this.GLOBAL = NODEJS ? global : (GLOBAL || this);

describe('Context', function() {
  var initialContext = GLOBAL.X;
  var X;

  beforeEach(function() {
    X = initialContext.createRootContext();
  });

  it('expect set-then-lookup to work', function(done) {
    var foo = {};
    X.set('foo', foo);
    X.lookup('foo').then(function(lookupFBB) {
      expect(lookupFBB).toBe(foo);
      done();
    });
  });

  it('expect lookup-then-set to work', function(done) {
    var alpha = {};
    X.lookup('alpha').then(function(lookupAlpha) {
      expect(lookupAlpha).toBe(alpha);
      done();
    });
    X.set('alpha', alpha);
  });

  it('expect re-set to work', function(done) {
    var beta = {};
    var beta2 = {};
    var count = 0;
    X.lookup('beta').then(function(lookupBeta) {
      expect(lookupBeta).toBe(beta);
      if (++count === 3) done();
    });
    X.set('beta', beta);
    X.lookup('beta').then(function(lookupBeta) {
      expect(lookupBeta).toBe(beta);
      if (++count === 3) done();
    });
    X.set('beta', beta2);
    X.lookup('beta').then(function(lookupBeta) {
      expect(lookupBeta).toBe(beta2);
      if (++count === 3) done();
    });
  });

  it('expect package objects to contain pre-set data', function(done) {
    var alpha_beta = {};
    X.set('alpha.beta', alpha_beta);
    X.lookup('alpha').then(function(lookupAlpha) {
      expect(lookupAlpha.beta).toBe(alpha_beta);
      done();
    });
  });

  it('expect package objects to contain post-set data', function(done) {
    var alpha = {};
    X.set('alpha', alpha);
    X.lookup('alpha').then(function(lookupAlpha) {
      var beta = {};
      X.set('alpha.beta', beta);
      X.lookup('alpha.beta').then(function(lookupAlphaBeta) {
        expect(lookupAlpha.beta).toBe(lookupAlphaBeta);
        done();
      });
    });
  });

  it('set-then-lookup: expect set on super-context to show up in sub-context',
     function(done) {
       var Y = X.sub();
       var alpha = {};
       X.set('alpha', alpha);
       Y.lookup('alpha').then(function(lookupAlpha) {
         expect(lookupAlpha).toBe(alpha);
         done();
       });
     });

  it('lookup-then-set: expect set on super-context to show up in sub-context',
     function(done) {
       var Y = X.sub();
       var alpha = {};
       Y.lookup('alpha').then(function(lookupAlpha) {
         expect(lookupAlpha).toBe(alpha);
         done();
       });
       X.set('alpha', alpha);
     });

  it('set-then-lookup: expect set on sub-context not to show up in super-context',
     function(done) {
       var Y = X.sub();
       var alphaY = {};
       var alphaX = {};
       Y.set('alpha', alphaY);
       X.lookup('alpha').then(function(lookupAlpha) {
         expect(lookupAlpha).toBe(alphaX);
         done();
       });
       X.setTimeout.call(GLOBAL, function() {
         X.set('alpha', alphaX);
       }, 200);
     });

  it('lookup-then-set: expect set on sub-context not to show up in super-context',
     function(done) {
       var Y = X.sub();
       var alphaY = {};
       var alphaX = {};
       X.lookup('alpha').then(function(lookupAlpha) {
         expect(lookupAlpha).toBe(alphaX);
         done();
       });
       Y.set('alpha', alphaY);
       X.setTimeout.call(GLOBAL, function() {
         X.set('alpha', alphaX);
       }, 200);
     });

  it('set-then-lookup: expect sub-lookup to contain object',
     function(done) {
       var beta = {};
       X.set('alpha.beta', beta);
       X.lookup('alpha').then(function(lookupAlpha) {
         expect(lookupAlpha.beta).toBe(beta);
         done();
       });
     });

  it('lookup-then-set: expect sub-lookup to contain object',
     function(done) {
       var beta = {};
       X.lookup('alpha').then(function(lookupAlpha) {
         expect(lookupAlpha.beta).toBe(beta);
         done();
       });
       X.set('alpha.beta', beta);
     });
});
