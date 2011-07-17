/**
 * Geck - Resourceful services made brain-dead easy.
 * 
 * Copyright (c) 2011 Stephen Belanger
 * Licensed under MIT License
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// Load dependencies
var Event = require('events').EventEmitter;
var express = require('express');
var cradle = require('cradle');
var jade = require('jade');
var _ = require('underscore');

// Generic handler to apply to all default routes.
var basic = function(req, res) {
  req.geck.on('error', function(err){
    res.json({ success: false, error: err });
  }).on('success', function(doc){
    res.json({ success: true, response: doc });
  });
};

// Define resource definition defaults.
var defaults = {
  base: ''
  , list: basic
  , read: basic
  , create: basic
  , update: basic
  , destroy: basic
  , destructive: true
  , allow_forced_ids: false
  , include_docs_in_list: true
  , validate: function() { return true; }
};

// Prepare exports.
var geck = {
  // Set some globally accessible variables.
  routes: {}, cradle: null

  /**
   * Create method to manually add routes.
   * 
   * @param string
   *    HTTP method
   * 
   * @param string | regex
   *    Path matching criteria.
   * 
   * @param function
   *    Callback to execute when a matching request occurs.
   */
  , route: function(method, path, callback) {
    method = method.toLowerCase();
    if (typeof this.routes[method] === 'undefined') {
      this.routes[method] = {};
    }
    this.routes[method][defaults.base+path] = callback;
    return this;
  }

  /**
   * Prepare database.
   * 
   * @param object
   *    Configuration object to pass to cradle.setup()
   */
  , database: function(conf) {
    if (conf) { cradle.setup(conf); }
    this.cradle = new cradle.Connection;
    return this;
  }

  // Yo dawg, I heard you like defaults,
  // so I made you some defaults for yo defaults
  // so you can default while yo default defaults.
  , defaults: function(def) {
    if (typeof def === 'function') { def = new def(); }
    else if (typeof def === 'undefined') { def = {}; }
    defaults = _.defaults(def, defaults);
    return this;
  }

  /**
   * Define a resource.
   * 
   * @param string
   *    Resource name in the database. Creates new table, if not present.
   * 
   * @param function | object
   *    Definition to instantiate the resource manager with.
   */
  , resource: function(name, def) {
    // Make sure the database is ready and associate with this resource.
    if ( ! this.cradle) { this.database(); }
    var db = this.cradle.database(name);
    db.exists(function(err, exists) {
      if (err) { throw new Error(err); }
      else if ( ! exists) { db.create(); }
    });

    // Merge defaults into definition.
    if (typeof def === 'function') { def = new def(); }
    else if (typeof def === 'undefined') { def = {}; }
    def = _.defaults(def, defaults);

    /*********
     * Create
     *********/
    this.route('post', '/'+name+'/:id?', function(req, res) {
      // Just run the handler right away and let it wait.
      def.create(req, res);

      // Store the creation process for later.
      var create = function() {
        // Run Validations.
        if ( ! def.validate(req.body)) {
          req.geck.emit('error', 'Validation failure.');
        
        // Validation succeeded. Attempt the creation.
        } else {
          // Prepare args array.
          var args = [req.body, function(err, doc) {
            req.geck.emit(err ? 'error' : 'success', err ? err : doc);
          }];
          
          // Prepend id, if available.
          if (def.allow_forced_ids && req.params.id) {
            args.unshift(req.params.id);
          }

          // Make our dynamically structured database call.
          db.save.apply(db, args);
        }
      };

      // Check non-existence, if id supplied.
      if (def.allow_forced_ids && req.params.id) {
        db.get(req.params.id, function(err, doc) {
          if (err) {
            req.geck.emit('error', 'That id is in use.');
          } else {
            create();
          }
        });
      
      // Otherwise, just jump into our creator.
      } else {
        create();
      }
    });

    /*********
     * Read
     *********/
    this.route('get', '/'+name+'/:id', function(req, res) {
      def.read(req, res);

      // Attempt to fetch the item.
      db.get(req.params.id, function(err, doc) {
        req.geck.emit(err ? 'error' : 'success', err ? err : doc);
      });
    });

    /*********
     * Update
     *********/
    this.route('put', '/'+name+'/:id', function(req, res) {
      def.update(req, res);

      // Check if destructive saves are enabled.
      var mode = def.destructive ? 'save' : 'merge';

      // Remove _id/_rev, if allow_forced_ids is not enabled.
      if ( ! def.allow_forced_ids) {
        delete req.body._id;
        delete req.body._rev;
      }

      // Run validations.
      if ( ! def.validate(req.body)) {
        req.geck.emit('error', 'Validation failure.');

      // Validation succeeded. Attempt the update.
      } else {
        db[mode](req.params.id, req.body, function(err, doc) {
          req.emit(err ? 'error' : 'success', err ? err : doc);
        });
      }
    });

    /*********
     * Delete
     *********/
    this.route('del', '/'+name+'/:id', function(req, res) {
      def.destroy(req, res);

      // We need to fetch first, so we can get the _rev.
      db.get(req.params.id, function(err, doc){
        if (err) {
          req.geck.emit('error', err);
        
        // No errors, attempt destruction.
        } else {
          db.remove(req.params.id, doc._rev, function(err, doc) {
            req.geck.emit(err ? 'error' : 'success', err ? err : doc);
          });
        }
      });
    });

    /*********
     * List
     *********/
    this.route('get', '/'+name, function(req, res) {
      def.list(req, res);

      // Fetch list of all documents.
      db.all({ include_docs: def.include_docs_in_list }, function(err, doc) {
        req.geck.emit(err ? 'error' : 'success', err ? err : doc);
      });
    });

    // Return for chaining.
    return this;
  }

  /**
   * Listen on defined port or connect to existing express server.
   * 
   * @param number | function instance
   *    Port number or existing express server instance.
   */
  , listen: function(app) {
    // If we didn't supply an existing server, we should build one.
    var port = arguments[arguments.length - 1];
    if (typeof arguments[0] === 'number') { app = express.createServer(); }

    // Parse POST data.
    app.use(express.bodyParser());

    // Add a bunch of helpers to the req and res instances.
    app.use(function(req, res, next) {
      // Make a generic handler.
      var send = function(type, txt) {
        res.contentType(type);
        res.header('Content-Length', txt.length);
        res.end(txt);
      };

      // Manage our datatypes.
      res.json = function(obj) { send('json', JSON.stringify(obj)); };
      res.html = function(html) { send('html', html); };

      // Render jade templates.
      res.tmpl = function(tmpl, data) {
        jade.renderFile(tmpl+'.jade', { locals: data }, function(err, html) {
          send('html', html);
        });
      };

      // Make an event emitter for our routes to use.
      req.geck = new Event;

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
    return this.route(val, path, cb);
  };
});

// Export geck.
module.exports = geck;