(function(X) {
  var dl0 = X.set('dl0', Object.create(null, {
    install: {
      writable: true, configurable: true, enumerable: true,
      value: function install(X /* ... DLs ... */) {
        var dls = X.argsToArray(arguments).slice(1);
        for (var i = 0; i < dls.length; i++) {
          dls[i].installOn(X, this);
        }
        return this;
      },
    },
    installOn: {
      writable: true, configurable: true, enumerable: true,
      value: function installOn(X, o) {
        throw new Error('Attempt to install feature without install procedure');
      },
    },
  }));

  var extend = X.set('extend', Object.create(dl0));
  extend.installOn = function extend_installOn(X, o) {
    o.extend = function extend(X /* ... DLs ... */) {
      var o = Object.create(this);
      return o.install.apply(o, arguments);
    };
  };
  dl0.install(X, extend);
  var defDL0 = X.set('defDL0', dl0.extend(X));
  defDL0.doInstallOn = function defDL0_doInstallOn(X, config, deps) {
    var base = X.set(config.path, Object.create(config.prototype || X.dl0));
    base.installOn = function defDL0_installOnWrapper(X, o) {
      return (config.install.code || config.install).apply(
          this, [X, o].concat(deps));
    };
  };
  defDL0.installOn = function defDL0_installOn(X, o) {
    var defDL0DL = this;
    o.defDL_ = [function defDL0(config) {
      var defX = config.X || X;
      if (!config.path) throw new Error('Define DL without path');
      if (!config.install) throw new Error('Define DL without installer');
      return Promise.all(config.installRequires ?
          config.installRequires.map(function defDL0_mapRequires(path) {
            return defX.lookup(path);
          }) : []).then(defDL0DL.doInstallOn.bind(
              defDL0DL, defX, config));
    }];
    o.defDL = function defDL(config, opt_X) {
      // TODO(markdittmer): Should these run in series instead of parallel?
      return Promise.all(this.defDL_.map(function defDL_forEach(defDL_) {
        return defDL_.call(this, config, opt_X);
      }.bind(this)));
    };
  };
  dl0.install(X, defDL0);

  var dlPromises = [];
  // TODO(markdittmer): Do we really have a need for this in bootstrap core?
  // Only if we need versioned dependency install/uninstall.
  // dlPromises.push(dl0.defDL({
  //   path: 'hashCode',
  //   install: function hashCode_installer(X, o) {
  //     o.hashCode = function hashCode() {
  //       var hash = 0;
  //       var coreStrId = this.installOn.toString();
  //       if (coreStrId.length == 0) return hash;

  //       for (var i = 0; i < coreStrId.length; i++) {
  //         var code = coreStrId.charCodeAt(i);
  //         hash = ((hash << 5) - hash) + code;
  //         hash &= hash;
  //       }

  //       return hash;
  //     };
  //   },
  // }));

  dlPromises.push(dl0.defDL({
    path: 'initializable',
    install: function initializable_installer(X, o) {
      o.initializers_ = [];
      o.installInitializer = function installInitializer(
          key, deps, initFn) {
        var initializer = {
          name: key,
          deps: deps,
          code: initFn,
        };
        var i, j, minI = 0, maxI = this.initializers_.length, firstDep, lastDep;
        for (i = this.initializers_.length - 1; i >= 0; i--) {
          if (this.initializers_[i].deps.indexOf(key) >= 0) {
            maxI = i - 1;
            firstDep = this.initializers_[i].name;
          }
        }
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
  dlPromises.push(dl0.defDL({
    path: 'defDL1',
    installRequires: ['defDL0', 'initializable'],
    install: {
      code: function defDL1_installer(X, o, defDL0, initializable) {
        var defDL1DL = this;
        // TODO(markdittmer): This should be defined once; not on every install.
        defDL1DL.doInit = function defDL1_doInit(o, initConfig, deps) {
          X.Object_forEach(
              initConfig,
              function defDL1_doInit_forEach(initializer, key) {
                o.installInitializer(key, deps, initializer);
              });
        };

        if (!o.defDL_) o.install(X, defDL0);
        o.defDL_.push(function defDL1(config) {
          var defX = config.X || X;
          if (config.init) {
            if (!o.installInitializer) o.install(defX, initializable);
            return Promise.resolve(
                defDL1DL.doInit(o, config.init, config.initRequires || []));
          }
        });
      },
    },
  }));
  Promise.all(dlPromises).then(function bootstrap_defDL1() {
    dl0.install(X, X.defDL1);

    dlPromises = [];

    dlPromises.push(dl0.defDL({
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
    // TODO(markdittmer): For extends and create:
    // - Do we want extends_ and prototype_, or just use this?
    dlPromises.push(dl0.defDL({
      path: 'extends',
      install: function extends_installer(X, o) {
        var defaultPrototype = X.dl0 || null;
        o.extends_ = defaultPrototype;
        o.prototype_ = defaultPrototype;
      },
      initRequires: ['context'],
      init: {
        'extends': function extends_init(lookupPath, context) {
          this.X.lookup(lookupPath).then(function setPrototype(base) {
            this.extends_ = base;
            this.prototype_ = (base.prototype_ || null);
          }.bind(this));
        },
      },
    }));
    dlPromises.push(dl0.defDL({
    path: 'create',
    installRequires: ['initializable', 'extends'],
    install: function create_installer(X, o, initializable, extends_) {
      o.create = function create(args) {
        if (!this.prototype_) this.install(X, extends_);
        var creation = this.prototype_.extend(X);
        if (!this.initializers_) this.install(X, initializable);
        X.Object_forEach(args, function forEachCreateArg(arg, name) {
          if (this.initializers_[name])
            this.initializers_[name].code.call(this, arg);
        }.bind(this));
      };
    },
    }));

    Promise.all(dlPromises).then(function test_Model() {
      var Model = dl0.extend(X, X['extends']);

      dlPromises = [];

      debugger;
    });
  });

  // dlPromises.push(dl0.defDL({
  //   path: 'context',
  //   install: function context_installer(X, o) {
  //     o.X_ = X;
  //     o.X = o.Y = null;
  //   },
  //   init: function context_init(opt_X) {
  //     this.X = opt_X || this.X_;
  //     this.Y = this.X.sub();
  //   },
  // }));
  // dlPromises.push(dl0.defDL({
  //   path: 'extends',
  //   requires: ['context'],
  //   install: function extends_installer(X, o, initializable, context) {
  //     var defaultPrototype = X.dl0 || null;
  //     this.extends_ = defaultPrototype;
  //     this.prototype_ = defaultPrototype;
  //   },
  //   init: function extends_init(lookupPath) {
  //       this.X.lookup(lookupPath).then(function setPrototype(base) {
  //         this.extends_ = base;
  //         this.prototype_ = (base.prototype_ || null);
  //       }.bind(this));
  //   },
  // }));
  // dlPromises.push(dl0.defDL({
  //   path: 'create',
  //   requires: ['initializable', 'extends'],
  //   install: function create_installer(X, o, initializable, extends_) {
  //     o.create = function create(args) {
  //       if (!this.prototype_) this.install(X, extends_);
  //       var creation = this.prototype_.extend(X);
  //       if (!this.initializers_) this.install(X, initializable);
  //       X.Object_forEach(args, function forEachCreateArg(arg, name) {
  //         if (this.initializers_[name]) this.initializers_[name](arg);
  //       }.bind(this));
  //     };
  //   },
  // }));
})(X);
