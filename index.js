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
 * 
 * TODO:
 * - Authorization (Basic? Key-based? Choice?)
 * - Abstract storage manager so it can be accessed outside of geck.
 * - Abstract storage drivers to other projects and add geck-memory-driver to deps.
 * - Add update functionality to one-to-one and many-to-many relations.
 * - Make some way for relation responses to use handlers from child not parent.
 */
// Load dependencies
var Event = require('events').EventEmitter;
var Resource = require('./lib/resource');
var Store = require('./lib/store');
var Inflect = require('inflectjs');
var express = require('express');
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
  , db: {
    type: 'memory'
    , name: 'geck'
  }
  , list: basic
  , read: basic
  , create: basic
  , update: basic
  , destroy: basic
  , relations: {}
  , allow_forced_ids: false
  , validate: function() { return true; }
  , after_create: function(){}
  , after_update: function(){}
};

// Prepare exports.
var geck = {
  // Set some globally accessible variables.
  routes: {}
  , loggers: []

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

  // Attach a logger.
  , logger: function(cb) { this.loggers.push(cb); }

  // Yo dawg, I heard you like defaults,
  // so I made you some defaults for yo defaults
  // so you can default while yo default defaults.
  , defaults: function(def) {
    if (typeof def === 'function') { def = new def(); }
    else if (typeof def === 'undefined') { def = {}; }
    def.db = _.defaults(def.db||{}, defaults.db);
    defaults = _.defaults(def, defaults);
    return this;
  }

  // Access a database using GECK's built-in storage manager.
  // Pass callback through ready(), if available.
  , database: function(name, cb){
    var db = new Store(defaults.db.type, _.defaults({
      database: defaults.db.database || defaults.db.name,
      collection: Inflect.singular(name)
    }, defaults.db));
    if (typeof cb !== 'function') { return db; }
    db.ready(function(){ cb(db); });
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
    // Support function-style or blank definitions.
    if (typeof def === 'function') { def = new def(); }
    else if (typeof def === 'undefined') { def = {}; }
    def.db = _.defaults(def.db||{}, defaults.db);

    // Build resource, merging supplied definition over defaults.
    var res = new Resource(Inflect.singular(name), _.defaults(def, defaults), this);
    res.build();

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

    // Attach loggers.
    _.each(this.loggers, function(logger) {
      app.use(function(req, res, next){
        logger(req);
        next();
      })
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

    return app;
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