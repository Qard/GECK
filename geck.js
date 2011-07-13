/**
 * Geck - Resourceful services made brain-dead easy.
 * 
 * TODO:
 * - Convert to an event-based system. (err, doc, req, res) is pretty ugly.
 */
// Load dependencies
var express = require('express');
var cradle = require('cradle');
var jade = require('jade');
var _ = require('underscore');

// Define some generic defaults.
var basic = function(err, doc, req, res) { res.json(doc); };
var defaults = {
  destructive: true, allow_forced_ids: false,
  list: basic, read: basic, create: basic, update: basic,
  destroy: function(err, doc, req, res) {
    res.json(err ? { success: false, message: err } : { success: true });
  },
  all: function(err, doc, req, res, cb) { cb(err, doc, req, res); },
  validate: function() { return true; }
};

// Prepare exports.
var geck = {
  // Set some globally accessible variables.
  routes: {}, cradle: null

  // Create method to manually add routes.
  , route: function(method, path, callback) {
    method = method.toLowerCase();
    if (typeof this.routes[method] === 'undefined') {
      this.routes[method] = {};
    }
    this.routes[method][path] = callback;
    return this;
  }

  // Prepare database.
  , database: function(conf) {
    if (conf) { cradle.setup(conf); }
    this.cradle = new cradle.Connection;
    return this;
  }

  // Yo dawg, I heard you like defaults,
  // so I made you some defaults for yo defaults
  // so you can default while yo default defaults.
  , defaults: function(def) {
    defaults = _.defaults(def, defaults);
  }

  // Define a resource.
  , resource: function(name, def) {
    // Make sure the database is ready and associate with this resource.
    if ( ! this.cradle) { this.database(); }
    var db = this.cradle.database(name);
    db.exists(function(err, exists) { if ( ! err && ! exists) { db.create(); } });

    // Merge defaults into definition.
    if (typeof def === 'function') { def = new def; }
    else if (typeof def === 'undefined') { def = {}; }
    def = _.defaults(def, defaults);

    // Create
    var create = function(req, res) {
      if ( ! def.validate(req.body)) {
        def.all('Validation failure.', null, req, res, def.create);
      } else {
        // Prepare args array.
        var args = [req.body, function(err, doc) {
          def.all(err, doc, req, res, def.create);
        }];
        // Prepend id, if available.
        if (req.params.id) { args.unshift(req.params.id); }
        db.save.apply(db, args);
      }
    };
    this.route('post', '/'+name, create);

    // Should we allow the record creator to define ids?
    if (def.allow_forced_ids) {
      this.route('post', '/'+name+'/:id', function(req, res) {
        db.get(req.params.id, function(err, doc) {
          if (err) {
            def.create('That id is in use.', null, res);
          } else {
            create(req, res);
          }
        });
      });
    }

    // Read
    this.route('get', '/'+name+'/:id', function(req, res) {
      db.get(req.params.id, function(err, doc) {
        def.all(err, doc, req, res, def.read);
      });
    });

    // Update
    this.route('put', '/'+name+'/:id', function(req, res) {
      var mode = def.destructive ? 'save' : 'merge';
      if ( ! def.validate(req.body)) {
        def.all('Validation failure.', null, req, res, def.update);
      } else {
        db[mode](req.params.id, req.body, function(err, doc) {
          def.all(err, doc, req, res, def.update);
        });
      }
    });

    // Delete
    this.route('del', '/'+name+'/:id', function(req, res) {
      db.get(req.params.id, function(err, doc){
        if (err) {
          def.all(err, null, req, res, def.destroy);
        } else {
          db.remove(req.params.id, doc._rev, function(err, doc) {
            def.all(err, doc, req, res, def.destroy);
          });
        }
      });
    });

    // List
    this.route('get', '/'+name, function(req, res) {
      db.all(function(err, docs) {
        def.all(err, docs, req, res, def.list);
      });
    });

    // Return for chaining.
    return this;
  }

  // Listen on defined port or connect to existing express server.
  , listen: function(app) {
    // If we didn't supply an existing server, we should build one.
    var port = arguments[arguments.length - 1];
    if (typeof arguments[0] === 'number') { app = express.createServer(); }

    // Parse POST data.
    app.use(express.bodyParser());

    // Add some datatype sending helpers.
    app.use(function(req, res, next) {
      // Make a generic handler.
      var send = function(type, txt, code) {
        if ( ! code) { code = 200; }
        res.contentType(type);
        res.header('Content-Length', txt.length);
        res.end(txt, code);
      };

      // Manage our datatypes.
      res.json = function(obj, code) { send('json', JSON.stringify(obj), code); };
      res.html = function(html, code) { send('html', html, code); };
      res.tmpl = function(tmpl, data, code) {
        jade.renderFile(tmpl+'.jade', { locals: data }, function(err, html) {
          send('html', html, code);
        });
      };

      next();
    });

    // Apply callbacks to app.
    for (var method in this.routes) {
      var callbacks = this.routes[method];
      for (var route in callbacks) {
        var callback = callbacks[route];
        app[method](route, callback);
      }
    }

    // Listen, if we have a port number.
    if (typeof port === 'number') { app.listen(port); }
  }
};

// Support the standard HTTP methods.
_.each(['all', 'get', 'post', 'put', 'del'], function(val) {
  geck[val] = function(path, cb) {
    this.route(val, path, cb);
    return this;
  };
});

// Export geck.
module.exports = geck;