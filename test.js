// Read the query parameters and instantiate the model.
(function() {
  var search = /([^&=]+)=?([^&]*)/g;
  var query = window.location.search.substring(1);
  var decode = function(s) {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  };
  var params = {};
  var match;
  while (match = search.exec(query)) {
    params[decode(match[1])] = decode(match[2]);
  }

  var prereqs = [arequire('UnitTest'), arequire('foam.ui.TableView')];

  var testModels = [];
  if ( params.model ) testModels = [arequire(params.model)];
  if ( params.models ) params.models.split(',').map(function(modelName) {
    testModels.push(arequire(modelName));
  });

  apar.apply(null, prereqs.concat(testModels))(function() {
    var tests = Array.prototype.slice.call(arguments, prereqs.length).map(
        function(model) { return model.tests; }).reduce(function(acc, mTests) {
          return mTests && mTests.length ? acc.concat(mTests) : acc;
        }, []);
    var i;

    for ( i = 0; i < tests.length; ++i ) {
      tests[i].test();
    }

    var UnitTest = X.lookup('UnitTest');
    UnitTest.RESULTS.tableFormatter = function(val, obj, table) { return val; };
    UnitTest.PASSED.tableFormatter  = function(val) { return (val ? '<font color=green>' : '<font color=black>' ) + val + "</font>"; };
    UnitTest.FAILED.tableFormatter  = function(val) { return (val ? '<font color=red>' : '<font color=black>' ) + val + "</font>"; };
    UnitTest.DESCRIPTION.tableWidth = "30%";
    UnitTest.RESULTS.tableWidth     = "40%";
    UnitTest.PASSED.tableWidth      = "70px";
    UnitTest.FAILED.tableWidth      = "70px";
    UnitTest.NAME.tableLabel        = '#';
    UnitTest.DESCRIPTION.tableLabel = 'Input';

    var tView = foam.ui.TableView.create({
      model: X.UnitTest,
      dao: tests,
      scrollEnabled: true,
      rows: 1000,
      properties: ['name', 'description', 'results', 'passed', 'failed']
    });

    X.$('output').innerHTML = tView.toHTML();
    tView.initHTML();

    var passed = 0, failed = 0;
    var innerTests = tests;
    while ( innerTests ) {
      for ( i = 0; i < innerTests.length; ++i ) {
        passed += innerTests[i].passed;
        failed += innerTests[i].failed;
      }
      innerTests = innerTests.tests;
    }
    X.$('passed').innerHTML = passed;
    X.$('failed').innerHTML = failed;
  });
})();
