var geck = require('./geck');
var _ = require('underscore');

// Define a users resource.
// Resource definitions can be in function or object form.
geck.resource('users', function() {

  // This just shows that action responses are editable.
  this.read = function(err, doc, req, res) { res.json(doc); };

  // The "all" action is a catch all to
  // handle behaviour common to all actions.
  // Beware, if you break this; you break all actions.
  this.all = function(err, doc, req, res, cb) {
    if (err) {
      res.json({ success: false, message: err });
    } else {
      cb(err, doc, req, res);
    }
  };

  // Simple validation, just requires the key exists.
  var required = ['email', 'webname', 'name', 'signup_url', 'signup_service', 'created'];
  this.validate = function(data) {
    for (var key in required) {
      if (typeof required[key] === 'undefined') { return false; }
    }
    return true;
  };

  return this;
});

geck.resource('articles');

// Make a home page route using the template system.
geck.get('/', function(req, res) {
  res.tmpl('index', { content: 'Welcome to GECK.', title: 'GECK' });
});

// Make a catch-all json error for uncaught requests.
geck.get('*', function(req, res) {
  res.json({ error: 'No interface.' });
});

// Start listening.
geck.listen(8080);
console.log('listening on port 8080');