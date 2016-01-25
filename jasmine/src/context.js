(function() {
  var NODEJS = this.NODEJS = typeof vm !== 'undefined' && vm.runInThisContext;
  var GLOBAL = this.GLOBAL = NODEJS ? global : (GLOBAL || this);

  function argsToArray(args) {
    var array = new Array(args.length);
    for ( var i = 0; i < args.length; i++ ) array[i] = args[i];
    return array;
  }

  function Object_forEach(obj, fn) {
    for ( var key in obj ) if ( obj.hasOwnProperty(key) ) fn(obj[key], key);
  }

  // function curry(f) {
  //   var args = argsToArray(arguments).slice(1);
  //   return function curried() {
  //     return f.apply(this, args.concat(argsToArray(arguments)));
  //   };
  // }

  // function async(f) {
  //   return function asyncFunction() {
  //     var args = argsToArray(arguments);
  //     var self = this;
  //     var promise = new Promise(function(resolve) {
  //       resolve(f.apply(self, args));
  //     });
  //   };
  // }

  // function pseq(next) {
  //   return next.then(pseq.apply(this, argsToArray(arguments).slice(1)));
  // }

  var listeners = {};
  function notify_(X, pathName, value) {
    var pathListeners = listeners[pathName];
    if (!pathListeners) return;
    var unnotified = {};
    var i;
    for (i = 0; i < pathListeners.length; i++) {
      unnotified[i] = pathListeners[i];
    }
    for (i = 0; i < pathListeners.length; i++) {
      var Y = pathListeners[i];
      for (var proto = Y; proto; proto = proto.__proto__) {
        if (proto === X) {
          notifyListener_(Y, pathName, value);
          delete unnotified[i];
          break;
        }
      }
    }
    var newListeners = [];
    Object_forEach(unnotified, function notifyCleanup(listener) {
      newListeners.push(listener);
    });
    listeners[pathName] = newListeners;
  }
  function notifyListener_(X, pathName, value) {
    console.assert(X.promised_.hasOwnProperty(pathName));
    X.promised_[pathName].resolve(value);
    delete X.promised_[pathName];
    unlisten_(X, pathName);
  }
  function listen_(X, pathName) {
    if (!listeners[pathName]) listeners[pathName] = [];
    var pathListeners = listeners[pathName];
    console.assert(pathListeners.indexOf(X) === -1);
    pathListeners.push(X);
  }
  function unlisten_(X, pathName) {
    console.assert(listeners[pathName]);
    var pathListeners = listeners[pathName];
    var idx = pathListeners.indexOf(X);
    console.assert(idx >= 0);
    pathListeners.splice(idx, 1);
  }

  function sub(args) {
    var Y = Object.create(this);
    if (args) for (var key in args) if (args.hasOwnProperty(key)) Y[key] = args[key];
    Y.promised_ = Object.create(this.promised_);
    return Y;
  }

  function lookup(pathName) {
    if (this.promised_[pathName]) return this.promised_[pathName].promise;
    var path = pathName.split('.');
    var X = this;
    var base = X;
    for (var i = 0; i < path.length; i++) {
      if (!path[i]) continue;
      if (!base) break;
      base = base[path[i]];
    }
    if (base) return Promise.resolve(base);
    X.promised_[pathName] = {};
    X.promised_[pathName].promise = new Promise(
        function X_lookup_newPromise(resolve, reject) {
          X.promised_[pathName].resolve = resolve;
          X.promised_[pathName].reject = reject;
        });
    listen_(X, pathName);
    return X.promised_[pathName].promise;
  }

  function set(pathName, value) {
    var path = pathName.split('.');
    var X = this;
    var base = X;
    for (var i = 0; i < path.length - 1; i++) {
      if (!path[i]) continue;
      if (!base[path[i]]) base[path[i]] = {};
      base = base[path[i]];
    }
    base[path[path.length - 1]] = value;
    notify_(X, pathName, value);
    return value;
  }

  function createRootContext() {
    var X = Object.create(GLOBAL);

    X.createRootContext = createRootContext;
    X.argsToArray = argsToArray;
    X.Object_forEach = Object_forEach;
    // X.curry = curry;
    // X.async = async;
    // X.pseq = pseq;

    X.promised_ = {};
    X.sub = sub;
    X.lookup = lookup;
    X.set = set;

    return X;
  };

  this.X = createRootContext();
})();
