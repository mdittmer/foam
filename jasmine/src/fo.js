(function(X) {
  /**
   * Axiom 0: A foundational object that, to start, contains the simplest
   * possible interface for installing axioms.
   */
  var a0 = X.set('a0', Object.create(null, {
    /**
     * a0.install: Install an axiom directly onto this.
     */
    install: {
      writable: true, configurable: true, enumerable: true,
      value: function install(X /* ... Axioms ... */) {
        var as = X.argsToArray(arguments).slice(1);
        for (var i = 0; i < as.length; i++) {
          as[i].installOn(X, this);
        }
        return this;
      },
    },
    /**
     * a0.installOn: Inverion of control for axiom installation. Allows axioms
     *               to install themselves onto an arbitrary object.
     */
    installOn: {
      writable: true, configurable: true, enumerable: true,
      value: function installOn(X, o) {
        throw new Error('Attempt to install description without install '+
            'procedure');
      },
    },
  }));

  /**
   * extend: Our first real axiom. This elevates install to
   *         Object.create(this)-then-install.
   */
  var extend = X.set('extend', Object.create(a0));
  extend.installOn = function extend_installOn(X, o) {
    o.extend = function extend(X /* ... Axioms ... */) {
      var o = Object.create(this);
      return o.install.apply(o, arguments);
    };
  };
  // Install extend into the system.
  a0.install(X, extend);
  /**
   * defA0: Phase 0 of a higher-level interface for defining axioms.
   *        Implements support for:
   *        myAxiom = objectWithDefA0Installed.defA({
   *          path: 'path.to.MyAxiom',
   *          installRequires: ['foo', 'bar']
   *          install: function myAxiom_installer(X, o, foo, bar) { ... }
   *        })
   *
   *        Also has chaining of defAs built-in (see handling of defA_).
   */
  var defA0 = X.set('defA0', a0.extend(X));
  defA0.doInstallOn = function defA0_doInstallOn(X, config, deps) {
    var base = X.set(config.path, Object.create(config.prototype || X.a0));
    base.installOn = function defA0_installOnWrapper(X, o) {
      return (config.install.code || config.install).apply(
          this, [X, o].concat(deps));
    };
  };
  defA0.installOn = function defA0_installOn(X, o) {
    var defA0A = this;
    o.defA_ = [function defA0(config) {
      var defX = config.X || X;
      if (!config.path) throw new Error('Define Axiom without path');
      if (!config.install) throw new Error('Define Axiom without installer');
      return Promise.all(config.installRequires ?
          config.installRequires.map(function defA0_mapRequires(path) {
            return defX.lookup(path);
          }) : []).then(defA0A.doInstallOn.bind(
              defA0A, defX, config));
    }];
    o.defA = function defA(config, opt_X) {
      // TODO(markdittmer): Should these run in series instead of parallel?
      return Promise.all(this.defA_.map(function defA_forEach(defA_) {
        return defA_.call(this, config, opt_X);
      }.bind(this)));
    };
  };
  // Install defA0
  a0.install(X, defA0);

  // Collect axiom initialization promises so we can wait on a bunch of them.
  var aPromises = [];

  /**
   * initializable: An axiom that installs initializers that can depend on
   *                each other. This is a building block for implementing the
   *                create axiom without running into bad object initialization
   *                ordering effects.
   */
  aPromises.push(a0.defA({
    path: 'initializable',
    /**
     * initializable installer: Define initializers_ for bookkeping and
     *                          installInitializer interface to be used by other
     *                          axioms.
     */
    install: function initializable_installer(X, o) {
      o.initializers_ = [];
      o.installInitializer = function installInitializer(
          key, deps, initFn) {
        var initializer = {
          name: key,
          deps: deps,
          code: initFn,
        };
        // Ensure that we have a legitimate place to put initializer in
        // ordering.
        var i, j, minI = 0, maxI = this.initializers_.length, firstDep, lastDep;
        for (i = this.initializers_.length - 1; i >= 0; i--) {
          if (this.initializers_[i].deps.indexOf(key) >= 0) {
            maxI = i - 1;
            firstDep = this.initializers_[i].name;
          }
        }
        // If possible, just tack new initializer on the end of the list.
        if (maxI === this.initializers_.length) {
          this.initializers_.push(initializer);
          return;
        }
        if (deps.length !== 0) {
          for (i = 0; i < this.initializers_; i++) {
            if (deps.indexOf(this.initializers_[i].name) >= 0) {
              minI = i + 1;
              lastDep = this.initializers_[i].name;
            }
          }
        }
        // If deps form a cycle: PANIC.
        // TODO(markdittmer): This could definitely be improved.
        if (minI > maxI) {
          throw new Error(
              'Irreconcilable init dependencies:' +
                  firstDep + ' depends on ' + key + ' but ' +
                  key + ' depends on ' + lastDep);
        }
        this.initializers_.splice(maxI, 0, initializer);
      };
    },
  }));
  /**
   * defA1: Phase 1 of a higher-level interface for defining axioms.
   *        Implements support for:
   *        myAxiom = objectWithDefA0Installed.defA({
   *          <<Phase 0 definition>>,
   *          initRequires: ['foo', 'bar']
   *          init: {
   *            someCreateArg: function someCreateArg_init(value) { ... },
   *            ...,
   *          },
   *        })
   *
   *        Dependencies in initRequires are injected to installInitializer
   *        to ensure safe initializer ordering.
   */
  aPromises.push(a0.defA({
    path: 'defA1',
    installRequires: ['defA0', 'initializable'],
    install: {
      code: function defA1_installer(X, o, defA0, initializable) {
        var defA1A = this;
        // TODO(markdittmer): This should be defined once; not on every install.
        defA1A.doInit = function defA1_doInit(o, initConfig, deps) {
          X.Object_forEach(
              initConfig,
              function defA1_doInit_forEach(initializer, key) {
                o.installInitializer(key, deps, initializer);
              });
        };

        if (!o.defA_) o.install(X, defA0);
        o.defA_.push(function defA1(config) {
          var defX = config.X || X;
          if (config.init) {
            if (!o.installInitializer) o.install(defX, initializable);
            return Promise.resolve(
                defA1A.doInit(o, config.init, config.initRequires || []));
          }
        });
      },
    },
  }));

  // Wait for above axioms to finish installing.
  Promise.all(aPromises).then(function bootstrap_defA1() {
    aPromises = [];

    // Install phase-1 axiom-definer.
    a0.install(X, X.defA1);

    /**
     * context: The context object axiom. Initializes both X and Y on init.
     */
    aPromises.push(a0.defA({
      path: 'context',
      install: function context_installer(X, o) {
        o.X_ = X;
        o.X = o.Y = null;
      },
      init: {
        X: function X_init(X) {
          this.X = X;
          this.Y = X.sub();
        },
      },
    }));
    /**
     * extends: The model extension axiom. Tracks extended model as well as
     *          prototype for instances of model.
     */
    aPromises.push(a0.defA({
      path: 'extends',
      install: function extends_installer(X, o) {
        var defaultPrototype = X.a0 || null;
        o.extends_ = defaultPrototype;
        o.prototype_ = defaultPrototype;
      },
      initRequires: ['context'],
      init: {
        'extends': function extends_init(lookupPath) {
          this.X.lookup(lookupPath).then(function setPrototype(base) {
            this.extends_ = base;
            this.prototype_ = (base.prototype_ || null);
          }.bind(this));
        },
      },
    }));
    /**
     * create: Axiom 0 for modelling. Supports creating an instance from a
     *         prototype and initializing axioms on the instance.
     */
    aPromises.push(a0.defA({
      path: 'create',
      installRequires: ['initializable', 'extends'],
      install: function create_installer(X, o, initializable, extends_) {
        o.create = function create(args) {
          if (!this.hasOwnProperty('prototype_')) this.install(X, extends_);
          if (!this.hasOwnProperty('initializers_'))
            this.install(X, initializable);
          var creation = this.prototype_.extend(X);
          // TODO(markdittmer): We should probably store a parallel map to
          // speed this up.
          for (var i = 0; i < this.initializers_.length; i++) {
            if (args.hasOwnProperty(this.initializers_[i].name)) {
              this.initializers_[i].code.call(
                  creation,
                  args[this.initializers_[i].name]);
            }
          }
          return creation;
        };
      },
    }));

    // Wait for above axioms to finish installing.
    Promise.all(aPromises).then(function test_Model() {
      aPromises = [];

      // TODO(markdittmer): Install basic features for models.

      var FProto = a0.extend(
          X,
          a0.defA({
            path: 'name',
            installRequires: ['extends'],
            install: function name_installer(X, o, extends_) {
              if (!o.hasOwnProperty('prototype_')) o.install(X, extends_);
              o.prototype_.name = null;
            },
            init: {
              name: function name_init(name) { this.name = name; },
            },
          })
          // TODO(markdittmer): Install more base FProto axioms.
          );

      debugger;
    });
  });
})(X);
